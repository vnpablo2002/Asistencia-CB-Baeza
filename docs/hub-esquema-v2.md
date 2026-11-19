# Hub CB Baeza: esquema de metadatos v2 (DEFINITIVO)

> Decisiones de Pablo (19-11-2026): categorías oficiales del club (§4.5), `dificultad` 1–5 sustituye a `nivel`, y fotos/vídeos propios con menores permitidos solo con consentimiento gestionado por el club fuera del hub (§10).

Fecha: 2026-11-19 · `version_esquema: 2`
Sustituye a: `esquema-v2-propuesta.md` (Gestor) y `esquema-v2-final-borrador-trainer.md` (Trainer Bot).
Ejemplos válidos: `ejemplos-v2.json`.

Para qué sirve el esquema:

1. **Filtrar** con precisión. Todo lo que se filtra es un enum cerrado.
2. **Contar** qué se trabaja (por equipo, entrenador o club). Las estadísticas salen de cruzar las sesiones asignadas con estos metadatos. La ficha no contiene datos de jugadores.
3. **Buscar en lenguaje natural** más adelante. El texto libre rico más las etiquetas legibles forman `texto_busqueda` y, después, los embeddings. Los calcula el backend.
4. **Separar práctica de teoría.** `teoria` va a «Aprender» y nunca se asigna a un entreno.

Tres principios de diseño:

- **Cada dato se guarda una sola vez.** Lo que se puede deducir de otro campo no se envía, lo calcula el backend (§9).
- **Cada eje responde a una sola pregunta.** Los borradores mezclaban ejes; por ejemplo, `oposicion` combinaba grado de oposición con superioridad numérica.
- **No se inventa nada.** Si un dato no se sabe, se omite (`null`) o se usa `desconocido`. Nunca se estima una URL, una duración o un minuto.

---

## 1. Decisiones de diseño frente a los borradores

| Tema | Propuesta Gestor | Borrador Trainer | **Final** | Por qué |
|---|---|---|---|---|
| Tipos | ejercicio, juego, progresion, teoria, sesion_modelo | sin `juego` | `ejercicio` · `progresion` · `teoria` · `sesion_modelo` | Un juego es una forma de ejercicio, no otra familia. |
| Naturaleza | — | `analitico`/`juego`/`mixto` | `analitico` · `juego` (sin `mixto`) | `mixto` no aclaraba nada y emborronaba las estadísticas. Se elige el motor dominante (§4.2). Encaja 1:1 con `formato` del v1. |
| Recurso | `formato_fuente` + `enlaces` + `medios` | `recursos[]` + índice `recurso_principal` + `solo_texto` como recurso | `recursos[]` con `principal: true` en uno; **sin recursos = solo texto** (derivado) | Un índice se rompe al reordenar. Un recurso «vacío» no es un recurso. |
| Momento del vídeo | — | Mismo vídeo duplicado: con `&t=` y sin él | `inicio_seg` / `fin_seg` en el recurso; URL sin `t=` | Evita duplicados y permite mostrar solo el tramo útil (recopilatorios de 10 ejercicios). |
| Qué muestra el recurso | — | — | **`relacion`**: `exacto` · `variante` · `apoyo` | «Solo los que tienen vídeo» debe significar *vídeo de este ejercicio*. Hoy hay vídeos que solo muestran la técnica (`muerde-a-la-tercera`). |
| Idioma del recurso | `idioma_fuente` | todo `es` (fuentes en inglés marcadas `es`) | `es`·`en`·`otro`·`sin_voz`·`desconocido` | Corrige un error real de los datos. Permite el filtro «vídeos en español». |
| Valoraciones | `intensidad` baja/media/alta | 5 valoraciones (incluida `nivel_competitivo`) | **4**: `dificultad`, `esfuerzo_fisico`, `carga_cognitiva`, `complejidad_organizativa` | `nivel_competitivo` repetía `competitivo` (bool). Cada valoración de más añade ruido al rellenar. |
| Escala de `dificultad` | — | relativa a «infantil mixto nivel bajo» | **absoluta** (qué jugador lo ejecuta bien) | Una escala relativa no sirve entre categorías. |
| `nivel` | iniciacion/intermedio/avanzado | igual | **eliminado**; la UI lo deriva de `dificultad` | Era la misma información que `dificultad`, más tosca. Las dos acabarían contradiciéndose. |
| `area` | input | input + `areas_secundarias` | **derivada** de `habilidad_principal` | Ahora cada habilidad pertenece a un área fija, así que no puede haber contradicción. |
| Oposición | 6 valores mezclados | igual | `oposicion` (grado: `sin_oposicion`·`pasiva`·`condicionada`·`real`) + `ventaja_inicial` (`ninguna`·`ataque`·`defensa`) + `situacion_numerica` | Grado, ventaja posicional y número eran tres ejes distintos dentro de un mismo campo. |
| Habilidades | 45 | 47 (`bandeja` ≈ `entrada_dos_pasos`, `toma_decisiones` ≈ `lectura_defensor`) | **53, sin solapes**, cada una con grupo y área | Se fusionan los pares ambiguos. Se cubren huecos: `defensa_zona`, `balance_defensivo`, `tiro_tras_recepcion`, `lectura_juego`. |
| Puntos de enseñanza | `contenidos_clave` + `consignas_entrenador` | los dos | **`puntos_clave`** (uno solo) | Eran lo mismo con dos nombres. |
| Texto | `descripcion` / `como_se_hace` | los dos, con el mismo texto | **`descripcion`** | Duplicado literal en los 43. |
| Encadenar ejercicios | `progresion_siguiente` | igual | tipo `progresion` con `pasos[]` y `criterio_avance` | La secuencia vive en un solo sitio. |
| Teoría | `habilidad_principal` obligatoria | igual | **`tema_teoria`** obligatorio; habilidad opcional | La metodología o la planificación no son habilidades de pista. Meterlas ahí ensucia las estadísticas de pista. |
| `material` | incluía `balones` y `ninguno` | igual | sin `balones` (va en `balones`); lista vacía = nada extra | `balones` aparecía en los 43/43, así que no filtraba nada. |
| `adaptable_mixto` | bool | `true` en los 43 | **eliminado** | No variaba en ningún dato. El género no es una propiedad del ejercicio. |
| `creado_por` | `trainer-bot` o **email** | igual | enum `trainer_bot`·`entrenador`·`gestor`; la identidad la pone la sesión autenticada | Un email es un dato de contacto. |
| `fuente` | objeto `{nombre, autor, url}` | igual | `fuente` (texto) + `origen` (`externo`·`adaptado`·`propio`) | Las URLs viven en `recursos`. `origen` permite contar cuánto material es propio. |
| `sugerencias_vocabulario` | texto | texto | lista `{campo, valor, motivo}` | Así el Gestor puede agregarlas y decidir. |
| Legacy `enlaces`/`medios` | — | espejo opcional | **eliminados** | Corte limpio: una sola fuente de verdad. |
| Versión | — | — | `version_esquema: 2` obligatorio | El endpoint rechaza payloads v1 en lugar de malinterpretarlos. |

---

## 2. Tipos de contenido

`tipo_contenido` es **obligatorio** y **no se puede cambiar** una vez creado el slug.

| Valor | Qué es | Dónde vive | ¿Se asigna a un entreno? |
|---|---|---|---|
| `ejercicio` | Tarea de pista con organización, reglas y duración. Incluye los juegos. | Biblioteca | Sí, como tarea |
| `progresion` | Secuencia ordenada de 2 a 8 ejercicios que ya existen, con un criterio para pasar al siguiente. | Biblioteca | Sí, como bloque de tareas |
| `sesion_modelo` | Plantilla de sesión completa: bloques de ejercicios o progresiones con sus minutos. | Biblioteca, en «Sesiones» | Se aplica como plantilla y rellena un entreno entero |
| `teoria` | Contenido conceptual sin una tarea concreta de pista: charla, análisis de vídeo, artículo, guía. | «Aprender» | **Nunca** |

### Test ejercicio o teoría (lo aplica Trainer Bot)

> **¿Puede un entrenador montar esto en pista con lo que pone la ficha, en menos de 2 minutos de explicación?**
> Sí → `ejercicio`. No, porque explica *por qué* o *cómo enseñar* algo → `teoria`.

- **La duración no decide el tipo.** Un vídeo de 10 minutos que explica principios es `teoria`. Un recopilatorio de 12 minutos con 10 ejercicios (MOJO) **no** es teoría: se crean N `ejercicio`, cada uno con el mismo vídeo y su `inicio_seg`/`fin_seg`.
- Un clínic que mezcla teoría y ejercicios genera **una** `teoria` para la parte conceptual, más un `ejercicio` por cada tarea que se pueda montar. Se enlazan entre sí con `relacionados`.

---

## 3. Convenciones generales

- **JSON UTF-8.** El endpoint acepta un objeto o un array de objetos y valida cada uno por separado.
- **Enums:** `snake_case` ASCII, en minúsculas. Fuera del vocabulario ⇒ rechazo (§11).
- **Slugs:** `^[a-z0-9]+(-[a-z0-9]+)*$`, de 60 caracteres como máximo, únicos y estables. Usan guiones, no son enums.
- **Opcionales:** se pueden omitir. Si se envían vacíos (`""`, `[]`, `null`), el backend los guarda como `null`. Si se envían con valor, ese valor tiene que ser válido.
- **Campos no aplicables al tipo** (p. ej. `pasos` en un `ejercicio`, `esfuerzo_fisico` en una `teoria`) ⇒ rechazo.
- **Claves desconocidas o derivadas** (§9) ⇒ rechazo. Así se detectan erratas como `habilidad_secundarias`.
- **UPSERT completo por `slug`:** al actualizar se manda la ficha entera; lo que se omite se borra.
- **Fechas:** `YYYY-MM-DD`. **Duraciones de recursos:** segundos (entero). **Duraciones de tareas:** minutos (entero).

---

## 4. Campos

Leyenda de la columna «Oblig.»: **R** = obligatorio · **O** = opcional · **C** = condicional (la regla se indica en la descripción). En §8 está qué campos aplican a cada tipo.

### 4.1 Identidad y procedencia (todos los tipos)

| Campo | Tipo | Oblig. | Valores / rango | Definición y reglas |
|---|---|---|---|---|
| `version_esquema` | int | R | `2` | Cualquier otro valor ⇒ rechazo. |
| `tipo_contenido` | enum | R | §2 | No cambia una vez creado el slug. |
| `slug` | string | R | patrón §3 | Id estable. Para el material importado, el slug del v1. |
| `nombre` | string | R | ≤ 80 | Nombre en español que se muestra en la ficha. |
| `nombre_original` | string | O | ≤ 120 | Nombre en la fuente (en cualquier idioma). Ayuda a buscar y a citar. |
| `fecha_enviado` | date | R | `YYYY-MM-DD` | Día en que se propuso al hub. No es la fecha del vídeo. |
| `fuente` | string | R | ≤ 150 | Atribución legible: «Jr. NBA / MOJO», «Liddicoat Basketball», «Trainer Bot / CB Baeza». |
| `origen` | enum | R | `externo` · `adaptado` · `propio` | `externo`: igual que en la fuente. `adaptado`: fuente externa con cambios del club (reglas, límites). `propio`: creado por el club o por Trainer Bot. |
| `licencia_nota` | string | O | ≤ 200 | Restricciones de uso del material de terceros. |
| `creado_por` | enum | R | `trainer_bot` · `entrenador` · `gestor` | Rol que crea la ficha. La identidad concreta (usuario) la guarda el backend a partir de la sesión autenticada, nunca del payload. |
| `estado` | enum | R | `propuesto` · `revisado` · `archivado` | `trainer_bot` solo puede enviar `propuesto`. Los demás estados se cambian desde la app. |
| `confianza_clasificacion` | enum | R | `alta` · `media` · `baja` | `alta`: se ha visto el vídeo o leído la ficha completa de la fuente. `media`: clasificado con una descripción suficiente (texto, capítulos) sin ver la demostración. `baja`: solo título o resumen mínimo. |
| `sugerencias_vocabulario` | list | O | ≤ 5 × `{campo, valor, motivo}` | Ver §4.9. Nunca bloquea la inserción. |
| `nota` | string | O | ≤ 500 | Observaciones (repeticiones, matices de la fuente). Visible para los entrenadores. |
| `relacionados` | list[slug] | O | ≤ 5, sin repetir | «Ver también»: p. ej. teoría ↔ ejercicios. Cada slug debe existir. |

### 4.2 Qué es la tarea (solo `ejercicio`)

`naturaleza` (R): ¿qué motor tiene la tarea?

| Valor | Definición | Prueba rápida |
|---|---|---|
| `analitico` | Repeticiones dirigidas a un gesto o a una lectura, con consignas del entrenador. Puede tener oposición, incluso real (1c1 en tres niveles). | Lo que se busca es **hacerlo bien**. |
| `juego` | Lo mueve una regla de juego o de competición: pillar, eliminar, cruzar, quedarse en pista, sumar más que el rival, retos por equipos. Incluye los juegos predeportivos y las situaciones reducidas en formato competición (rey de la pista). | Lo que se busca es **ganar el juego**. |

Si tiene tramos de los dos tipos, gana el que ocupa más tiempo. Si están igualados, `juego`. Si son dos tareas claramente distintas, se crean dos fichas y una `progresion`.

### 4.3 Qué se trabaja (núcleo de las estadísticas)

| Campo | Tipo | Oblig. | Valores | Definición y reglas |
|---|---|---|---|---|
| `habilidad_principal` | enum | C | §6 | **Una**: lo que el entrenador corrige en esta tarea. Obligatoria en `ejercicio` y `progresion`. Opcional en `teoria` (solo si el tema es una habilidad concreta) y en `sesion_modelo`. |
| `habilidades_secundarias` | list[enum] | O | §6, de **0 a 3** | Solo las habilidades que aparecen en `objetivo` o en `puntos_clave`. Que algo *ocurra* en la tarea no basta: en un 1c1 siempre se bota, y eso no hace que `bote` sea secundaria. Sin repetidos y distintas de la principal. Requieren que haya principal. |
| `fase_juego` | list[enum] | C | `ataque` · `defensa` · `transicion_ataque` · `transicion_defensa` · `balon_parado`, de 1 a 3 | Fases que la tarea **pretende** entrenar. `defensa` solo cuando la defensa tiene objetivo o consignas propias. Si el defensor solo es un obstáculo para el atacante, no se marca. Obligatoria (≥ 1) en `ejercicio` y `progresion`, salvo que el área derivada sea `fisico_coordinacion` o `mental_valores`. Opcional en el resto. |
| `tema_teoria` | enum | C | §4.7 | Obligatorio en `teoria`. No aplica a otros tipos. |

### 4.4 Cómo se organiza (solo `ejercicio`; todo obligatorio salvo que se indique)

| Campo | Tipo | Valores / rango | Definición y reglas |
|---|---|---|---|
| `oposicion` | enum | `sin_oposicion` · `pasiva` · `condicionada` · `real` | **Grado** de oposición. `sin_oposicion`: nadie se opone. `pasiva`: un obstáculo (cono, churro, maniquí, compañero que se cruza) o un defensor que no disputa el balón. `condicionada`: el defensor disputa con limitaciones (manos atrás, solo lateral, enseña la mano, pica a la tercera, oposición que sube por fases). `real`: el defensor disputa sin limitaciones. |
| `ventaja_inicial` | enum | `ninguna` · `ataque` · `defensa` | Ventaja **posicional o temporal** al empezar: el defensor sale de espaldas o detrás (persecución), o el atacante sale tarde. La superioridad **numérica** no cuenta aquí, va en `situacion_numerica`. Tiene que ser `ninguna` si `oposicion` es `sin_oposicion` o `pasiva`. |
| `situacion_numerica` | enum | `NcM` con N de 1 a 5 y M de 0 a 5 (`1c0` … `5c5`), o `grupal` | Atacantes contra defensores **personas** en cada unidad de juego. Los conos no cuentan. `grupal`: no hay un enfrentamiento numérico definido (pilla-pilla, tiburones). |
| `organizacion` | enum | `individual` · `parejas` · `trios` · `filas` · `grupos_reducidos` · `grupo_completo` · `equipos` · `circuito_estaciones` | Agrupamiento dominante. `individual`: todos a la vez, cada uno con su tarea. `filas`: se espera turno. `grupos_reducidos`: varios grupos de 3 a 6 en paralelo. `grupo_completo`: todos en una misma tarea sin equipos. `equipos`: dos o más equipos que compiten. `circuito_estaciones`: se rota por puestos distintos. |
| `espacio` | enum | `zona_canasta` · `cuarto_pista` · `media_pista` · `pista_completa` · `cualquier_espacio` | Espacio mínimo de una unidad de la tarea. `zona_canasta`: alrededor de un aro, hasta más o menos la línea de 6,75 m. `cualquier_espacio`: no necesita líneas ni canasta (patio, fondo de pista). |
| `canastas_necesarias` | int | 0 a 6 | Mínimo para montar la tarea una vez. |
| `jugadores_min` | int | 1 a 30 | Mínimo para que la tarea funcione. |
| `jugadores_max` | int \| null | `jugadores_min` a 30, o `null` | Máximo recomendable en **una** instalación (canasta o espacio) antes de que haya demasiada espera. `null` si escala sin límite (parejas repartidas por la pista). |
| `balones` | enum | `ninguno` · `uno` · `uno_por_grupo` · `uno_por_pareja` · `uno_por_jugador` | `uno`: un solo balón para toda la tarea. `uno_por_grupo`: uno por fila, grupo o equipo. |
| `material` | list[enum] | ver abajo, puede ir vacío | Material **además de los balones**. `[]` = nada más. |
| `minutos_min`, `minutos_max` | int | 1 a 60, con min ≤ max | Duración recomendada de la tarea en una sesión. |
| `momento_sesion` | list[enum] | `calentamiento` · `parte_principal` · `vuelta_calma`, de 1 a 3 | Partes de la sesión donde encaja. Ya no existe `cualquiera`: se marcan las que apliquen. |
| `competitivo` | bool | | `true` si hay ganador, puntuación, eliminación o un récord que batir. |

`material`: `conos` · `chinos` · `petos` · `picas` · `aros` · `escalera_coordinacion` · `vallas` · `churros` · `escudos_contacto` · `colchonetas` · `sillas` · `balones_medicinales` · `pelotas_tenis` · `gomas_elasticas`

### 4.5 Para quién

| Campo | Tipo | Oblig. | Valores | Reglas |
|---|---|---|---|---|
| `categorias` | list[enum] | C | `pre_babybasket` (antes de primaria) · `babybasket` (1º–2º primaria) · `pre_minibasket` (3º–4º primaria) · `minibasket` (5º–6º primaria) · `infantil` (1º–2º ESO) · `cadete` (3º–4º ESO) · `junior` (1º–2º bachillerato) · `senior` (+18) · `bulevard` (+18 veteranos) | Categorías **recomendadas**, no exclusivas. Obligatoria (≥ 1) en `ejercicio`, `progresion` y `sesion_modelo`. Opcional en `teoria`: vacía significa que es general. |

El nivel (iniciación, intermedio o avanzado) **no es un campo**: la UI lo deriva de `dificultad` (§5).

### 4.6 Texto rico (ficha y búsqueda semántica)

Se escribe **en español**, en frases completas y concretas. Es la materia prima de los embeddings: cuanto más específico (qué hace cada jugador, qué se corrige), mejor se encontrará después.

| Campo | Tipo | Aplica a | Oblig. | Límite | Definición |
|---|---|---|---|---|---|
| `resumen` | string | todos | R | ≤ 160 | **Qué es**, en una frase de tarjeta. No debe copiar `objetivo`. |
| `objetivo` | string | ejercicio, progresion, sesion_modelo (R) · teoria (O) | C | ≤ 300 | **Para qué**: qué aprende el jugador (en `teoria`, el entrenador). |
| `descripcion` | string | ejercicio (R) · resto (O) | C | ≤ 2000 | Organización y desarrollo: dónde está cada uno, qué hace, cómo se rota y cuánto dura. En `teoria` es obligatoria si no hay `recursos`, porque entonces el texto **es** el contenido. |
| `reglas` | list[string] | ejercicio | O | ≤ 8 × 200 | Normas de puntuación, eliminación o límites. Recomendada si `naturaleza = juego`. |
| `puntos_clave` | list[string] | ejercicio, progresion | O | ≤ 5 × 140 | Lo que el entrenador dice o corrige. Frases cortas en imperativo o descriptivas. |
| `errores_comunes` | list[string] | ejercicio | O | ≤ 5 × 140 | Errores que se ven en pista. |
| `variante_facil` / `variante_dificil` | string | ejercicio | O | ≤ 400 | Cómo bajar o subir la exigencia. |
| `ideas_principales` | list[string] | teoria | R | 3 a 7 × 200 | Ideas o afirmaciones del contenido. Sin visionado, solo los temas que declara la fuente (descripción, capítulos), con `confianza_clasificacion` en `media` o `baja`. |
| `minutos_clave` | list[`{seg, tema}`] | teoria | O | ≤ 20; `seg` int ≥ 0 en orden ascendente; `tema` ≤ 100 | Índice del vídeo principal. Solo con marcas reales (capítulos o visionado). Requiere que el recurso principal sea un vídeo. |

### 4.7 Solo `teoria`

`tema_teoria` (R):

| Valor | Qué cubre |
|---|---|
| `tecnica_tactica` | Fundamentos o conceptos de juego (lectura del 1c1, principios de ataque, defensa de bloqueos…). Si hay una habilidad concreta, se pone `habilidad_principal`. Si es transversal (principios generales), se omite. |
| `metodologia` | Cómo enseñar: diseño de tareas, feedback, juegos reducidos, progresiones. |
| `planificacion` | Temporada, microciclos, estructura de sesión, carga. |
| `preparacion_fisica` | Condición física y coordinación aplicadas al baloncesto. |
| `psicologia_grupo` | Motivación, gestión del grupo, valores, convivencia, comunicación con el jugador. |
| `reglamento` | Reglas de juego, minibasket, arbitraje. |
| `salud_prevencion` | Prevención de lesiones, calentamiento preventivo, hidratación, descanso. |

Además: `ideas_principales` (R), `minutos_clave` (O) y `dificultad` (R, con anclajes propios en §5.5). Las otras tres valoraciones no aplican y se rechazan si se envían.

### 4.8 Solo `progresion` y `sesion_modelo`

| Campo | Aplica a | Oblig. | Estructura | Reglas |
|---|---|---|---|---|
| `pasos` | progresion | R | 2 a 8 × `{slug, criterio_avance}` | El orden de la lista es el orden de la progresión. Cada `slug` debe existir y ser `ejercicio`, sin repetidos. `criterio_avance` (R, ≤ 200): cuándo se pasa al siguiente paso; en el último, qué viene después. |
| `bloques` | sesion_modelo | R | 2 a 12 × `{slug, minutos, nota?}` | El orden de la lista es el orden de la sesión. `slug` debe ser `ejercicio` o `progresion`. `minutos` int de 1 a 60. `nota` (O, ≤ 200). Se puede repetir un slug, p. ej. un juego al principio y al final. |

Las valoraciones, el total de minutos y el rango de dificultad de estos tipos **se derivan** de sus hijos (§9). No se envían.

### 4.9 Recursos

`recursos` (R en todos los tipos, puede ir vacío): lista de **0 a 6**. Una lista vacía significa **solo texto**: la ficha es el único material.

| Campo del recurso | Tipo | Oblig. | Valores | Reglas |
|---|---|---|---|---|
| `tipo_recurso` | enum | R | `video_youtube` · `video_instagram` · `video_tiktok` · `video_otro` · `pizarra_diagrama` · `imagen_foto` · `pdf_documento` · `articulo_web` | Lo que **es** el recurso. Un GIF animado de pizarra es `pizarra_diagrama`. Una ficha web con texto es `articulo_web`. |
| `url` | string | C | `https://…` | Va exactamente uno de `url` o `archivo_local`. El host tiene que cuadrar con el tipo: `video_youtube` → `youtube.com`/`youtu.be`, `video_instagram` → `instagram.com`, `video_tiktok` → `tiktok.com`; `video_otro` no puede ser ninguno de esos tres. En URLs de YouTube están **prohibidos** `t=` y `start=`: se usa `inicio_seg`. |
| `archivo_local` | string | C | ruta absoluta bajo `/workspace/` | Archivo del box de Trainer Bot pendiente de subir (diagramas generados, capturas). Solo para `pizarra_diagrama`, `imagen_foto` y `pdf_documento`. Los vídeos se enlazan siempre al original, nunca como copia descargada. |
| `etiqueta` | string | R | ≤ 80 | Texto del botón o pie en la UI: «Vídeo MOJO: Stunt Drivers (2:20–3:20)». |
| `autor` | string | O | ≤ 100 | Canal, web o autor. |
| `idioma` | enum | R | `es` · `en` · `otro` · `sin_voz` · `desconocido` | Idioma hablado o escrito **del recurso**, no de la ficha. `sin_voz`: solo música o demostración, sin explicación. |
| `duracion_seg` | int \| null | O | ≥ 1 | Solo para `video_*`. Duración **total** del vídeo, tal como la dan los metadatos de la plataforma. Si no se sabe, se omite. |
| `inicio_seg`, `fin_seg` | int | O | ≥ 0, con inicio < fin ≤ duración | Solo para `video_*`. Tramo donde aparece la tarea. |
| `relacion` | enum | R | `exacto` · `variante` · `apoyo` | `exacto`: muestra esta tarea (o es la pieza de teoría). `variante`: muestra una versión distinta de la tarea. `apoyo`: referencia técnica o conceptual, no la tarea. |
| `principal` | bool | R | | **Exactamente uno** a `true` si la lista no está vacía. Es el que sale primero en la tarjeta. Si existe un recurso `exacto`, el principal debería ser un `exacto` (si no, aviso). |

Sin repetir la misma `url` o `archivo_local` dentro de una ficha. El mismo vídeo con dos tramos distintos se trata como dos fichas, no como dos recursos.

### 4.10 `sugerencias_vocabulario`

Lista opcional de hasta 5 elementos `{campo, valor, motivo}`:

- `campo`: nombre de un campo con enum (`habilidad_principal`, `material`, `tipo_recurso`…). `habilidades_secundarias` se propone como `habilidad_principal`.
- `valor`: `snake_case` ASCII, ≤ 40.
- `motivo`: ≤ 200. Ejemplo: «Hay 3 ejercicios de defensa del poste bajo y ninguna habilidad encaja».

Regla: **el campo real lleva siempre el valor válido más cercano**. La sugerencia no sustituye a ese valor y nunca provoca un rechazo. El Gestor revisa las sugerencias, da de alta el valor si procede y, entonces, se reclasifican las fichas.

---

## 5. Valoraciones 1–5 (anclajes)

Son enteros del 1 al 5 y en `ejercicio` las cuatro son **obligatorias**. Se valora la **versión base** descrita en `descripcion`, sin variantes. Los niveles 2 y 4 son intermedios entre sus vecinos.

### 5.1 `dificultad`: ¿qué jugador la ejecuta bien? (escala **absoluta**)

| | Anclaje | Ejemplos de los 43 |
|---|---|---|
| **1** | Sin requisitos técnicos: correr, pillar, botar parado. Le sale a un niño en su primer mes. | piedra-papel-tijera |
| **2** | Fundamentos básicos ya adquiridos: bote en desplazamiento con las dos manos, pase de pecho, entrada básica. Iniciación (1–2 temporadas). | especialistas, entradas-dos-filas, semaforo |
| **3** | Fundamentos a velocidad o ante oposición condicionada o real en 1c1. Jugador con base, infantil federado. | lee-la-mano, rey-de-la-pista |
| **4** | Combina varios fundamentos bajo oposición real, con espacio o tiempo reducidos. Cadete o junior competitivo. | tight-spaces, ganate-los-botes |
| **5** | Precisión técnico-táctica de alto nivel a máxima velocidad: lecturas colectivas encadenadas. Junior o senior de nivel. | (no hay entre los 43) |

Nivel derivado en la UI: **1–2 = iniciación**, **3 = intermedio**, **4–5 = avanzado** (confirmado por Pablo, 19-11-2026).

### 5.2 `esfuerzo_fisico`: carga física (sustituye a `intensidad`)

Se juzga por la **relación trabajo:pausa** y la velocidad de los desplazamientos. Las dos cosas se ven en la organización (cuánta gente hay en cada fila, cuánto dura cada ronda).

| | Anclaje |
|---|---|
| **1** | Parado o andando: lectura de mano a ritmo lento, explicación. |
| **2** | Desplazamientos suaves con mucha pausa: filas de 5 o más, entradas a trote. |
| **3** | Esfuerzos cortos e intermitentes con pausas frecuentes: 1c1 con fila de 3–4, rondas de 1 minuto con descanso. |
| **4** | Alta intensidad intermitente con poca pausa: persecuciones, 1c1 continuo, filas de 2–3, contraataques encadenados. |
| **5** | Máxima intensidad sostenida durante más de 1 minuto sin pausa: pista completa continua, juego a ritmo de partido. |

### 5.3 `carga_cognitiva`: decisiones por repetición y a qué velocidad

| | Anclaje |
|---|---|
| **1** | No hay que decidir nada: se ejecuta lo indicado (fila de entradas). |
| **2** | Una señal fija dispara una respuesta fija: salir al pitido, semáforo, cambio al llegar al compañero. |
| **3** | Elegir entre dos opciones según un estímulo claro: mano alta o baja, lado libre. |
| **4** | Varias opciones según el rival y el espacio, en tiempo real: 1c1 vivo con lectura, 2c1. |
| **5** | Decisiones encadenadas con compañeros y varios rivales a velocidad de juego: 3c3 o más, ventajas sucesivas. |

### 5.4 `complejidad_organizativa`: lo que le cuesta al entrenador montarla y dirigirla

| | Anclaje |
|---|---|
| **1** | Se explica en menos de 1 minuto. Sin material o solo balones. Parejas libres o un único grupo. |
| **2** | Filas o parejas con material sencillo (conos) en un solo espacio. Reglas de rotación simples. |
| **3** | Roles que rotan, varios grupos a la vez o varias canastas. Hay que explicar las reglas durante 2–3 minutos. |
| **4** | Equipos con marcador, relevos o cambios de rol con reglas especiales. El entrenador arbitra o controla los tiempos. |
| **5** | Circuito o estaciones, o varios campos sincronizados. Hace falta un ayudante o mucho montaje. |

### 5.5 `dificultad` en `teoria`: nivel del contenido para el **entrenador**

| | Anclaje |
|---|---|
| **1** | Lo entiende un monitor o un padre sin formación. |
| **3** | Necesita experiencia de banquillo o un curso de nivel 1–2. Vocabulario técnico. |
| **5** | Especialista: análisis táctico avanzado, alto rendimiento. |

---

## 6. Vocabulario de habilidades (53 valores)

Cada habilidad pertenece a un **grupo** (para la UI) y a un **área** (para las estadísticas). Las dos cosas se derivan solas, así que no se envían.

Áreas: `tecnica_individual` · `tactica_individual` · `tactica_colectiva` · `fisico_coordinacion` · `mental_valores`.

### Bote (`bote`), área técnica individual
| Valor | Etiqueta | Definición |
|---|---|---|
| `bote` | Bote de control | Manejo básico con las dos manos y la cabeza alta, parado o en desplazamiento lento. |
| `bote_velocidad` | Bote en velocidad | Avanzar botando a la máxima velocidad que se controla (cruzar la pista, contraataque). |
| `bote_proteccion` | Bote de protección | Bote bajo con el cuerpo y el brazo libre entre el balón y el rival. |
| `cambio_mano` | Cambios de mano y dirección | Por delante, entre las piernas, por la espalda, reverso. |
| `cambio_ritmo` | Cambio de ritmo | Acelerar y frenar con bote para ganar ventaja. |

### Tiro y finalización (`tiro_finalizacion`), área técnica individual
| Valor | Etiqueta | Definición |
|---|---|---|
| `mecanica_tiro` | Mecánica de tiro | Forma, equilibrio y tiro estático cerca del aro o a media distancia. |
| `tiro_tras_recepcion` | Tiro tras recepción | Preparar pies y manos antes de recibir y tirar. |
| `tiro_tras_bote` | Tiro tras bote | Parada y tiro (pull-up). |
| `tiro_libre` | Tiro libre | Rutina y mecánica del tiro libre. |
| `entrada_canasta` | Entrada a canasta | Dos tiempos y bandeja con las dos manos. Es la finalización básica. |
| `finalizacion_variada` | Finalizaciones variadas | Reverso, aro pasado, pie contrario, euro-step, rectificado, floater. |
| `finalizacion_contacto` | Finalización con contacto | Finalizar absorbiendo el contacto o la oposición en el aro (escudos, churro). |

### Pase y recepción (`pase_recepcion`), área técnica individual
| Valor | Etiqueta | Definición |
|---|---|---|
| `pase` | Pase | Tipos de pase, precisión y timing. |
| `recepcion` | Recepción | Pedir y recibir con manos-blanco y parada, sin perder la ventaja. |

### Fundamentos sin bote (`fundamentos_sin_bote`), área técnica individual
| Valor | Etiqueta | Definición |
|---|---|---|
| `juego_pies_pivote` | Paradas y pivotes | Paradas en uno y dos tiempos, pivotes y salidas legales. |
| `triple_amenaza` | Triple amenaza | Posición de amenaza y protección del balón sin bote. |

### Ataque individual (`ataque_individual`), área táctica individual
| Valor | Etiqueta | Definición |
|---|---|---|
| `salida_1c1` | Salida en 1c1 | Ganar la primera ventaja al defensor: arrancada, primer paso, salida abierta o cruzada, desde parado o desde bote. |
| `lectura_defensor` | Lectura del defensor | Elegir la acción según lo que hace el **defensor directo**: mano, pies, distancia, lado libre. |
| `fintas` | Fintas | De tiro, de pase, de salida (jab) o de bote, para desequilibrar. |
| `desmarque` | Desmarque | Liberarse para recibir: en V, en L, puerta atrás. |
| `juego_poste` | Juego de poste | Recibir y jugar de espaldas cerca del aro. |

### Ataque colectivo (`ataque_colectivo`), área táctica colectiva
| Valor | Etiqueta | Definición |
|---|---|---|
| `lectura_juego` | Lectura de juego | Decidir con compañeros ante **varios defensores**: pasar, tirar o penetrar, aprovechar superioridades (2c1, 3c2). |
| `pasar_y_cortar` | Pasar y cortar | Juego de pase y corte. |
| `espaciado` | Espaciado | Ocupar y mantener espacios y distancias. |
| `bloqueo_directo` | Bloqueo directo | Uso del bloqueo al jugador con balón. |
| `bloqueo_indirecto` | Bloqueo indirecto | Bloqueos sin balón. |
| `contraataque` | Contraataque | Transición ofensiva: salida, carriles, finalización en ventaja. |
| `ataque_zona` | Ataque a zona | Principios y movimientos contra defensas zonales. |
| `sistemas_ataque` | Sistemas de ataque | Jugadas y movimientos predefinidos contra defensa individual. |
| `saques` | Saques | Saques de banda y de fondo. |

### Defensa individual (`defensa_individual`)
| Valor | Etiqueta | Área | Definición |
|---|---|---|---|
| `posicion_defensiva` | Posición defensiva | técnica individual | Postura base: pies, peso, manos. |
| `desplazamiento_defensivo` | Desplazamientos defensivos | técnica individual | Pasos defensivos, cierres (closeout), recuperaciones. |
| `defensa_balon` | Defensa del jugador con balón | táctica individual | Contener, orientar, presionar el bote, robo legal. |
| `defensa_sin_balon` | Defensa sin balón | táctica individual | Negar la recepción, ver balón y jugador, línea de pase, defender cortes. |

### Defensa colectiva (`defensa_colectiva`), área táctica colectiva
| Valor | Etiqueta | Definición |
|---|---|---|
| `ayudas_rotaciones` | Ayudas y rotaciones | Ayuda, recuperación y rotación entre defensores. |
| `defensa_bloqueos` | Defensa de bloqueos | Defender bloqueos directos e indirectos. |
| `defensa_zona` | Defensa zonal | Principios de la defensa en zona. |
| `presion` | Presión | Presión colectiva en toda o media pista, trampas. |
| `balance_defensivo` | Balance defensivo | Transición defensiva: volver, parar el balón, emparejar. |

### Rebote (`rebote`), área técnica individual
| Valor | Etiqueta | Definición |
|---|---|---|
| `rebote_ofensivo` | Rebote ofensivo | Ir al rebote en ataque y segunda oportunidad. |
| `rebote_defensivo` | Rebote defensivo | Cerrar el rebote (bloqueo de rebote) y asegurar el balón. |

### Físico y coordinación (`fisico`), área físico/coordinación
| Valor | Etiqueta | Definición |
|---|---|---|
| `coordinacion` | Coordinación | Coordinación general y óculo-manual, ritmo, equilibrio. |
| `agilidad` | Agilidad | Cambios de dirección sin balón. |
| `velocidad_reaccion` | Velocidad de reacción | Responder a estímulos visuales o sonoros. |
| `velocidad_aceleracion` | Aceleración | Arrancadas y sprints cortos. |
| `salto` | Salto | Batida, salto y caída. |
| `fuerza` | Fuerza | Fuerza general y del core, contactos. |
| `resistencia` | Resistencia | Sostener el esfuerzo en el tiempo. |

### Mental y valores (`mental`), área mental/valores
| Valor | Etiqueta | Definición |
|---|---|---|
| `comunicacion` | Comunicación | Hablar en pista: avisos, llamadas, ayudas. |
| `cooperacion` | Cooperación | Lograr un objetivo común con los compañeros. |
| `competitividad` | Competitividad | Gestionar el ganar y el perder, esforzarse por el resultado. |
| `concentracion` | Concentración | Atención sostenida, seguir las reglas, reaccionar a la consigna. |
| `gestion_error` | Gestión del error | Tolerancia a la frustración, seguir después de fallar. |

### Reglas de desempate (pares que antes se confundían)
- Un defensor y qué hace → `lectura_defensor`. Compañeros y varios defensores → `lectura_juego`. Ya no existe `toma_decisiones`.
- Una superioridad numérica (2c1, 3c2) no es una habilidad: va en `situacion_numerica`, y la habilidad suele ser `lectura_juego` o `contraataque`.
- Entrada en dos tiempos con bandeja → `entrada_canasta`, sea cual sea el nivel de exigencia. Otras finalizaciones → `finalizacion_variada`.
- Mano no dominante: no es una habilidad, va en `puntos_clave` o en `variante_dificil`.
- Cierre de rebote → `rebote_defensivo`. Puerta atrás → `desmarque`.

---

## 7. Mapa desde el borrador de Trainer Bot y el v1

| Borrador / v1 | Final |
|---|---|
| `bandeja`, `entrada_dos_pasos` / v1 `finalizacion` | `entrada_canasta` (o `finalizacion_variada` / `finalizacion_contacto`, según la tarea) |
| `entrada_reverso` | `finalizacion_variada` |
| `bote_ambidiestro` | `bote` y la mano débil en `puntos_clave` |
| `tiro_estatico` | `mecanica_tiro` |
| `puerta_atras` | `desmarque` |
| `cierre_rebote` / v1 `rebote` | `rebote_defensivo` |
| `superioridad_numerica` | `lectura_juego` y la superioridad en `situacion_numerica` |
| `toma_decisiones` | `lectura_defensor` (un defensor) o `lectura_juego` (colectivo) |
| v1 `proteccion` · `salida` · `lectura` · `cambio-ritmo` · `transicion` · `defensa` | `bote_proteccion` · `salida_1c1` · `lectura_defensor` · `cambio_ritmo` · `contraataque` o `balance_defensivo` · `defensa_balon` o `desplazamiento_defensivo` |
| `oposicion_pasiva` / `oposicion_limitada` / `sin_oposicion` | `pasiva` / `condicionada` / `sin_oposicion` (con `ventaja_inicial: ninguna`) |
| `igualdad` | `real` + `ventaja_inicial: ninguna` |
| `ventaja` en 1c1 (salida retrasada del defensor) | `real` + `ventaja_inicial: ataque` |
| `ventaja` / `desventaja` por número (2c1, 1c2, tiburones) | `real` + `ninguna`; el número va en `situacion_numerica` |
| `desventaja` posicional (el atacante persigue) | `real` + `ventaja_inicial: defensa` |
| `grupos_pequenos` | `grupos_reducidos`, o `grupo_completo` si todos juegan juntos |
| `circuito` / `estaciones` | `circuito_estaciones` |
| `espacio: sin_canasta` | `cualquier_espacio` |
| `balones: pocos` | `uno` o `uno_por_grupo` |
| `material: balones` / `ninguno` | se quitan (`[]`) |
| `momento_sesion: cualquiera` | se marcan las partes concretas |
| `duracion_min_recomendada` / `_max_` | `minutos_min` / `minutos_max` |
| `consignas_entrenador` + `contenidos_clave` | `puntos_clave` (sin repetidos, ≤ 5) |
| `como_se_hace` | se borra (ya está en `descripcion`) |
| `nombre_en` | `nombre_original` |
| `fuente {nombre, autor, url}` | `fuente` (texto) + `origen`; la URL útil pasa a `recursos` |
| `recurso_principal` (índice) | `principal: true` en el recurso |
| `solo_texto` como recurso | `recursos: []` |
| recurso `url`/`ruta_local` con ruta del box | `archivo_local` |
| mismo vídeo con y sin `&t=` | un solo recurso con `inicio_seg` |
| `nivel_competitivo` | se borra (queda `competitivo`) |
| `area`, `areas_secundarias`, `nivel`, `adaptable_mixto`, `enlaces`, `medios`, `progresion_siguiente`, `intensidad` | se borran (derivados u obsoletos; la secuencia pasa a `progresion`) |
| `creado_por: trainer-bot` | `trainer_bot` |

---

## 8. Campos por `tipo_contenido`

R = obligatorio · O = opcional · — = no aplica (se rechaza si se envía).

| Campo | ejercicio | progresion | sesion_modelo | teoria |
|---|---|---|---|---|
| `version_esquema`, `tipo_contenido`, `slug`, `nombre`, `resumen`, `fecha_enviado`, `fuente`, `origen`, `creado_por`, `estado`, `confianza_clasificacion`, `recursos` | R | R | R | R |
| `nombre_original`, `licencia_nota`, `nota`, `relacionados`, `sugerencias_vocabulario` | O | O | O | O |
| `objetivo` | R | R | R | O |
| `descripcion` | R | O | O | O (R si `recursos` = `[]`) |
| `habilidad_principal` | R | R | O | O |
| `habilidades_secundarias` | O | O | O | O |
| `fase_juego` | R (≥ 1)¹ | R (≥ 1)¹ | O | O |
| `categorias` | R | R | R | O |
| `naturaleza`, `oposicion`, `ventaja_inicial`, `situacion_numerica`, `organizacion`, `espacio`, `canastas_necesarias`, `jugadores_min`, `jugadores_max`, `balones`, `material`, `minutos_min`, `minutos_max`, `momento_sesion`, `competitivo` | R | — | — | — |
| `dificultad` | R | — | — | R |
| `esfuerzo_fisico`, `carga_cognitiva`, `complejidad_organizativa` | R | — | — | — |
| `reglas`, `errores_comunes`, `variante_facil`, `variante_dificil` | O | — | — | — |
| `puntos_clave` | O | O | — | — |
| `pasos` | — | R | — | — |
| `bloques` | — | — | R | — |
| `tema_teoria`, `ideas_principales` | — | — | — | R |
| `minutos_clave` | — | — | — | O |

¹ Puede ir vacía si el área derivada de `habilidad_principal` es `fisico_coordinacion` o `mental_valores`.

---

## 9. Campos derivados (los calcula el backend; si se envían ⇒ rechazo)

| Derivado | Cálculo |
|---|---|
| `area`, `grupo_habilidad` | De `habilidad_principal`, con la tabla de §6. |
| `areas_trabajadas` | Unión de las áreas de la principal y las secundarias. |
| `nivel_etiqueta` | `dificultad`: 1–2 → iniciación, 3 → intermedio, 4–5 → avanzado. |
| `tipos_recurso` | Conjunto de los `tipo_recurso`, o `{solo_texto}` si la lista está vacía. |
| `recurso_principal_tipo` | `tipo_recurso` del principal, o `solo_texto`. |
| `tiene_video`, `tiene_video_exacto`, `tiene_diagrama` | Booleanos para los filtros rápidos. |
| `youtube_id` | Sale de la URL. |
| `asignable` | `true` para `ejercicio` y `progresion`. |
| Progresión: `dificultad_min/max`, `minutos_min/max`, `categorias_comunes` | Se agregan desde los pasos. |
| Sesión: `minutos_total`, distribución de áreas y habilidades | Se agregan desde los bloques. |
| `texto_busqueda` | Une nombre, nombre_original, resumen, objetivo, descripcion, reglas, puntos_clave, errores_comunes, variantes, ideas_principales, los temas de minutos_clave y las **etiquetas legibles** de los enums. Es la entrada de los embeddings. |

---

## 10. Privacidad (obligatorio)

- Ningún campo contiene nombres, apodos, edades concretas, fotos o vídeos de jugadores del club, ni datos de contacto (emails, teléfonos, direcciones) de nadie.
- Se permiten `imagen_foto` o vídeos propios grabados en entrenos o partidos del club en los que aparezcan menores **solo con el consentimiento de las familias, que gestiona el club fuera del hub** (decisión de Pablo, 19-11-2026). El hub no guarda el consentimiento ni identifica a los jugadores que aparecen; quien sube el recurso es responsable de que exista.
- La atribución de terceros (canal, web, autor publicado) se permite y se pide.
- La identidad del entrenador que crea o asigna contenido la guarda el backend a partir de la autenticación, nunca en el contenido.

---

## 11. Validación en el endpoint

### 11.1 Rechaza (HTTP 400, con la lista de errores de cada ficha)
1. `version_esquema` ≠ 2, JSON mal formado, o algo que no sea un objeto o un array de objetos.
2. Claves desconocidas, claves derivadas (§9) o campos que no aplican al tipo (§8).
3. Falta un campo obligatorio para el tipo (§8), o un condicional que se cumple (p. ej. `descripcion` en una `teoria` sin recursos).
4. Un enum fuera del vocabulario, en cualquier campo o elemento de una lista.
5. Tipos o rangos incorrectos: enteros, valoraciones de 1 a 5, límites de longitud y de número de elementos (§4), fechas inválidas, slug fuera del patrón.
6. Habilidades: más de 3 secundarias, repetidas, alguna igual a la principal, o secundarias sin principal.
7. Recursos: más de 6; un recurso sin `url` ni `archivo_local`, o con los dos; una `url` que no sea `https`; un host que no cuadra con `tipo_recurso`; una URL de YouTube con `t=` o `start=`; `archivo_local` fuera de `/workspace/` o en un tipo no permitido; `duracion_seg`, `inicio_seg` o `fin_seg` en un recurso que no es vídeo; `inicio_seg` ≥ `fin_seg` o `fin_seg` > `duracion_seg`; una URL o archivo repetido; no haber exactamente un `principal: true` en una lista no vacía.
8. Coherencia de la organización: `situacion_numerica` `Nc0` con `oposicion` distinta de `sin_oposicion` o `pasiva`. `NcM` con M ≥ 1 y `sin_oposicion`. `ventaja_inicial` ≠ `ninguna` con oposición `sin_oposicion` o `pasiva`. `minutos_min` > `minutos_max`. `jugadores_max` < `jugadores_min`.
9. `fase_juego` vacía en `ejercicio` o `progresion` cuando el área derivada no es `fisico_coordinacion` ni `mental_valores`.
10. Teoría: menos de 3 o más de 7 `ideas_principales`. `minutos_clave` sin un vídeo principal, desordenados o con `seg` ≥ `duracion_seg` del principal (cuando se conoce).
11. Progresión o sesión: `pasos` o `bloques` fuera de rango; un slug que no existe; un slug con el tipo equivocado; pasos repetidos.
12. `relacionados` con slugs que no existen, repetidos, o el propio slug.
13. Un `slug` que ya existe con otro `tipo_contenido`.
14. `creado_por = trainer_bot` con `estado` distinto de `propuesto`.
15. Datos personales: un email (`[\w.+-]+@[\w-]+\.[\w.]+`) o un teléfono (`(\+34)?[ ]?[6789]\d{2}[ ]?\d{3}[ ]?\d{3}`) en cualquier campo de texto.
16. `sugerencias_vocabulario` mal formadas: un `campo` que no tiene enum, o un `valor` que no está en `snake_case`.

### 11.2 Acepta con aviso (se guardan; salen en la bandeja de revisión del Gestor)
- `resumen` idéntico a `objetivo`.
- `descripcion` de menos de 150 caracteres con `confianza_clasificacion = alta`.
- `habilidad_principal` del grupo defensa sin `defensa` ni `transicion_defensa` en `fase_juego`, o del grupo ataque sin ninguna fase de ataque.
- `naturaleza = juego` sin `reglas`.
- `teoria` con un vídeo principal de más de 300 s sin `minutos_clave`.
- Hay un recurso `exacto` pero el principal no es `exacto`.
- Recursos con `archivo_local` (pendientes de subir; no cuentan para `tiene_diagrama` hasta que se suban).
- `sugerencias_vocabulario` no vacías (se notifican al Gestor).

---

## 12. Notas para Trainer Bot

**Orden de clasificación:**
1. **Tipo** con el test de §2. Recopilatorio de ejercicios → un `ejercicio` por cada uno, con `inicio_seg`/`fin_seg`. Charla o análisis → `teoria`.
2. **Naturaleza:** ¿se busca hacerlo bien (`analitico`) o ganar el juego (`juego`)?
3. **Habilidad principal:** pregúntate «¿qué corrige el entrenador aquí?». Hay una sola respuesta. **Secundarias**: solo las que aparecen en el objetivo o en los puntos clave, como mucho 3. Lo normal es 1 o 2.
4. **Fase:** la que tiene objetivo. Si el defensor solo sirve de obstáculo, no se marca `defensa`.
5. **Organización:** grado de oposición, ventaja inicial, número de jugadores y lo demás. Se describe la versión base.
6. **Valoraciones:** con los anclajes de §5, comparando con los ejemplos de los 43. No subas todo a 3 por defecto.
7. **Recursos:** abre cada URL antes de incluirla. Pon el tramo exacto con `inicio_seg`/`fin_seg`. Indica la `relacion` real: un vídeo que solo enseña la técnica es `apoyo`. El `idioma` es el del recurso.
8. **Confianza:** `alta` solo si has visto el vídeo o leído la fuente completa.

**Qué no inventar (si no lo sabes, omítelo):**
- URLs, `duracion_seg` (solo de los metadatos de la plataforma), `minutos_clave` (solo con capítulos reales o visionado), `idioma` (`desconocido`), autoría, `jugadores_max` (`null`).
- No atribuyas a la fuente consignas que no están en ella. Las consignas que pongas tú, como experto, van en `puntos_clave` sin citar a la fuente.
- Ningún dato de jugadores ni de contactos (§10).

**Envíos diarios:** una ficha por pieza, completa (UPSERT total). Mientras el endpoint v2 no esté desplegado, se guardan en `hub/pendientes/<YYYY-MM-DD>.json` (array) con este esquema.

**Vocabulario que falta:** usa el valor válido más cercano y añade la propuesta en `sugerencias_vocabulario`. Nunca inventes un enum dentro de un campo.

---

## 13. Notas para el Gestor (solo orientación, no implementado)

**Modelo de datos sugerido.** `hub_contenidos` con columnas tipadas para todos los escalares y enums: `CHECK` o tipos enum de Postgres, y arrays para los multivalor con índice GIN. Además:
- `hub_recursos` (1:N, con `orden`), `hub_progresion_pasos` y `hub_sesion_bloques` (con `orden`).
- `hub_vocab_habilidades` con `(valor, etiqueta, grupo, area)`. Es la fuente de las derivadas `area`/`grupo` y de las etiquetas que entran en `texto_busqueda`.
- Las derivadas de §9, con columnas generadas o triggers.

**Migración de los 43.** Trainer Bot reclasifica según el mapa de §7 y genera `ejercicios-v2.json` nuevo. El endpoint v1 se apaga cuando acepte v2: corte limpio, sin espejo legacy. Los recursos con `archivo_local` se suben a Storage y se cambian a `url`. Falta decidir dónde se alojan.

**Filtros de la UI.** Tipo y naturaleza · habilidad (agrupada por grupo) · fase · categoría · nivel derivado o rango de dificultad · esfuerzo físico · minutos · jugadores disponibles (`jugadores_min` ≤ N; `jugadores_max` ≥ N o nulo) · material disponible (excluir lo que no tengo) · canastas · «con vídeo del ejercicio» (`tiene_video_exacto`) · «con pizarra» · idioma del vídeo · competitivo · momento de la sesión.

**Estadísticas.** Dos vistas:
- **Foco:** cuenta solo `habilidad_principal`, ponderada por los minutos asignados en sesiones.
- **Exposición:** principal y secundarias.
Se agregan por equipo, entrenador, club y periodo. La teoría solo cuenta en las estadísticas de «Aprender» (vistas por `tema_teoria`).

**Búsqueda semántica.** Embeddings sobre `texto_busqueda` (§9), recalculados en cada UPSERT. Se combinan con filtros duros (enums) antes del ranking por similitud.
