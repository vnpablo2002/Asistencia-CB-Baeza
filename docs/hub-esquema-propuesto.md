# Esquema propuesto por Trainer Bot (adoptar salvo alineación con la app)

ENUMS (textos fijos, no tablas):
- formato: analitico | juego
- oposicion: sin-oposicion | limitada | ventaja | igualdad | desventaja
- organizacion: parejas | filas | grupo
- habilidad: bote | proteccion | salida | finalizacion | lectura | cambio-ritmo | desmarque | defensa | transicion | rebote
- material: conos | petos | churro
- link_tipo: video | diagrama | fuente
- medio_tipo: youtube | imagen | gif

Tablas: `hub_ejercicios`, `hub_ejercicio_habilidades`, `hub_ejercicio_material`,
`hub_ejercicio_enlaces` y `hub_ejercicio_medios`. El esquema y las restricciones
están en la migración del hub y en `docs/modelo-datos.md`. Upsert por `slug`.

La app autentica con sus propios usuarios, no con Supabase Auth. Por tanto,
RLS no concede acceso directo a `anon` ni a `authenticated`: Apps Script valida
el rol de entrenador o administrador y lee con la clave de servicio, que nunca
se envía al navegador. El agente escribe mediante su token y Apps Script.
