-- Aplicar antes de publicar el hub de ejercicios. Idempotente.
CREATE TABLE IF NOT EXISTS public.hub_ejercicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nombre text NOT NULL,
  nombre_en text,
  fecha_enviado date,
  fuente text,
  objetivo text,
  como_se_hace text,
  claves text[] NOT NULL DEFAULT '{}',
  version_facil text,
  version_dificil text,
  nota text,
  formato text NOT NULL CHECK (formato IN ('analitico', 'juego')),
  oposicion text NOT NULL CHECK (oposicion IN ('sin-oposicion', 'limitada', 'ventaja', 'igualdad', 'desventaja')),
  organizacion text NOT NULL CHECK (organizacion IN ('parejas', 'filas', 'grupo')),
  detalle_corto boolean NOT NULL DEFAULT false,
  creado_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.hub_ejercicio_habilidades (
  ejercicio_id uuid NOT NULL REFERENCES public.hub_ejercicios(id) ON DELETE CASCADE,
  habilidad text NOT NULL CHECK (habilidad IN ('bote', 'proteccion', 'salida', 'finalizacion', 'lectura', 'cambio-ritmo', 'desmarque', 'defensa', 'transicion', 'rebote')),
  PRIMARY KEY (ejercicio_id, habilidad)
);
CREATE TABLE IF NOT EXISTS public.hub_ejercicio_material (
  ejercicio_id uuid NOT NULL REFERENCES public.hub_ejercicios(id) ON DELETE CASCADE,
  material text NOT NULL CHECK (material IN ('conos', 'petos', 'churro')),
  PRIMARY KEY (ejercicio_id, material)
);
CREATE TABLE IF NOT EXISTS public.hub_ejercicio_enlaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ejercicio_id uuid NOT NULL REFERENCES public.hub_ejercicios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('video', 'diagrama', 'fuente')),
  etiqueta text,
  url text NOT NULL,
  orden integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.hub_ejercicio_medios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ejercicio_id uuid NOT NULL REFERENCES public.hub_ejercicios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('youtube', 'imagen', 'gif')),
  youtube_id text,
  ruta_o_url text,
  es_miniatura boolean NOT NULL DEFAULT false,
  orden integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_hub_ejercicios_slug ON public.hub_ejercicios(slug);
CREATE INDEX IF NOT EXISTS idx_hub_ejercicios_formato ON public.hub_ejercicios(formato);
CREATE INDEX IF NOT EXISTS idx_hub_ejercicios_oposicion ON public.hub_ejercicios(oposicion);
CREATE INDEX IF NOT EXISTS idx_hub_ejercicios_fecha ON public.hub_ejercicios(fecha_enviado DESC);
CREATE INDEX IF NOT EXISTS idx_hub_enlaces_ejercicio ON public.hub_ejercicio_enlaces(ejercicio_id);
CREATE INDEX IF NOT EXISTS idx_hub_medios_ejercicio ON public.hub_ejercicio_medios(ejercicio_id);

ALTER TABLE public.hub_ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_ejercicio_habilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_ejercicio_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_ejercicio_enlaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_ejercicio_medios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hub_ejercicios, public.hub_ejercicio_habilidades, public.hub_ejercicio_material, public.hub_ejercicio_enlaces, public.hub_ejercicio_medios FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.hub_ejercicios, public.hub_ejercicio_habilidades, public.hub_ejercicio_material, public.hub_ejercicio_enlaces, public.hub_ejercicio_medios TO service_role;

-- Una llamada reemplaza todas las relaciones de cada slug dentro de una sola transacción.
CREATE OR REPLACE FUNCTION public.hub_upsert_ejercicios(p_ejercicios jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  item jsonb;
  ejercicio uuid;
  resultado jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_ejercicios) IS DISTINCT FROM 'array' OR jsonb_array_length(p_ejercicios) = 0 THEN
    RAISE EXCEPTION 'Se requiere una lista de ejercicios no vacía';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_ejercicios) AS e GROUP BY e->>'slug' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'El lote contiene slugs duplicados';
  END IF;
  -- Bloquear siempre en el mismo orden evita interbloqueos entre lotes solapados.
  FOR item IN SELECT value FROM jsonb_array_elements(p_ejercicios) ORDER BY value->>'slug' LOOP
    INSERT INTO public.hub_ejercicios (slug, nombre, nombre_en, fecha_enviado, fuente, objetivo, como_se_hace, claves, version_facil, version_dificil, nota, formato, oposicion, organizacion, detalle_corto, creado_por)
    VALUES (item->>'slug', item->>'nombre', item->>'nombre_en', NULLIF(item->>'fecha_enviado', '')::date, item->>'fuente', item->>'objetivo', item->>'como_se_hace', ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'claves', '[]'::jsonb))), item->>'version_facil', item->>'version_dificil', item->>'nota', item->>'formato', item->>'oposicion', item->>'organizacion', COALESCE((item->>'detalle_corto')::boolean, false), item->>'creado_por')
    ON CONFLICT (slug) DO UPDATE SET
      nombre = EXCLUDED.nombre, nombre_en = EXCLUDED.nombre_en, fecha_enviado = EXCLUDED.fecha_enviado,
      fuente = EXCLUDED.fuente, objetivo = EXCLUDED.objetivo, como_se_hace = EXCLUDED.como_se_hace,
      claves = EXCLUDED.claves, version_facil = EXCLUDED.version_facil, version_dificil = EXCLUDED.version_dificil,
      nota = EXCLUDED.nota, formato = EXCLUDED.formato, oposicion = EXCLUDED.oposicion,
      organizacion = EXCLUDED.organizacion, detalle_corto = EXCLUDED.detalle_corto, updated_at = now()
    RETURNING id INTO ejercicio;

    DELETE FROM public.hub_ejercicio_habilidades WHERE ejercicio_id = ejercicio;
    INSERT INTO public.hub_ejercicio_habilidades (ejercicio_id, habilidad)
      SELECT ejercicio, value FROM jsonb_array_elements_text(COALESCE(item->'habilidades', '[]'::jsonb));
    DELETE FROM public.hub_ejercicio_material WHERE ejercicio_id = ejercicio;
    INSERT INTO public.hub_ejercicio_material (ejercicio_id, material)
      SELECT ejercicio, value FROM jsonb_array_elements_text(COALESCE(item->'material', '[]'::jsonb));
    DELETE FROM public.hub_ejercicio_enlaces WHERE ejercicio_id = ejercicio;
    INSERT INTO public.hub_ejercicio_enlaces (id, ejercicio_id, tipo, etiqueta, url, orden)
      SELECT md5(ejercicio::text || ':enlace:' || n::text)::uuid, ejercicio, e->>'tipo', e->>'etiqueta', e->>'url', COALESCE((e->>'orden')::integer, (n - 1)::integer)
      FROM jsonb_array_elements(COALESCE(item->'enlaces', '[]'::jsonb)) WITH ORDINALITY AS t(e, n);
    DELETE FROM public.hub_ejercicio_medios WHERE ejercicio_id = ejercicio;
    INSERT INTO public.hub_ejercicio_medios (id, ejercicio_id, tipo, youtube_id, ruta_o_url, es_miniatura, orden)
      SELECT md5(ejercicio::text || ':medio:' || n::text)::uuid, ejercicio, m->>'tipo', m->>'youtube_id', m->>'ruta_o_url', COALESCE((m->>'es_miniatura')::boolean, false), COALESCE((m->>'orden')::integer, (n - 1)::integer)
      FROM jsonb_array_elements(COALESCE(item->'medios', '[]'::jsonb)) WITH ORDINALITY AS t(m, n);
    resultado := resultado || jsonb_build_array(jsonb_build_object('id', ejercicio, 'slug', item->>'slug'));
  END LOOP;
  RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION public.hub_upsert_ejercicios(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_upsert_ejercicios(jsonb) TO service_role;
