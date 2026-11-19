# Visión: hub de ejercicios (CB Baeza)

## Objetivo a largo plazo
Trainer Bot investiga y propone ejercicios nuevos cada día. Se recogen en un **hub de ejercicios** accesible desde la app de asistencia del CB Baeza para los entrenadores, y se guardan en Supabase.

Después, cada sesión de entreno tendrá su parte de **asistencia** y su parte de **contenido**, con los ejercicios del hub que el entrenador asigna a los jugadores.

Así habrá datos de qué se trabaja, y mejores estadísticas:
- **Equipo:** qué se trabaja.
- **Jugador:** según los días que asiste, qué trabaja más.
- **Entrenador:** a qué dedica más tiempo.
- **Club:** qué se trabaja en conjunto.

Los padres podrán ver qué se practica en cada entreno.

## Primer punto de control (esta rama)
1. Hub de ejercicios funcionando en la app Apps Script y persistido en Supabase (DEV).
2. Vía segura para que Trainer Bot añada cada día los ejercicios propuestos (endpoint Apps Script con token propio; sin rol «Agente» en el login todavía).
3. Semilla inicial: catálogo 1c1 (43 ejercicios) a partir de `ejercicios-1c1.json` y UI inspirada en `ejercicios-1c1-v2.html`.
4. Esta rama (`feature/hub-ejercicios`) no se mezcla en `develop` ni se despliega a PRO sin revisión explícita de Pablo.

## Fuera de alcance del primer punto de control
- Asignar ejercicios a una sesión concreta.
- Estadísticas de contenido / vistas de padres.
- Rol de usuario «Agente» en la pantalla de login.
- Supabase Storage para diagramas (v1 guarda URL/ruta; Storage después).
