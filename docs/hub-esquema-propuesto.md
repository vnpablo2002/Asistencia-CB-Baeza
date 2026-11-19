# Esquema propuesto por Trainer Bot (adoptar salvo alineación con la app)

ENUMS (textos fijos, no tablas):
- formato: analitico | juego
- oposicion: sin-oposicion | limitada | ventaja | igualdad | desventaja
- organizacion: parejas | filas | grupo
- habilidad: bote | proteccion | salida | finalizacion | lectura | cambio-ritmo | desmarque | defensa | transicion | rebote
- material: conos | petos | churro
- link_tipo: video | diagrama | fuente
- medio_tipo: youtube | imagen | gif

TABLAS: hub_ejercicios, hub_ejercicio_habilidades, hub_ejercicio_material, hub_ejercicio_enlaces, hub_ejercicio_medios
(detalle completo en el mensaje de Trainer Bot / prompt OMP). Upsert por slug. RLS: lectura autenticados; escritura solo service role / Apps Script.
