#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const DIRECTORIO = dirname(fileURLToPath(import.meta.url));
const SPECS = join(DIRECTORIO, 'specs');
const SALIDA = join(DIRECTORIO, 'salida');
const ANCHO = 1200;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ESTILOS = {
  movimiento: { color: '#1554a5', dash: '', etiqueta: 'Movimiento' },
  bote: { color: '#6b298c', dash: '', etiqueta: 'Bote' },
  pase: { color: '#a24a00', dash: '8 12', etiqueta: 'Pase' },
  tiro: { color: '#aa2626', dash: '', etiqueta: 'Tiro' },
  limite: { color: '#303c42', dash: '4 12', etiqueta: 'Límite' }
};

function objeto(valor, contexto) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error(`${contexto}: se esperaba un objeto.`);
}

function texto(valor, contexto) {
  if (typeof valor !== 'string' || !valor.trim()) throw new Error(`${contexto}: se esperaba texto no vacío.`);
  for (const caracter of valor) {
    const codigo = caracter.codePointAt(0);
    if ((codigo < 32 && codigo !== 9 && codigo !== 10 && codigo !== 13) ||
        (codigo >= 0xd800 && codigo <= 0xdfff) || codigo === 0xfffe || codigo === 0xffff) {
      throw new Error(`${contexto}: contiene caracteres que no admite XML.`);
    }
  }
}

function coordenada(valor, contexto) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > 100) {
    throw new Error(`${contexto}: debe ser un número entre 0 y 100.`);
  }
}

export function validarSpec(spec, nombreArchivo) {
  objeto(spec, 'Pizarra');
  if (typeof spec.slug !== 'string' || !SLUG.test(spec.slug)) throw new Error('slug: use letras minúsculas, números y guiones entre palabras.');
  if (nombreArchivo && spec.slug !== nombreArchivo) throw new Error(`slug: ${spec.slug} no coincide con el nombre del archivo ${nombreArchivo}.json.`);
  texto(spec.titulo, 'titulo');
  if (!['media', 'completa'].includes(spec.pista)) throw new Error('pista: debe ser media o completa.');
  if (!Array.isArray(spec.paneles) || spec.paneles.length < 1 || spec.paneles.length > 3) throw new Error('paneles: se requieren de uno a tres paneles.');
  spec.paneles.forEach((panel, i) => {
    const contexto = `paneles[${i}]`;
    objeto(panel, contexto);
    texto(panel.titulo, `${contexto}.titulo`);
    if (!Array.isArray(panel.elementos)) throw new Error(`${contexto}.elementos: se esperaba una lista.`);
    panel.elementos.forEach((elemento, j) => {
      const lugar = `${contexto}.elementos[${j}]`;
      objeto(elemento, lugar);
      if (elemento.tipo === 'linea') {
        if (!Object.hasOwn(ESTILOS, elemento.estilo)) throw new Error(`${lugar}.estilo: tipo de línea desconocido.`);
        if (!Array.isArray(elemento.puntos) || elemento.puntos.length < 2) throw new Error(`${lugar}.puntos: se necesitan al menos dos puntos.`);
        elemento.puntos.forEach((punto, k) => {
          if (!Array.isArray(punto) || punto.length !== 2) throw new Error(`${lugar}.puntos[${k}]: se esperaba [x, y].`);
          coordenada(punto[0], `${lugar}.puntos[${k}][0]`);
          coordenada(punto[1], `${lugar}.puntos[${k}][1]`);
        });
        if (elemento.puntos.every(p => p[0] === elemento.puntos[0][0] && p[1] === elemento.puntos[0][1])) {
          throw new Error(`${lugar}.puntos: la línea necesita al menos dos posiciones distintas.`);
        }
      } else {
        if (!['ataque', 'defensa', 'entrenador', 'cono', 'balon', 'texto'].includes(elemento.tipo)) throw new Error(`${lugar}.tipo: elemento desconocido.`);
        coordenada(elemento.x, `${lugar}.x`);
        coordenada(elemento.y, `${lugar}.y`);
        if (elemento.tipo === 'ataque') texto(elemento.numero, `${lugar}.numero`);
        if (elemento.tipo === 'texto') texto(elemento.texto, `${lugar}.texto`);
      }
    });
  });
  return spec;
}

function escapar(valor) {
  return String(valor).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

// El cálculo es conservador para la tipografía sans-serif y también divide palabras largas.
function partir(cadena, maximo) {
  const palabras = cadena.trim().split(/\s+/u);
  const resultado = [];
  let linea = '';
  for (const palabra of palabras) {
    let caracteres = Array.from(palabra);
    while (caracteres.length > maximo) {
      if (linea) { resultado.push(linea); linea = ''; }
      resultado.push(caracteres.slice(0, maximo).join(''));
      caracteres = caracteres.slice(maximo);
    }
    const resto = caracteres.join('');
    if (linea && Array.from(linea + ' ' + resto).length > maximo) { resultado.push(linea); linea = ''; }
    linea += (linea ? ' ' : '') + resto;
  }
  if (linea) resultado.push(linea);
  return resultado;
}

function textoLineas(lineas, x, y, clase, paso, ancla = 'start') {
  return `<text class="${clase}" x="${x}" y="${y}" text-anchor="${ancla}">${lineas.map((linea, i) => `<tspan x="${x}" dy="${i ? paso : 0}">${escapar(linea)}</tspan>`).join('')}</text>`;
}

// Medidas FIBA en centímetros: pista 15 × 28 m, aro a 1,575 m de la línea de fondo.
function marcasCanasta() {
  return `<path d="M505 0V580H995V0 M505 580H995"/>
    <path d="M570 580A180 180 0 0 0 930 580"/>
    <path d="M570 580A180 180 0 0 1 930 580" stroke-dasharray="18 12"/>
    <path d="M90 0V299.01A675 675 0 0 0 1410 299.01V0"/>
    <path d="M625 157.5A125 125 0 0 0 875 157.5"/>
    <path d="M660 120H840" stroke-width="9"/>
    <circle cx="750" cy="157.5" r="22.5" stroke-width="7"/>`;
}

function pista(completa) {
  const alto = completa ? 2800 : 1400;
  const marcas = marcasCanasta();
  return `<svg x="0" y="0" width="1500" height="${alto}" viewBox="0 0 1500 ${alto}" overflow="hidden">
    <rect x="0" y="0" width="1500" height="${alto}" fill="#f4e3c9"/>
    <g fill="none" stroke="#756b5e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="0" y="0" width="1500" height="${alto}"/>
      ${marcas}
      ${completa ? `<g transform="translate(1500 2800) rotate(180)">${marcas}</g>` : ''}
      <path d="M0 1400H1500"/>
      <circle cx="750" cy="1400" r="180"/>
    </g></svg>`;
}

function simbolo(tipo, x, y, numero = '') {
  let figura;
  if (tipo === 'ataque') {
    const tamano = Math.max(12, Math.min(42, 63 / Array.from(numero).length));
    figura = `<circle r="37" fill="#174e8c" stroke="#fff" stroke-width="5"/><text text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="${tamano}" font-weight="700">${escapar(numero)}</text>`;
  } else if (tipo === 'defensa') {
    figura = '<path d="M0 -43L43 0 0 43 -43 0Z" fill="#a52032" stroke="#fff" stroke-width="5"/><path d="M-16 -16L16 16M16 -16L-16 16" stroke="#fff" stroke-width="7" stroke-linecap="round"/>';
  } else if (tipo === 'entrenador') {
    figura = '<rect x="-38" y="-38" width="76" height="76" rx="13" fill="#176553" stroke="#fff" stroke-width="5"/><text text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="44" font-weight="700">E</text>';
  } else if (tipo === 'cono') {
    figura = '<path d="M0 -42L36 31H-36Z" fill="#dc6916" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><path d="M-25 34H25" stroke="#8c3d06" stroke-width="7" stroke-linecap="round"/>';
  } else {
    figura = '<circle r="27" fill="#ef9a3b" stroke="#64300d" stroke-width="5"/><path d="M-27 0H27M0 -27V27M-19 -19C3 -10 10 -3 19 19M19 -19C-3 -10 -10 -3 -19 19" fill="none" stroke="#64300d" stroke-width="3"/>';
  }
  return `<g transform="translate(${x} ${y})">${figura}</g>`;
}

// Ondulación perpendicular a cada tramo, conservando sus extremos y su dirección.
function onda(puntos, amplitud, paso) {
  let d = `M${puntos[0][0]},${puntos[0][1]}`;
  for (let i = 1; i < puntos.length; i++) {
    const [x0, y0] = puntos[i - 1];
    const [x1, y1] = puntos[i];
    const distancia = Math.hypot(x1 - x0, y1 - y0);
    if (!distancia) continue;
    const partes = Math.max(2, Math.ceil(distancia / paso));
    for (let j = 0; j < partes; j++) {
      const medio = (j + 0.5) / partes;
      const fin = (j + 1) / partes;
      const desvio = (j % 2 ? -1 : 1) * amplitud;
      d += ` Q${x0 + (x1 - x0) * medio - (y1 - y0) / distancia * desvio},${y0 + (y1 - y0) * medio + (x1 - x0) / distancia * desvio} ${x0 + (x1 - x0) * fin},${y0 + (y1 - y0) * fin}`;
    }
  }
  return d;
}

function linea(elemento, anchoPista, altoPista) {
  const estilo = ESTILOS[elemento.estilo];
  const puntos = elemento.puntos.map(([x, y]) => [x * anchoPista / 100, y * altoPista / 100]);
  const flecha = elemento.estilo === 'limite' ? '' : ` marker-end="url(#flecha-${elemento.estilo})"`;
  const figura = elemento.estilo === 'bote'
    ? `<path d="${onda(puntos, 25, 45)}"`
    : `<polyline points="${puntos.map(p => p.join(',')).join(' ')}"`;
  return `${figura} fill="none" stroke="${estilo.color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"${estilo.dash ? ` stroke-dasharray="${estilo.dash}"` : ''}${flecha}/>`;
}

function elementoSvg(elemento, altoPista) {
  if (elemento.tipo === 'linea') return linea(elemento, 1500, altoPista);
  const x = elemento.x * 15;
  const y = elemento.y * altoPista / 100;
  if (elemento.tipo !== 'texto') return simbolo(elemento.tipo, x, y, elemento.numero);
  const ancla = elemento.x < 25 ? 'start' : elemento.x > 75 ? 'end' : 'middle';
  const lineas = partir(elemento.texto, 28);
  const yTexto = Math.max(42, Math.min(y, altoPista - 10 - (lineas.length - 1) * 49));
  return textoLineas(lineas, x, yTexto, 'anotacion', 49, ancla);
}

function leyenda(x, y) {
  const simbolos = [
    ['ataque', 'Atacante', '1'], ['defensa', 'Defensor', ''], ['entrenador', 'Entrenador', ''],
    ['cono', 'Cono', ''], ['balon', 'Balón', '']
  ];
  const entradas = simbolos.map(([tipo, etiqueta, numero]) => ({ tipo, etiqueta, numero }))
    .concat(Object.keys(ESTILOS).map(tipo => ({ tipo, etiqueta: ESTILOS[tipo].etiqueta, esLinea: true })));
  return entradas.map((entrada, i) => {
    const px = x + (i % 5) * 215;
    const py = y + Math.floor(i / 5) * 45;
    let figura;
    if (entrada.esLinea) {
      const e = ESTILOS[entrada.tipo];
      const forma = entrada.tipo === 'bote' ? `<path d="${onda([[0, 0], [42, 0]], 4, 8)}" fill="none"` : '<line x1="0" y1="0" x2="42" y2="0"';
      figura = `${forma} stroke="${e.color}" stroke-width="3"${e.dash ? ` stroke-dasharray="${e.dash.split(' ').map(n => Number(n) / 3).join(' ')}"` : ''}${entrada.tipo === 'limite' ? '' : ` marker-end="url(#flecha-${entrada.tipo}-leyenda)"`}/>`;
    } else figura = `<g transform="translate(19 0) scale(.31)">${simbolo(entrada.tipo, 0, 0, entrada.numero)}</g>`;
    return `<g transform="translate(${px} ${py})">${figura}<text x="52" y="6" class="leyenda">${escapar(entrada.etiqueta)}</text></g>`;
  }).join('');
}

function describirElemento(elemento) {
  if (elemento.tipo === 'linea') {
    const puntos = elemento.puntos.map(([x, y]) => `${x}, ${y}`).join(' a ');
    return `${ESTILOS[elemento.estilo].etiqueta} por ${puntos}`;
  }
  const nombres = { ataque: 'Atacante', defensa: 'Defensor', entrenador: 'Entrenador', cono: 'Cono', balon: 'Balón', texto: 'Texto' };
  const contenido = elemento.tipo === 'ataque' ? ` ${elemento.numero}` : elemento.tipo === 'texto' ? ` «${elemento.texto}»` : '';
  return `${nombres[elemento.tipo]}${contenido} en ${elemento.x}, ${elemento.y}`;
}

export function renderizarSvg(spec) {
  validarSpec(spec);
  const completa = spec.pista === 'completa';
  const altoPista = completa ? 2800 : 1400;
  const columnas = spec.paneles.length === 1 ? 1 : 2;
  const margen = 52;
  const separacion = 20;
  const anchoPanel = (ANCHO - margen * 2 - separacion * (columnas - 1)) / columnas;
  const anchoPista = anchoPanel - 48;
  const altoPistaPx = anchoPista * altoPista / 1500;
  const titulo = partir(spec.titulo, 54);
  const titulosPanel = spec.paneles.map(panel => partir(panel.titulo, Math.floor((anchoPanel - 48) / 15)));
  const altoTituloPanel = Math.max(...titulosPanel.map(lineas => lineas.length)) * 30;
  const altoPanel = 24 + altoTituloPanel + 18 + altoPistaPx + 28;
  const inicioPaneles = 60 + titulo.length * 44;
  const filas = Math.ceil(spec.paneles.length / columnas);
  const inicioLeyenda = inicioPaneles + filas * altoPanel + (filas - 1) * separacion + 60;
  const alto = Math.ceil(inicioLeyenda + 133);
  const descripcion = `Pizarra de ${spec.pista === 'media' ? 'media pista' : 'pista completa'}. Coordenadas de 0 a 100 desde la esquina superior izquierda de cada pista. ${spec.paneles.map(p => `${p.titulo}: ${p.elementos.map(describirElemento).join('; ')}.`).join(' ')}`;
  const paneles = spec.paneles.map((panel, i) => {
    const fila = Math.floor(i / columnas);
    // Si sobra un único panel en la última fila, se centra.
    const x = spec.paneles.length === 3 && i === 2 ? (ANCHO - anchoPanel) / 2 : margen + (i % columnas) * (anchoPanel + separacion);
    const y = inicioPaneles + fila * (altoPanel + separacion);
    const yPista = y + 24 + altoTituloPanel + 18;
    return `<g>
      <rect x="${x}" y="${y}" width="${anchoPanel}" height="${altoPanel}" rx="12" fill="#fff" stroke="#d8d1c6" stroke-width="2"/>
      ${textoLineas(titulosPanel[i], x + 24, y + 46, 'panel-titulo', 30)}
      <svg x="${x + 24}" y="${yPista}" width="${anchoPista}" height="${altoPistaPx}" viewBox="0 0 1500 ${altoPista}" overflow="visible">
        ${pista(completa)}
        ${panel.elementos.map(e => elementoSvg(e, altoPista)).join('\n')}
      </svg>
    </g>`;
  }).join('\n');
  return { ancho: ANCHO, alto, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${alto}" viewBox="0 0 ${ANCHO} ${alto}" role="img" aria-labelledby="titulo descripcion">
  <title id="titulo">${escapar(spec.titulo)}</title><desc id="descripcion">${escapar(descripcion)}</desc>
  <defs>
    ${['movimiento', 'bote', 'pase', 'tiro'].map(tipo => {
      const doble = tipo === 'tiro';
      const ancho = doble ? 50 : 32;
      const ref = doble ? 47 : 29;
      const dibujo = doble ? 'M2 2L21 12L2 22M23 2L47 12L23 22' : 'M2 2L29 12L2 22';
      return ['', '-leyenda'].map(sufijo => `<marker id="flecha-${tipo}${sufijo}" viewBox="0 0 ${ancho} 24" refX="${ref}" refY="12" markerWidth="${sufijo ? (doble ? 17 : 11) : ancho}" markerHeight="${sufijo ? 8 : 24}" markerUnits="userSpaceOnUse" orient="auto"><path d="${dibujo}" fill="none" stroke="${ESTILOS[tipo].color}" stroke-width="5" stroke-linejoin="round"/></marker>`).join('');
    }).join('')}
  </defs>
  <style>text { font-family: Arial, Helvetica, sans-serif; } .titulo { fill:#17232c; font-size:36px; font-weight:700; } .panel-titulo { fill:#17232c; font-size:25px; font-weight:700; } .anotacion { fill:#17232c; stroke:#fff; stroke-width:10px; stroke-linejoin:round; paint-order:stroke; font-size:42px; font-weight:700; } .leyenda { fill:#17232c; font-size:18px; } .leyenda-titulo { fill:#17232c; font-size:23px; font-weight:700; }</style>
  <rect width="100%" height="100%" fill="#f5f2eb"/>
  ${textoLineas(titulo, margen, 54, 'titulo', 44)}
  ${paneles}
  <text x="${margen}" y="${inicioLeyenda}" class="leyenda-titulo">Leyenda</text>
  ${leyenda(margen, inicioLeyenda + 34)}
</svg>\n` };
}

export function parsearArgumentos(args) {
  let salida = SALIDA;
  let salidaIndicada = false;
  const slugs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') {
      if (salidaIndicada || !args[i + 1] || args[i + 1].startsWith('-')) throw new Error('Uso: node scripts/pizarras/generar.mjs [--out DIR] [slug ...]');
      salida = resolve(args[++i]);
      salidaIndicada = true;
    } else {
      if (!SLUG.test(args[i])) throw new Error(`Slug u opción no válido: ${args[i]}.`);
      if (slugs.includes(args[i])) throw new Error(`Slug repetido: ${args[i]}.`);
      slugs.push(args[i]);
    }
  }
  return { salida, slugs };
}

function cargarSpec(slug) {
  const ruta = join(SPECS, `${slug}.json`);
  try {
    return validarSpec(JSON.parse(readFileSync(ruta, 'utf8')), slug);
  } catch (error) {
    throw new Error(`${ruta}: ${error.message}`);
  }
}

function rasterizar(pizarra, slug) {
  let png;
  try {
    png = new Resvg(pizarra.svg, { fitTo: { mode: 'width', value: ANCHO } }).render().asPng();
  } catch (error) {
    throw new Error(`No se pudo rasterizar ${slug}: ${error.message}`);
  }
  if (png.length < 24 || !png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ||
      png.readUInt32BE(16) !== pizarra.ancho || png.readUInt32BE(20) !== pizarra.alto) {
    throw new Error(`PNG de ${slug} con dimensiones inesperadas; se requieren ${pizarra.ancho} × ${pizarra.alto} píxeles.`);
  }
  return png;
}

function main() {
  const { salida, slugs } = parsearArgumentos(process.argv.slice(2));
  const seleccion = slugs.length ? slugs : readdirSync(SPECS).filter(nombre => nombre.endsWith('.json')).map(nombre => nombre.slice(0, -5)).sort();
  if (!seleccion.length) throw new Error(`No hay especificaciones JSON en ${SPECS}.`);
  // Validar el lote antes de escribir ningún resultado.
  const pizarras = seleccion.map(slug => {
    if (!SLUG.test(slug)) throw new Error(`Nombre de especificación no válido: ${slug}.json.`);
    return { slug, ...renderizarSvg(cargarSpec(slug)) };
  });
  mkdirSync(salida, { recursive: true });
  for (const pizarra of pizarras) {
    const png = rasterizar(pizarra, pizarra.slug);
    writeFileSync(join(salida, `${pizarra.slug}.svg`), pizarra.svg);
    writeFileSync(join(salida, `${pizarra.slug}.png`), png);
    console.log(`${pizarra.slug}: ${pizarra.ancho} × ${pizarra.alto} px → ${salida}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(`Error al generar pizarras: ${error.message}`); process.exitCode = 1; }
}
