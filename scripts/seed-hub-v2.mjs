// Semilla v2 del hub, solo DEV: node scripts/seed-hub-v2.mjs [fichas.json ...]
// Sin argumentos carga /workspace/cbbaeza/hub/ejercicios-v2.json (si existe) y añade las fichas de ejemplos-v2.json
// cuyo slug no esté ya; si no existe, solo los ejemplos. Valida con src/HubEsquema.gs, el mismo código que el endpoint.
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const RECLASIFICADOS = '/workspace/cbbaeza/hub/ejercicios-v2.json';
export const EJEMPLOS = '/workspace/cbbaeza/hub/ejemplos-v2.json';

export function cargarEsquema() {
  const contexto = vm.createContext({});
  vm.runInContext(readFileSync(join(raiz, 'src/HubEsquema.gs'), 'utf8') + '\nthis.HubEsquema = HubEsquema;', contexto);
  return contexto.HubEsquema;
}

export function fuentesPorDefecto(existe = existsSync) {
  return existe(RECLASIFICADOS) ? [RECLASIFICADOS, EJEMPLOS] : [EJEMPLOS];
}

/** Une varias listas de fichas; ante el mismo slug gana la primera fuente. */
export function combinar(listas) {
  const vistos = new Set();
  const fichas = [];
  listas.forEach((lista, i) => {
    if (!Array.isArray(lista)) throw new Error(`La fuente ${i + 1} debe ser una lista de fichas.`);
    lista.forEach(ficha => {
      const slug = ficha && ficha.slug;
      if (typeof slug === 'string' && vistos.has(slug)) return;
      if (typeof slug === 'string') vistos.add(slug);
      fichas.push(ficha);
    });
  });
  return fichas;
}

export function sqlSemilla(filas) {
  return `SELECT public.hub_v2_upsertar('${JSON.stringify(filas).replaceAll("'", "''")}'::jsonb, 'semilla') AS resultado;\n`;
}

function sql(args) {
  const salida = spawnSync(process.execPath, [join(raiz, 'scripts/supabase-sql.mjs'), 'dev', ...args], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (salida.error) throw salida.error;
  if (salida.status !== 0) throw new Error(`Supabase DEV falló: ${salida.stderr.trim()}`);
  return JSON.parse(salida.stdout);
}

function main() {
  const fuentes = process.argv.slice(2).length ? process.argv.slice(2) : fuentesPorDefecto();
  const fichas = combinar(fuentes.map(ruta => JSON.parse(readFileSync(ruta, 'utf8'))));
  const existentes = sql(['--read-only', '--sql', 'SELECT slug, tipo_contenido FROM public.hub_contenidos']).map(f => [f.slug, f.tipo_contenido]);
  const lote = cargarEsquema().validarLote(fichas, existentes);
  console.log(`Fuentes: ${fuentes.join(', ')}. Fichas: ${fichas.length}; válidas: ${lote.filas.length}; rechazadas: ${lote.rechazados.length}.`);
  lote.rechazados.forEach(r => console.log(`RECHAZADA ${r.slug}: ${r.errores.join(' | ')}`));
  lote.avisos.forEach(a => console.log(`aviso ${a.slug}: ${a.avisos.join(' | ')}`));
  if (lote.filas.length) {
    const temporal = mkdtempSync(join(tmpdir(), 'cb-baeza-hub-v2-'));
    try {
      const archivo = join(temporal, 'semilla.sql');
      writeFileSync(archivo, sqlSemilla(lote.filas), { mode: 0o600 });
      const resultado = sql(['--file', archivo])[0].resultado;
      const cuenta = accion => resultado.filter(r => r.accion === accion).length;
      console.log(`Semilla DEV: ${cuenta('insertado')} insertadas, ${cuenta('actualizado')} actualizadas.`);
    } finally {
      rmSync(temporal, { recursive: true, force: true });
    }
  }
  if (lote.rechazados.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
