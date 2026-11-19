// Catálogo inicial solo DEV: node scripts/seed-hub-ejercicios.mjs [ejercicios.json] [catalogo.html]
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const campos = ['id', 'name', 'nameEn', 'date', 'source', 'goal', 'how', 'habilidades', 'formato', 'oposicion', 'organizacion', 'detalleCorto', 'claves', 'easier', 'harder', 'note', 'links', 'thumbYoutube', 'thumbImage', 'material'];
const opciones = {
  formato: ['analitico', 'juego'],
  oposicion: ['sin-oposicion', 'limitada', 'ventaja', 'igualdad', 'desventaja'],
  organizacion: ['parejas', 'filas', 'grupo'],
  habilidades: ['bote', 'proteccion', 'salida', 'finalizacion', 'lectura', 'cambio-ritmo', 'desmarque', 'defensa', 'transicion', 'rebote'],
  material: ['conos', 'petos', 'churro']
};

export function leerImagenes(html) {
  const match = html.match(/^const IMAGES = (\{.*\});$/m);
  if (!match) throw new Error('No se encontró el objeto IMAGES en el HTML original.');
  return JSON.parse(match[1]);
}

export function mapearEjercicios(origen, imagenes) {
  if (!Array.isArray(origen) || !origen.length) throw new Error('El catálogo debe ser una lista no vacía.');
  const avisos = [];
  const vistos = new Set();
  const ejercicios = origen.map((d) => {
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Ejercicio inválido.');
    const inesperados = Object.keys(d).filter(k => !campos.includes(k));
    const faltantes = campos.filter(k => !Object.hasOwn(d, k));
    if (inesperados.length || faltantes.length) throw new Error(`${d.id}: campos inesperados ${inesperados} o ausentes ${faltantes}.`);
    for (const k of ['id', 'name', 'nameEn', 'date', 'source', 'goal', 'how', 'easier', 'harder', 'note', 'thumbYoutube', 'thumbImage']) {
      if (typeof d[k] !== 'string') throw new Error(`${d.id}: ${k} no es texto.`);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.id) || vistos.has(d.id) || !d.name || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw new Error(`Identidad o fecha inválida: ${d.id}.`);
    vistos.add(d.id);
    for (const k of ['formato', 'oposicion', 'organizacion']) if (!opciones[k].includes(d[k])) throw new Error(`${d.id}: ${k} desconocido: ${d[k]}.`);
    for (const k of ['habilidades', 'material']) {
      if (!Array.isArray(d[k]) || d[k].some(v => !opciones[k].includes(v)) || new Set(d[k]).size !== d[k].length) throw new Error(`${d.id}: ${k} inválido.`);
    }
    if (!Array.isArray(d.claves) || d.claves.some(v => typeof v !== 'string') || typeof d.detalleCorto !== 'boolean' || !Array.isArray(d.links)) throw new Error(`${d.id}: claves, detalle o enlaces inválidos.`);
    const enlaces = d.links.map((link, orden) => {
      if (!link || Object.keys(link).some(k => !['type', 'label', 'url'].includes(k)) || !['video', 'diagrama', 'fuente', 'instagram'].includes(link.type) || typeof link.label !== 'string' || typeof link.url !== 'string' || !link.url.startsWith('https://')) throw new Error(`${d.id}: enlace inválido.`);
      if (link.type === 'instagram') avisos.push(`${d.id}: enlace instagram → video; URL y etiqueta conservadas.`);
      return { tipo: link.type === 'instagram' ? 'video' : link.type, etiqueta: link.label, url: link.url, orden };
    });
    const medios = [];
    if (d.thumbImage) {
      const img = imagenes[d.thumbImage];
      if (typeof img !== 'string' || !/^data:image\/(gif|png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(img)) throw new Error(`${d.id}: imagen ${d.thumbImage} ausente o inválida.`);
      medios.push({ tipo: img.startsWith('data:image/gif;') ? 'gif' : 'imagen', youtube_id: null, ruta_o_url: img, es_miniatura: true, orden: medios.length });
    }
    if (d.thumbYoutube) {
      if (!/^[A-Za-z0-9_-]{11}$/.test(d.thumbYoutube)) throw new Error(`${d.id}: ID YouTube inválido.`);
      medios.push({ tipo: 'youtube', youtube_id: d.thumbYoutube, ruta_o_url: null, es_miniatura: !d.thumbImage, orden: medios.length });
      if (d.thumbImage) avisos.push(`${d.id}: se conserva imagen y YouTube; la imagen es la miniatura original.`);
    }
    return {
      slug: d.id, nombre: d.name, nombre_en: d.nameEn, fecha_enviado: d.date,
      fuente: d.source, objetivo: d.goal, como_se_hace: d.how, claves: d.claves,
      version_facil: d.easier, version_dificil: d.harder, nota: d.note,
      formato: d.formato, oposicion: d.oposicion, organizacion: d.organizacion,
      detalle_corto: d.detalleCorto, habilidades: d.habilidades, material: d.material,
      enlaces, medios, creado_por: 'trainer-bot'
    };
  });
  return { ejercicios, avisos };
}

function main() {
  const [json = '/workspace/trainer/ejercicios-1c1.json', html = '/workspace/trainer/ejercicios-1c1-v2.html', ...otros] = process.argv.slice(2);
  if (otros.length) throw new Error('Uso: node scripts/seed-hub-ejercicios.mjs [ejercicios.json] [catalogo.html]');
  const { ejercicios, avisos } = mapearEjercicios(JSON.parse(readFileSync(json, 'utf8')), leerImagenes(readFileSync(html, 'utf8')));
  const temp = mkdtempSync(join(tmpdir(), 'cb-baeza-hub-'));
  try {
    const sql = join(temp, 'seed.sql');
    const payload = JSON.stringify(ejercicios).replaceAll("'", "''");
    writeFileSync(sql, `SELECT public.hub_upsert_ejercicios('${payload}'::jsonb);\n`, { mode: 0o600 });
    const resultado = spawnSync(process.execPath, ['scripts/supabase-sql.mjs', 'dev', '--file', sql], { stdio: 'inherit' });
    if (resultado.error) throw resultado.error;
    if (resultado.status !== 0) throw new Error(`Falló la semilla DEV (${resultado.status}).`);
    console.log(`Semilla DEV: ${ejercicios.length} ejercicios. Excepciones:\n${avisos.join('\n')}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
