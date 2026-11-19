# Hub de ejercicios — resultado

## v2 (19-11-2026)

### Qué hay

- **Esquema v2 definitivo** (`docs/hub-esquema-v2.md`, copia de `hub/esquema-v2-final.md`) implementado de punta a punta: tipos `ejercicio`, `progresion`, `sesion_modelo` y `teoria`; recursos con tramo, relación e idioma; cuatro valoraciones 1–5; oposición en tres ejes; 53 habilidades con grupo y área; categorías del club; procedencia, estado, confianza y sugerencias de vocabulario.
- **Migración** `supabase/migrations/2026-11-19-hub-v2.sql`, aplicada **solo en DEV** y repetida para comprobar que es idempotente. Crea **tablas nuevas** (`hub_contenidos`, `hub_recursos`, `hub_progresion_pasos`, `hub_sesion_bloques`) en vez de migrar las v1: el modelo cambia por completo y así la versión publicada antes seguía leyendo `hub_ejercicio*` hasta desplegar el código v2. Las tablas v1 siguen en DEV sin uso; borrarlas necesita tu confirmación.
  - Vocabularios cerrados en `public.hub_vocab(campo)` usados por los `CHECK`, valoraciones con `CHECK 1–5`, coherencia mínima por tipo.
  - Derivados §9 en columnas (`area`, `grupo_habilidad`, `areas_trabajadas`, `nivel_etiqueta`, `tipos_recurso`, `recurso_principal_tipo`, `tiene_video`, `tiene_video_exacto`, `tiene_diagrama`, `youtube_id`, `asignable`, `texto_busqueda`) más `busqueda`, un `tsvector` español generado con índice GIN. Índices B-tree y GIN para los filtros principales.
  - Embeddings: pgvector está **disponible en DEV pero no instalado**, así que solo queda el hueco documentado en la migración (columna `embedding` sobre `texto_busqueda` cuando se habilite).
  - RLS igual que v1: sin acceso de `anon`/`authenticated`; lee Apps Script tras validar el rol; la RPC `hub_v2_upsertar` solo la ejecuta `service_role`.
- **Validación única** en `src/HubEsquema.gs`: reglas §11.1 (rechazo con la lista de errores de cada ficha), avisos §11.2 (se guardan en `avisos` para la bandeja), derivados §9 y agregados de progresiones y sesiones (rangos de valoraciones, minutos, jugadores, `categorias_comunes`, minutos por área), que se calculan al leer para reflejar siempre los ejercicios actuales. La usan el endpoint, el listado y la semilla.
- **Semilla** `scripts/seed-hub-v2.mjs`, ejecutada dos veces en DEV: los 43 de `ejercicios-v2.json` (Trainer Bot) más las 3 fichas de `ejemplos-v2.json` que no estaban (teoría, progresión y sesión modelo). **46 fichas, 0 rechazadas**, 36 recursos, 3 pasos y 4 bloques; 27 avisos (sobre todo «juego sin reglas» y pizarras pendientes de subir).
- **UI rediseñada** (Gestión → Ejercicios), móvil primero y en los tres temas, ES/EN:
  - Pestañas **Ejercicios** (ejercicios, progresiones y sesiones modelo), **Aprender** (teoría) y **Revisión** (solo admin, con contador).
  - Buscador sobre `texto_busqueda` (sin tildes, plurales sencillos y prefijos; el nombre y el resumen pesan más) y atajos de tipo o tema.
  - **Filtros** en hoja inferior con contador en vivo: tipo y naturaleza, habilidad agrupada por grupo (con recuento), fase, categoría, nivel derivado de la dificultad, esfuerzo físico, tiempo disponible, «tengo N jugadores», material que tengo, canastas, con vídeo del ejercicio, con pizarra, idioma del vídeo, competición y momento de la sesión. Filtros activos como chips que se quitan y «Limpiar todo».
  - **Orden**: relevancia, más recientes, dificultad y duración.
  - **Tarjeta**: miniatura de YouTube o imagen (o icono del tipo), tipo, tramo o tipo de recurso, habilidad principal con el color de su área, resumen, situación numérica, oposición, minutos, jugadores, categorías y cuatro medidores (dificultad, físico, cognitiva, montaje; los rangos de progresiones y sesiones van rayados).
  - **Ficha** a pantalla completa en móvil (panel centrado en escritorio): YouTube embebido que respeta `inicio_seg`/`fin_seg` (carga al pulsar), lista de recursos con el principal primero, datos de organización, valoración con nivel, objetivo, descripción, reglas, puntos clave, errores comunes, variantes, material; en teoría, ideas principales y capítulos que saltan al minuto; en progresiones y sesiones, pasos y bloques enlazados (se navega entre fichas y se vuelve atrás); «Ver también».
  - Estados de carga (esqueleto), vacío y error; foco gestionado en hoja y ficha, Escape, trampa de foco, `aria-pressed`, `role="tab"` con flechas, etiquetas accesibles en medidores y contraste AA de los nuevos tokens de área (`--area-*`) en los tres temas.
  - **Bandeja de revisión**: fichas `propuesto` con sus avisos y sugerencias, primero las que tienen avisos; «Marcar revisada» o «Archivar» (con confirmación). Guarda `revisado_por` (email del admin) y `revisado_at`; las archivadas dejan de listarse.

### URL de DEV

- App y endpoint: <https://script.google.com/macros/s/AKfycbyhHD-u1fzcUuGXVkC90Zdsnbv2Nj6D7XBFBGWGkgzRd88ubdihmABPvszHnmBj3sys/exec> (implementación DEV existente, publicada desde `feature/hub-ejercicios` con `node node_modules/.tmp-deploy/deploy-branch.mjs dev`, HEAD `5c38276`). PRO no se ha tocado.

### Cómo insertar (Trainer Bot)

El token está en Script Properties (`HUB_EJERCICIOS_AGENT_TOKEN`) y en `/workspace/cbbaeza/secrets/agente-hub-ejercicios.env` (permisos 600). `ENDPOINT_URL` apunta a la URL de DEV y `EXAMPLE_JSON` contiene ya una ficha v2 válida (`especialistas`). Sin escribir el token en la línea de órdenes:

```sh
set -a; . /workspace/cbbaeza/secrets/agente-hub-ejercicios.env; set +a
umask 077
node -e 'require("fs").writeFileSync("/tmp/hub.json", JSON.stringify({ token: process.env.TOKEN, ficha: JSON.parse(process.env.EXAMPLE_JSON) }))'
curl -sS -L -H 'Content-Type: application/json' -d @/tmp/hub.json "$ENDPOINT_URL"; rm -f /tmp/hub.json
```

Formato de la petición (un objeto JSON):

- `{ "token": "…", "ficha": { … } }`, o `{ "token": "…", "fichas": [ … ] }` con 1 a 100 fichas, o la ficha con `token` en el mismo nivel.
- Cada ficha lleva `version_esquema: 2` y cumple `docs/hub-esquema-v2.md` (§4 campos, §8 campos por tipo). Los derivados de §9 no se envían.
- **UPSERT completo por slug**: lo que se omite se borra. Un slug no cambia de `tipo_contenido`. Las fichas de un lote pueden referirse entre sí (una progresión a ejercicios del mismo lote).
- Cada ficha se valida por separado: las válidas se guardan en una única transacción y las demás vuelven con sus errores. Si una ficha depende de otra rechazada, también se rechaza.

Respuesta (HTTP 200 siempre, porque Apps Script no permite fijar el código; mirar `ok`):

```json
{ "ok": false, "insertados": ["slug-nuevo"], "actualizados": ["slug-existente"],
  "rechazados": [{ "slug": "slug-malo", "errores": ["dificultad debe ser un entero entre 1 y 5."] }],
  "avisos": [{ "slug": "slug-nuevo", "avisos": ["Juego sin reglas."] }] }
```

`ok` es `true` solo si no hay rechazos. Los errores de la petición (token, formato, más de 100 fichas) devuelven `ok: false` y `error`. Una ficha v1 (sin `version_esquema`) o el sobre v1 (`ejercicio`/`ejercicios`) se rechazan con un mensaje que remite al esquema v2.

Semilla y migración (solo DEV, con `SUPABASE_ACCESS_TOKEN`):

```sh
node scripts/supabase-sql.mjs dev --file supabase/migrations/2026-11-19-hub-v2.sql
node scripts/seed-hub-v2.mjs            # o con rutas: node scripts/seed-hub-v2.mjs fichas.json
```

### Comprobaciones

- `npm test`: 326 pruebas superadas. Nuevas: `tests/hub-esquema.test.js` (los 5 ejemplos válidos, cada regla de §11.1, avisos de §11.2, lotes con dependencias, derivados y agregados), `tests/hub-ejercicios.test.js` (token, solo DEV, v1, lotes parciales, RPC, listado, archivados, avisos solo admin, cambio de estado), `tests/hub-ejercicios-ui.test.js` (pestañas, facetas, jugadores, material, canastas, minutos, vídeo, búsqueda, orden, escape de HTML, reproductor con tramo y capítulos) y `tests/hub-seed.test.mjs`.
- DEV, migración aplicada varias veces sin error; RLS activa y sin grants de `anon`/`authenticated`; RPC ejecutable solo por `service_role`; `websearch_to_tsquery('spanish', …)` encuentra fichas por `busqueda`.
- Endpoint DEV probado con `curl -L -d`: ficha válida → `{"ok":true,"actualizados":["especialistas"],…}` (y en la base `enviado_por = agente`); ficha inválida → rechazada con tres errores (campo derivado `area`, `dificultad` 9, email en `nota`) sin escribir nada; ficha v1 → rechazada con el mensaje de v1; sin token → `Token del agente no válido`.
- Capturas en Chrome headless con los datos reales de DEV (los 46, servidos por el mismo `HubEjercicios.listar`), revisadas una a una: `/workspace/cbbaeza/capturas/hub-v2-*.png` (64). Móvil 390 px y escritorio 1366 px en claro, oscuro y patrimonio: lista, filtros, filtros activos, ficha, ficha desplazada, Aprender, ficha de teoría con capítulos, progresión, revisión y vacío; además inglés (lista, ficha, filtros) y estado de carga.

### Limitaciones

- La interfaz desplegada en DEV no se ha recorrido con un login real (no hay credenciales de entrenador de DEV en el box); las capturas usan la SPA real con `google.script.run` simulado y los datos de DEV.
- Las 11 pizarras con `archivo_local` no se ven: falta decidir dónde se alojan (Storage) y pasarlas a `url`. Las tarjetas lo indican con «Por subir». En v1 se veían porque iban incrustadas en base64.
- La búsqueda es local en el navegador sobre `texto_busqueda`: es instantánea con cientos de fichas, pero no entiende sinónimos ni usa el `tsvector` del servidor.
- Las 46 fichas están en `propuesto`: los entrenadores las ven todas hasta que se archiven; revisar no cambia lo que ven.
- Los agregados de progresiones y sesiones se calculan al leer y no se guardan en la base.
- Las tablas v1 siguen en DEV.

### Próximos pasos

1. **Búsqueda en lenguaje natural**: instalar pgvector en DEV, añadir `embedding vector(N)` calculado desde `texto_busqueda` en cada UPSERT (desde Apps Script o una Edge Function) con índice HNSW, y una RPC que combine filtros duros con similitud; el buscador pasaría a consultar al servidor cuando la frase no encaje con la búsqueda local.
2. Subir las pizarras a Storage y cambiar `archivo_local` por `url`.
3. Asignar ejercicios y progresiones a las sesiones de entrenamiento (campo `asignable`) y estadísticas de foco y exposición por equipo, entrenador y club.
4. Revisar las 46 fichas en la bandeja y borrar las tablas v1 cuando lo confirmes.

---

## v1 (primer punto de control)

Catálogo inicial de 43 ejercicios en `hub_ejercicios` y sus cuatro relaciones (migración `2026-11-19-hub-ejercicios.sql`, solo DEV), con búsqueda y filtros sencillos. Lo sustituye todo lo anterior: su código, su semilla y su endpoint se retiraron en v2.

LISTO

## Ajuste hoja de filtros

- Móvil: hoja inferior de hasta el 65 % de la altura visible, con cabecera y acciones fijas y contenido desplazable. Escritorio: panel lateral de 400 px. Chips y espacios compactos; facetas secundarias plegables con indicador de selección.
- Verificado en navegador a 390 y 1366 px, en los tres temas e inglés: selección, plegado, scroll, foco, Escape y navegación con teclado. Vista local con la SPA real y 43 fichas de muestra, sin conexión a DEV.
- `npm test`: 326 pruebas superadas. Capturas antes/después: `/workspace/cbbaeza/capturas/hub-v2-filtros-compacto-*.png`.

LISTO-FILTROS
