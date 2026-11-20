# Generador de pizarras

Genera una pizarra SVG autónoma y su PNG a partir de cada especificación de `specs/<slug>.json`. Los dibujos son esquemáticos y la distribución de jugadores y trayectorias se define en cada JSON; no se copian imágenes de otras fuentes.

## Requisitos y ejecución

- Node.js 22 o posterior y dependencias instaladas con `npm ci`; `@resvg/resvg-js` genera los PNG sin navegador.

Desde la raíz del proyecto:

```sh
# Todas las especificaciones, en scripts/pizarras/salida/
node scripts/pizarras/generar.mjs

# Solo las indicadas, en el directorio elegido
node scripts/pizarras/generar.mjs --out /tmp/pizarras rey-de-la-pista el-espejo
```

La salida por defecto se resuelve respecto al generador; `--out` se resuelve respecto al directorio actual. Se crean `<slug>.svg` y `<slug>.png` y se reemplazan si ya existen. El SVG y el PNG tienen exactamente 1200 píxeles de ancho y la misma altura, determinada por el número de paneles y la pista; el programa comprueba las dimensiones del PNG. Si la rasterización falla, devuelve un error y un código de salida distinto de cero. El lote se valida antes de generar archivos, pero un fallo en una ficha posterior no elimina las ya generadas.

El SVG tiene fondo opaco, título y descripción accesible que enumera posiciones y trayectorias, además de leyenda visual. El PNG es una imagen rasterizada y no conserva la descripción accesible del SVG: al publicarlo debe acompañarse de texto alternativo apropiado. Los textos usan las fuentes sans-serif instaladas en el sistema, por lo que su apariencia puede variar ligeramente entre máquinas.

## Especificación

```json
{
  "slug": "ejemplo",
  "titulo": "Ejercicio de ejemplo",
  "pista": "media",
  "paneles": [
    {
      "titulo": "1. Pase y desplazamiento",
      "elementos": [
        { "tipo": "linea", "estilo": "pase", "puntos": [[30, 70], [60, 50]] },
        { "tipo": "ataque", "x": 30, "y": 70, "numero": "1" },
        { "tipo": "defensa", "x": 50, "y": 55 },
        { "tipo": "entrenador", "x": 80, "y": 80 },
        { "tipo": "cono", "x": 70, "y": 70 },
        { "tipo": "balon", "x": 34, "y": 70 },
        { "tipo": "texto", "x": 50, "y": 90, "texto": "Pase al compañero" }
      ]
    }
  ]
}
```

- El nombre del archivo y `slug` deben coincidir: solo letras minúsculas sin acentos, números y guiones entre palabras.
- `pista` es `media` o `completa`. La media pista tiene la canasta centrada arriba; la completa también tiene una canasta centrada abajo. Las marcas representan una pista FIBA de 15 × 28 m, sin sustituir un plano reglamentario acotado.
- Cada pizarra tiene de uno a tres paneles. Cada panel tiene título y su propia pista; numere los pasos en el título. Los elementos se dibujan en el orden del JSON, de atrás hacia delante.
- Las coordenadas `x`, `y` y los pares de `puntos` son números entre 0 y 100 relativos al rectángulo de la pista: `(0, 0)` es la esquina superior izquierda y `(100, 100)` la inferior derecha. En pista completa, el eje vertical abarca toda la pista.
- Los tipos puntuales son `ataque` (requiere `numero` como texto), `defensa`, `entrenador`, `cono`, `balon` y `texto` (requiere `texto`). Cada uno requiere `x` e `y`.
- Una `linea` requiere al menos dos puntos y un `estilo`: `movimiento` (continua), `bote` (ondulada), `pase` (discontinua), `tiro` o `limite`. Movimiento, bote y pase terminan en flecha; tiro lleva flecha doble; límite no lleva flecha. La leyenda se añade automáticamente.

El generador indica el archivo y la posición del campo si un JSON es inválido. Puede probarse con `node --test tests/pizarras.test.mjs`.
