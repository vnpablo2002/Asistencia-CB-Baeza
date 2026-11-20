-- Aplicar solo en DEV antes de enlazar las pizarras propias del hub. Idempotente.
-- La lectura pública usa la URL de Storage; no se crean políticas de escritura para clientes.
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES ('pizarras', 'pizarras', true, ARRAY['image/svg+xml', 'image/png'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'pizarras' AND name = 'pizarras' AND public = true
      AND allowed_mime_types = ARRAY['image/svg+xml', 'image/png']
  ) THEN
    RAISE EXCEPTION 'El bucket pizarras existente no tiene la configuración esperada';
  END IF;
END $$;
