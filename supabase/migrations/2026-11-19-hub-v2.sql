-- Aplicar antes de publicar el hub de ejercicios v2 (docs/hub-esquema-v2.md). Idempotente.
-- Tablas nuevas en lugar de migrar las v1: la versión publicada sigue leyendo hub_ejercicio* hasta desplegar
-- el código v2 y el modelo cambia por completo (tipos, recursos, pasos, bloques y vocabulario). Las tablas v1 se
-- borrarán en una migración aparte cuando lo confirme Pablo.

-- Vocabulario cerrado del esquema v2 (§4–§6). El backend valida antes con src/HubEsquema.gs; estos CHECK son la
-- última barrera. Para dar de alta un valor: añadirlo aquí y en HubEsquema.gs y volver a aplicar este archivo.
CREATE OR REPLACE FUNCTION public.hub_vocab(campo text)
RETURNS text[] LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
  SELECT CASE campo
    WHEN 'tipo_contenido' THEN ARRAY['ejercicio','progresion','sesion_modelo','teoria']
    WHEN 'naturaleza' THEN ARRAY['analitico','juego']
    WHEN 'habilidad' THEN ARRAY['bote','bote_velocidad','bote_proteccion','cambio_mano','cambio_ritmo',
      'mecanica_tiro','tiro_tras_recepcion','tiro_tras_bote','tiro_libre','entrada_canasta','finalizacion_variada','finalizacion_contacto',
      'pase','recepcion','juego_pies_pivote','triple_amenaza',
      'salida_1c1','lectura_defensor','fintas','desmarque','juego_poste',
      'lectura_juego','pasar_y_cortar','espaciado','bloqueo_directo','bloqueo_indirecto','contraataque','ataque_zona','sistemas_ataque','saques',
      'posicion_defensiva','desplazamiento_defensivo','defensa_balon','defensa_sin_balon',
      'ayudas_rotaciones','defensa_bloqueos','defensa_zona','presion','balance_defensivo',
      'rebote_ofensivo','rebote_defensivo',
      'coordinacion','agilidad','velocidad_reaccion','velocidad_aceleracion','salto','fuerza','resistencia',
      'comunicacion','cooperacion','competitividad','concentracion','gestion_error']
    WHEN 'area' THEN ARRAY['tecnica_individual','tactica_individual','tactica_colectiva','fisico_coordinacion','mental_valores']
    WHEN 'grupo_habilidad' THEN ARRAY['bote','tiro_finalizacion','pase_recepcion','fundamentos_sin_bote','ataque_individual',
      'ataque_colectivo','defensa_individual','defensa_colectiva','rebote','fisico','mental']
    WHEN 'fase_juego' THEN ARRAY['ataque','defensa','transicion_ataque','transicion_defensa','balon_parado']
    WHEN 'tema_teoria' THEN ARRAY['tecnica_tactica','metodologia','planificacion','preparacion_fisica','psicologia_grupo','reglamento','salud_prevencion']
    WHEN 'oposicion' THEN ARRAY['sin_oposicion','pasiva','condicionada','real']
    WHEN 'ventaja_inicial' THEN ARRAY['ninguna','ataque','defensa']
    WHEN 'organizacion' THEN ARRAY['individual','parejas','trios','filas','grupos_reducidos','grupo_completo','equipos','circuito_estaciones']
    WHEN 'espacio' THEN ARRAY['zona_canasta','cuarto_pista','media_pista','pista_completa','cualquier_espacio']
    WHEN 'balones' THEN ARRAY['ninguno','uno','uno_por_grupo','uno_por_pareja','uno_por_jugador']
    WHEN 'material' THEN ARRAY['conos','chinos','petos','picas','aros','escalera_coordinacion','vallas','churros','escudos_contacto',
      'colchonetas','sillas','balones_medicinales','pelotas_tenis','gomas_elasticas']
    WHEN 'momento_sesion' THEN ARRAY['calentamiento','parte_principal','vuelta_calma']
    WHEN 'categorias' THEN ARRAY['pre_babybasket','babybasket','pre_minibasket','minibasket','infantil','cadete','junior','senior','bulevard']
    WHEN 'origen' THEN ARRAY['externo','adaptado','propio']
    WHEN 'creado_por' THEN ARRAY['trainer_bot','entrenador','gestor']
    WHEN 'estado' THEN ARRAY['propuesto','revisado','archivado']
    WHEN 'confianza' THEN ARRAY['alta','media','baja']
    WHEN 'nivel' THEN ARRAY['iniciacion','intermedio','avanzado']
    WHEN 'tipo_recurso' THEN ARRAY['video_youtube','video_instagram','video_tiktok','video_otro','pizarra_diagrama','imagen_foto','pdf_documento','articulo_web']
    WHEN 'tipos_recurso' THEN ARRAY['video_youtube','video_instagram','video_tiktok','video_otro','pizarra_diagrama','imagen_foto','pdf_documento','articulo_web','solo_texto']
    WHEN 'idioma' THEN ARRAY['es','en','otro','sin_voz','desconocido']
    WHEN 'relacion' THEN ARRAY['exacto','variante','apoyo']
  END
$$;

CREATE TABLE IF NOT EXISTS public.hub_contenidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (char_length(slug) <= 60 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  version_esquema smallint NOT NULL DEFAULT 2 CHECK (version_esquema = 2),
  tipo_contenido text NOT NULL CHECK (tipo_contenido = ANY (public.hub_vocab('tipo_contenido'))),
  nombre text NOT NULL CHECK (char_length(nombre) <= 80),
  nombre_original text CHECK (char_length(nombre_original) <= 120),
  fecha_enviado date NOT NULL,
  fuente text NOT NULL CHECK (char_length(fuente) <= 150),
  origen text NOT NULL CHECK (origen = ANY (public.hub_vocab('origen'))),
  licencia_nota text CHECK (char_length(licencia_nota) <= 200),
  creado_por text NOT NULL CHECK (creado_por = ANY (public.hub_vocab('creado_por'))),
  estado text NOT NULL CHECK (estado = ANY (public.hub_vocab('estado'))),
  confianza_clasificacion text NOT NULL CHECK (confianza_clasificacion = ANY (public.hub_vocab('confianza'))),
  sugerencias_vocabulario jsonb CHECK (sugerencias_vocabulario IS NULL OR (jsonb_typeof(sugerencias_vocabulario) = 'array' AND jsonb_array_length(sugerencias_vocabulario) <= 5)),
  nota text CHECK (char_length(nota) <= 500),
  relacionados text[] CHECK (cardinality(relacionados) <= 5),
  resumen text NOT NULL CHECK (char_length(resumen) <= 160),
  objetivo text CHECK (char_length(objetivo) <= 300),
  descripcion text CHECK (char_length(descripcion) <= 2000),
  reglas text[] CHECK (cardinality(reglas) <= 8),
  puntos_clave text[] CHECK (cardinality(puntos_clave) <= 5),
  errores_comunes text[] CHECK (cardinality(errores_comunes) <= 5),
  variante_facil text CHECK (char_length(variante_facil) <= 400),
  variante_dificil text CHECK (char_length(variante_dificil) <= 400),
  habilidad_principal text CHECK (habilidad_principal = ANY (public.hub_vocab('habilidad'))),
  habilidades_secundarias text[] CHECK (cardinality(habilidades_secundarias) <= 3 AND habilidades_secundarias <@ public.hub_vocab('habilidad')),
  fase_juego text[] CHECK (cardinality(fase_juego) <= 3 AND fase_juego <@ public.hub_vocab('fase_juego')),
  tema_teoria text CHECK (tema_teoria = ANY (public.hub_vocab('tema_teoria'))),
  naturaleza text CHECK (naturaleza = ANY (public.hub_vocab('naturaleza'))),
  oposicion text CHECK (oposicion = ANY (public.hub_vocab('oposicion'))),
  ventaja_inicial text CHECK (ventaja_inicial = ANY (public.hub_vocab('ventaja_inicial'))),
  situacion_numerica text CHECK (situacion_numerica ~ '^([1-5]c[0-5]|grupal)$'),
  organizacion text CHECK (organizacion = ANY (public.hub_vocab('organizacion'))),
  espacio text CHECK (espacio = ANY (public.hub_vocab('espacio'))),
  canastas_necesarias smallint CHECK (canastas_necesarias BETWEEN 0 AND 6),
  jugadores_min smallint CHECK (jugadores_min BETWEEN 1 AND 30),
  jugadores_max smallint CHECK (jugadores_max BETWEEN jugadores_min AND 30),
  balones text CHECK (balones = ANY (public.hub_vocab('balones'))),
  material text[] CHECK (material <@ public.hub_vocab('material')),
  minutos_min smallint CHECK (minutos_min BETWEEN 1 AND 60),
  minutos_max smallint CHECK (minutos_max BETWEEN minutos_min AND 60),
  momento_sesion text[] CHECK (cardinality(momento_sesion) BETWEEN 1 AND 3 AND momento_sesion <@ public.hub_vocab('momento_sesion')),
  competitivo boolean,
  categorias text[] CHECK (categorias <@ public.hub_vocab('categorias')),
  dificultad smallint CHECK (dificultad BETWEEN 1 AND 5),
  esfuerzo_fisico smallint CHECK (esfuerzo_fisico BETWEEN 1 AND 5),
  carga_cognitiva smallint CHECK (carga_cognitiva BETWEEN 1 AND 5),
  complejidad_organizativa smallint CHECK (complejidad_organizativa BETWEEN 1 AND 5),
  ideas_principales text[] CHECK (cardinality(ideas_principales) BETWEEN 3 AND 7),
  minutos_clave jsonb CHECK (minutos_clave IS NULL OR (jsonb_typeof(minutos_clave) = 'array' AND jsonb_array_length(minutos_clave) <= 20)),
  area text CHECK (area = ANY (public.hub_vocab('area'))),
  grupo_habilidad text CHECK (grupo_habilidad = ANY (public.hub_vocab('grupo_habilidad'))),
  areas_trabajadas text[] CHECK (areas_trabajadas <@ public.hub_vocab('area')),
  nivel_etiqueta text CHECK (nivel_etiqueta = ANY (public.hub_vocab('nivel'))),
  tipos_recurso text[] NOT NULL CHECK (cardinality(tipos_recurso) >= 1 AND tipos_recurso <@ public.hub_vocab('tipos_recurso')),
  recurso_principal_tipo text NOT NULL CHECK (recurso_principal_tipo = ANY (public.hub_vocab('tipos_recurso'))),
  tiene_video boolean NOT NULL,
  tiene_video_exacto boolean NOT NULL,
  tiene_diagrama boolean NOT NULL,
  youtube_id text CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  asignable boolean NOT NULL,
  texto_busqueda text NOT NULL,
  busqueda tsvector GENERATED ALWAYS AS (to_tsvector('spanish'::regconfig, texto_busqueda)) STORED,
  avisos text[] NOT NULL DEFAULT '{}',
  enviado_por text,
  revisado_por text,
  revisado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_contenidos_ejercicio_completo CHECK (tipo_contenido <> 'ejercicio' OR (objetivo IS NOT NULL
    AND descripcion IS NOT NULL AND habilidad_principal IS NOT NULL AND categorias IS NOT NULL AND naturaleza IS NOT NULL
    AND oposicion IS NOT NULL AND ventaja_inicial IS NOT NULL AND situacion_numerica IS NOT NULL AND organizacion IS NOT NULL
    AND espacio IS NOT NULL AND canastas_necesarias IS NOT NULL AND jugadores_min IS NOT NULL AND balones IS NOT NULL
    AND material IS NOT NULL AND minutos_min IS NOT NULL AND minutos_max IS NOT NULL AND momento_sesion IS NOT NULL
    AND competitivo IS NOT NULL AND dificultad IS NOT NULL AND esfuerzo_fisico IS NOT NULL AND carga_cognitiva IS NOT NULL
    AND complejidad_organizativa IS NOT NULL)),
  CONSTRAINT hub_contenidos_teoria_completa CHECK (tipo_contenido <> 'teoria' OR (tema_teoria IS NOT NULL AND ideas_principales IS NOT NULL AND dificultad IS NOT NULL))
);
-- Búsqueda semántica futura: cuando se habilite pgvector (disponible en DEV, aún sin instalar) se añadirá
-- una columna embedding vector(N) calculada desde texto_busqueda en cada UPSERT, con su índice HNSW.
COMMENT ON COLUMN public.hub_contenidos.texto_busqueda IS 'Derivado (§9): textos ricos y etiquetas legibles. Fuente de busqueda (tsvector) y de los futuros embeddings.';

CREATE TABLE IF NOT EXISTS public.hub_recursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contenido_id uuid NOT NULL REFERENCES public.hub_contenidos(id) ON DELETE CASCADE,
  orden smallint NOT NULL CHECK (orden BETWEEN 0 AND 5),
  tipo_recurso text NOT NULL CHECK (tipo_recurso = ANY (public.hub_vocab('tipo_recurso'))),
  url text CHECK (url ~ '^https://'),
  archivo_local text CHECK (archivo_local ~ '^/workspace/'),
  etiqueta text NOT NULL CHECK (char_length(etiqueta) <= 80),
  autor text CHECK (char_length(autor) <= 100),
  idioma text NOT NULL CHECK (idioma = ANY (public.hub_vocab('idioma'))),
  duracion_seg integer CHECK (duracion_seg >= 1),
  inicio_seg integer CHECK (inicio_seg >= 0),
  fin_seg integer CHECK (fin_seg > inicio_seg OR (inicio_seg IS NULL AND fin_seg > 0)),
  relacion text NOT NULL CHECK (relacion = ANY (public.hub_vocab('relacion'))),
  principal boolean NOT NULL,
  youtube_id text CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  CONSTRAINT hub_recursos_origen_unico CHECK ((url IS NULL) <> (archivo_local IS NULL)),
  CONSTRAINT hub_recursos_orden_unico UNIQUE (contenido_id, orden)
);

CREATE TABLE IF NOT EXISTS public.hub_progresion_pasos (
  progresion_id uuid NOT NULL REFERENCES public.hub_contenidos(id) ON DELETE CASCADE,
  orden smallint NOT NULL CHECK (orden BETWEEN 0 AND 7),
  ejercicio_id uuid NOT NULL REFERENCES public.hub_contenidos(id) ON DELETE RESTRICT,
  criterio_avance text NOT NULL CHECK (char_length(criterio_avance) <= 200),
  PRIMARY KEY (progresion_id, orden),
  CONSTRAINT hub_pasos_sin_repetir UNIQUE (progresion_id, ejercicio_id)
);

CREATE TABLE IF NOT EXISTS public.hub_sesion_bloques (
  sesion_id uuid NOT NULL REFERENCES public.hub_contenidos(id) ON DELETE CASCADE,
  orden smallint NOT NULL CHECK (orden BETWEEN 0 AND 11),
  contenido_id uuid NOT NULL REFERENCES public.hub_contenidos(id) ON DELETE RESTRICT,
  minutos smallint NOT NULL CHECK (minutos BETWEEN 1 AND 60),
  nota text CHECK (char_length(nota) <= 200),
  PRIMARY KEY (sesion_id, orden)
);

-- Filtros principales (la app filtra en el cliente; estos índices sirven a consultas y estadísticas futuras).
CREATE INDEX IF NOT EXISTS idx_hub_contenidos_tipo_estado ON public.hub_contenidos(tipo_contenido, estado);
CREATE INDEX IF NOT EXISTS idx_hub_contenidos_habilidad ON public.hub_contenidos(habilidad_principal);
CREATE INDEX IF NOT EXISTS idx_hub_contenidos_area ON public.hub_contenidos(area);
CREATE INDEX IF NOT EXISTS idx_hub_contenidos_tema ON public.hub_contenidos(tema_teoria) WHERE tema_teoria IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hub_contenidos_dificultad ON public.hub_contenidos(dificultad);
CREATE INDEX IF NOT EXISTS idx_hub_contenidos_fecha ON public.hub_contenidos(fecha_enviado DESC);
CREATE INDEX IF NOT EXISTS idx_hub_contenidos_video_exacto ON public.hub_contenidos(tipo_contenido) WHERE tiene_video_exacto;
CREATE INDEX IF NOT EXISTS idx_hub_contenidos_secundarias ON public.hub_contenidos USING gin (habilidades_secundarias);
CREATE INDEX IF NOT EXISTS idx_hub_contenidos_fases ON public.hub_contenidos USING gin (fase_juego);
CREATE INDEX IF NOT EXISTS idx_hub_contenidos_categorias ON public.hub_contenidos USING gin (categorias);
CREATE INDEX IF NOT EXISTS idx_hub_contenidos_material ON public.hub_contenidos USING gin (material);
CREATE INDEX IF NOT EXISTS idx_hub_contenidos_momento ON public.hub_contenidos USING gin (momento_sesion);
CREATE INDEX IF NOT EXISTS idx_hub_contenidos_busqueda ON public.hub_contenidos USING gin (busqueda);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_recursos_principal ON public.hub_recursos(contenido_id) WHERE principal;
CREATE INDEX IF NOT EXISTS idx_hub_pasos_ejercicio ON public.hub_progresion_pasos(ejercicio_id);
CREATE INDEX IF NOT EXISTS idx_hub_bloques_contenido ON public.hub_sesion_bloques(contenido_id);

-- Igual que v1: sin acceso directo de anon ni authenticated. Apps Script lee con service_role tras validar el rol.
ALTER TABLE public.hub_contenidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_progresion_pasos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_sesion_bloques ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hub_contenidos, public.hub_recursos, public.hub_progresion_pasos, public.hub_sesion_bloques FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.hub_contenidos, public.hub_recursos, public.hub_progresion_pasos, public.hub_sesion_bloques TO service_role;
REVOKE ALL ON FUNCTION public.hub_vocab(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_vocab(text) TO service_role;

-- UPSERT completo por slug de un lote ya validado por HubEsquema.validarLote. Primero las fichas y después sus
-- recursos, pasos y bloques, para que un paso pueda apuntar a un ejercicio del mismo lote. Todo en una transacción.
CREATE OR REPLACE FUNCTION public.hub_v2_upsertar(p_fichas jsonb, p_enviado_por text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  columnas text;
  excluidas text;
  item jsonb;
  ficha public.hub_contenidos;
  contenido uuid;
  nuevo boolean;
  resultado jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_fichas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_fichas) = 0 OR jsonb_array_length(p_fichas) > 100 THEN
    RAISE EXCEPTION 'Se requiere una lista de 1 a 100 fichas';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_fichas) AS e GROUP BY e->>'slug' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'El lote contiene slugs duplicados';
  END IF;
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position),
         string_agg('EXCLUDED.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO columnas, excluidas
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'hub_contenidos' AND is_generated = 'NEVER'
     AND column_name NOT IN ('id', 'enviado_por', 'revisado_por', 'revisado_at', 'created_at', 'updated_at');

  -- Bloquear siempre en el mismo orden evita interbloqueos entre lotes solapados.
  FOR item IN SELECT value FROM jsonb_array_elements(p_fichas) ORDER BY value->>'slug' LOOP
    ficha := jsonb_populate_record(NULL::public.hub_contenidos, item);
    IF EXISTS (SELECT 1 FROM public.hub_contenidos WHERE slug = ficha.slug AND tipo_contenido <> ficha.tipo_contenido) THEN
      RAISE EXCEPTION 'El slug % ya existe con otro tipo_contenido', ficha.slug;
    END IF;
    EXECUTE format(
      'INSERT INTO public.hub_contenidos AS c (%1$s, enviado_por) SELECT %1$s, $2 FROM jsonb_populate_record(NULL::public.hub_contenidos, $1) '
      'ON CONFLICT (slug) DO UPDATE SET (%1$s, enviado_por, updated_at) = ROW(%2$s, EXCLUDED.enviado_por, now()) '
      'RETURNING id, (xmax = 0)', columnas, excluidas)
      INTO contenido, nuevo USING item, p_enviado_por;
    -- Un reenvío vuelve a «propuesto»: la revisión anterior ya no aplica a la ficha nueva.
    UPDATE public.hub_contenidos SET revisado_por = NULL, revisado_at = NULL WHERE id = contenido AND estado = 'propuesto' AND revisado_por IS NOT NULL;
    resultado := resultado || jsonb_build_array(jsonb_build_object('slug', ficha.slug, 'id', contenido, 'accion', CASE WHEN nuevo THEN 'insertado' ELSE 'actualizado' END));
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(p_fichas) ORDER BY value->>'slug' LOOP
    SELECT id INTO contenido FROM public.hub_contenidos WHERE slug = item->>'slug';
    DELETE FROM public.hub_recursos WHERE contenido_id = contenido;
    INSERT INTO public.hub_recursos (contenido_id, orden, tipo_recurso, url, archivo_local, etiqueta, autor, idioma, duracion_seg, inicio_seg, fin_seg, relacion, principal, youtube_id)
      SELECT contenido, (n - 1)::smallint, r.tipo_recurso, r.url, r.archivo_local, r.etiqueta, r.autor, r.idioma, r.duracion_seg, r.inicio_seg, r.fin_seg, r.relacion, r.principal, r.youtube_id
        FROM jsonb_array_elements(COALESCE(NULLIF(item->'recursos', 'null'::jsonb), '[]'::jsonb)) WITH ORDINALITY AS t(e, n),
             jsonb_populate_record(NULL::public.hub_recursos, t.e) AS r;
    DELETE FROM public.hub_progresion_pasos WHERE progresion_id = contenido;
    INSERT INTO public.hub_progresion_pasos (progresion_id, orden, ejercicio_id, criterio_avance)
      SELECT contenido, (n - 1)::smallint, (SELECT h.id FROM public.hub_contenidos h WHERE h.slug = e->>'slug' AND h.tipo_contenido = 'ejercicio'), e->>'criterio_avance'
        FROM jsonb_array_elements(COALESCE(NULLIF(item->'pasos', 'null'::jsonb), '[]'::jsonb)) WITH ORDINALITY AS t(e, n);
    DELETE FROM public.hub_sesion_bloques WHERE sesion_id = contenido;
    INSERT INTO public.hub_sesion_bloques (sesion_id, orden, contenido_id, minutos, nota)
      SELECT contenido, (n - 1)::smallint, (SELECT h.id FROM public.hub_contenidos h WHERE h.slug = e->>'slug' AND h.tipo_contenido IN ('ejercicio', 'progresion')), (e->>'minutos')::smallint, e->>'nota'
        FROM jsonb_array_elements(COALESCE(NULLIF(item->'bloques', 'null'::jsonb), '[]'::jsonb)) WITH ORDINALITY AS t(e, n);
  END LOOP;
  RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION public.hub_v2_upsertar(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_v2_upsertar(jsonb, text) TO service_role;
