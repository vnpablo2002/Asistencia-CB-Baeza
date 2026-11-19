# Hub de ejercicios — primer punto de control

## Estado

- Catálogo en **Gestión → Ejercicios**, accesible a entrenadores y administradores. Incluye búsqueda, filtros por habilidad, formato, oposición y organización, fichas desplegables y medios. La interfaz usa los tres temas y etiquetas ES/EN; las descripciones del catálogo original están en español.
- Migración `supabase/migrations/2026-11-19-hub-ejercicios.sql` aplicada dos veces a **DEV**. La carga inicial también se ejecutó dos veces: 43 ejercicios, 138 habilidades, 11 materiales, 24 enlaces y 24 medios. No se ha tocado PRO.
- La lectura pasa por Apps Script, que valida el rol. Como la app no usa Supabase Auth para sus usuarios, RLS no concede lectura directa a `anon` ni a `authenticated`; tampoco concede escritura pública. La RPC transaccional solo es ejecutable por `service_role`.
- Las 11 imágenes embebidas originales se conservan; los enlaces de Instagram se clasifican como `video` sin alterar URL ni etiqueta. La imagen y el vídeo de «el espejo» se conservan ambos.
- **URL del hub y endpoint:** todavía no disponibles. Pendiente de OK de Pablo para desplegar temporalmente esta rama a DEV. El flujo documentado exige `develop`, no autoriza crear una implementación nueva y comparte el HEAD y las propiedades entre DEV y PRO; no se ha forzado ni alterado ninguna implementación.

## Semilla DEV

Con `SUPABASE_ACCESS_TOKEN` configurado en el entorno o en `.env` local, desde la raíz:

```sh
node scripts/supabase-sql.mjs dev --file supabase/migrations/2026-11-19-hub-ejercicios.sql
node scripts/seed-hub-ejercicios.mjs
```

La semilla lee `/workspace/trainer/ejercicios-1c1.json` y `/workspace/trainer/ejercicios-1c1-v2.html` sin modificarlos; admite ambas rutas como argumentos opcionales. Es repetible por `slug`, pero **reemplaza** la ficha y las relaciones de esos slugs: volver a sembrar puede sobrescribir cambios posteriores del agente. No la ejecutes contra PRO.

## Trainer Bot

El secreto está únicamente en `/workspace/cbbaeza/secrets/agente-hub-ejercicios.env`, con permisos `600`. `ENDPOINT_URL` está vacío hasta que exista una publicación autorizada; el token generado aún no está configurado en Apps Script. Tras autorizar y completar la publicación DEV:

1. En Apps Script, Configuración del proyecto → Propiedades del script, crea `HUB_EJERCICIOS_AGENT_TOKEN` con el valor `TOKEN` del archivo local; no lo incluyas en Git ni en registros. Las propiedades son compartidas, pero `doPost` rechaza explícitamente toda versión que no sea DEV.
2. Rellena `ENDPOINT_URL` en ese archivo con la URL `/exec` de la implementación autorizada, conservando el permiso `600`. Nunca uses la URL PRO.
3. Envía un POST `application/json`: `{ "token": "…", "ejercicio": { ... } }`. También admite `{ "token": "…", "ejercicios": [ ... ] }` o el objeto del ejercicio con `token` en el mismo nivel. `EXAMPLE_JSON` contiene una ficha de ejemplo sin credenciales.

Ejemplo desde el box, sin escribir el token en el comando:

```sh
set -a
. /workspace/cbbaeza/secrets/agente-hub-ejercicios.env
set +a
node <<'NODE'
const { ENDPOINT_URL, TOKEN, EXAMPLE_JSON } = process.env;
if (!ENDPOINT_URL) throw new Error('Falta la URL de la implementación DEV autorizada');
fetch(ENDPOINT_URL, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: TOKEN, ejercicio: JSON.parse(EXAMPLE_JSON) })
}).then(async response => {
  const result = await response.json();
  console.log(JSON.stringify(result));
  if (!response.ok || !result.ok) process.exitCode = 1;
}).catch(error => { console.error(error.message); process.exitCode = 1; });
NODE
```

La respuesta individual es `{ "ok": true, "id": "uuid", "slug": "…" }`; el lote devuelve `{ "ok": true, "ejercicios": [{ "id": "uuid", "slug": "…" }] }` en el orden solicitado. Un rechazo devuelve `{ "ok": false, "error": "…" }`; Apps Script ContentService no permite fijar HTTP 409, por lo que hay que comprobar `ok` aunque el HTTP sea 200.

La operación hace **upsert completo por slug**, no PATCH: al reenviar hay que incluir la ficha y todas sus relaciones, pues los campos y arrays omitidos se vacían. Cada lote se valida antes de una única transacción; si una petición agota el tiempo tras confirmar, se puede reenviar el mismo lote completo. Máximo 100 ejercicios y un millón de caracteres por petición. Son obligatorios `slug`, `nombre`, `formato`, `oposicion` y `organizacion`; el slug usa minúsculas ASCII, números y guiones. Los enums están en `docs/hub-esquema-propuesto.md`; enlaces HTTPS y medios HTTPS, rutas relativas seguras o imágenes `data:image/...;base64` de los tipos admitidos (máximo 800 000 caracteres por imagen).

## Comprobaciones y límites

- `npm test`: 306 pruebas superadas.
  En DEV se verificaron inserción, actualización por el mismo UUID, sustitución de relaciones y rollback ante una habilidad inválida dentro de una transacción revertida.
- Smoke en Chromium móvil con datos locales: menú de entrenador, filtro, detalle y temas claro, oscuro y patrimonio; etiquetas ES/EN. No sustituye una prueba del despliegue real.
- Al existir un despliegue autorizado, entrar como entrenador/admin, abrir Gestión → Ejercicios, probar los chips, abrir una ficha y cambiar idioma/tema. Probar después POST con token válido, sin token y con token erróneo, comprobando la respuesta y que solo la petición válida actualiza DEV.
- El primer punto de control no asigna ejercicios a sesiones, no ofrece estadísticas de contenido ni vistas familiares y no incluye Storage. El endpoint no está activo hasta desplegar y configurar su propiedad. No hay URL publicada del hub en esta rama.
