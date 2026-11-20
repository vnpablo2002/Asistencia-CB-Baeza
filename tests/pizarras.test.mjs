import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validarSpec, parsearArgumentos } from '../scripts/pizarras/generar.mjs';

function ficha() {
  return {
    slug: 'pizarra-prueba', titulo: 'Pase <y> tiro & rebote', pista: 'media',
    paneles: [{ titulo: '1. Ejemplo', elementos: [
      { tipo: 'linea', estilo: 'bote', puntos: [[10, 20], [50, 30]] },
      { tipo: 'linea', estilo: 'tiro', puntos: [[50, 30], [50, 10]] },
      { tipo: 'linea', estilo: 'limite', puntos: [[0, 100], [100, 100]] },
      { tipo: 'ataque', x: 10, y: 20, numero: '1' },
      { tipo: 'defensa', x: 40, y: 30 }, { tipo: 'entrenador', x: 90, y: 50 },
      { tipo: 'cono', x: 5, y: 5 }, { tipo: 'balon', x: 15, y: 20 },
      { tipo: 'texto', x: 50, y: 90, texto: '¡Pase & tiro!' }
    ] }]
  };
}

test('valida contrato, coordenadas, tipos, trayectorias y nombre del archivo', () => {
  const spec = ficha();
  assert.equal(validarSpec(spec, 'pizarra-prueba'), spec);
  assert.throws(() => validarSpec(spec, 'otro'), /no coincide/);
  assert.throws(() => validarSpec({ ...spec, slug: '../fuera' }), /slug/);
  assert.throws(() => validarSpec({ ...spec, pista: 'otra' }), /pista/);
  assert.throws(() => validarSpec({ ...spec, paneles: [] }), /paneles/);
  assert.throws(() => validarSpec({ ...spec, paneles: [{ titulo: '1', elementos: [{ tipo: 'defensa', x: 101, y: 0 }] }] }), /entre 0 y 100/);
  assert.throws(() => validarSpec({ ...spec, paneles: [{ titulo: '1', elementos: [{ tipo: 'linea', estilo: 'pase', puntos: [[1, 2]] }] }] }), /al menos dos puntos/);
  assert.throws(() => validarSpec({ ...spec, paneles: [{ titulo: '1', elementos: [{ tipo: 'linea', estilo: 'otro', puntos: [[0, 0], [1, 1]] }] }] }), /línea desconocido/);
  assert.throws(() => validarSpec({ ...spec, titulo: 'Texto\u0000inválido' }), /XML/);
});

test('interpreta --out y slugs y rechaza rutas y opciones incorrectas', () => {
  assert.deepEqual(parsearArgumentos(['primero', '--out', 'imagenes', 'segundo']).slugs, ['primero', 'segundo']);
  assert.match(parsearArgumentos(['--out', 'imagenes']).salida, /imagenes$/);
  assert.throws(() => parsearArgumentos(['--out']), /Uso:/);
  assert.throws(() => parsearArgumentos(['../fuera']), /no válido/);
  assert.throws(() => parsearArgumentos(['a', 'a']), /repetido/);
});

test('CLI genera los archivos seleccionados y rechaza fichas inexistentes', () => {
  const salida = mkdtempSync(join(tmpdir(), 'pizarras-test-'));
  try {
    const ejecutar = (...args) => spawnSync(process.execPath, ['scripts/pizarras/generar.mjs', ...args], { encoding: 'utf8', timeout: 120000 });
    const seleccionado = ejecutar('--out', salida, 'rey-de-la-pista');
    assert.equal(seleccionado.status, 0, seleccionado.stderr);
    assert.equal(existsSync(join(salida, 'rey-de-la-pista.svg')), true);
    assert.equal(existsSync(join(salida, 'el-espejo.png')), false);
    const png = readFileSync(join(salida, 'rey-de-la-pista.png'));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1200);
    const desconocido = ejecutar('--out', salida, 'no-existe');
    assert.notEqual(desconocido.status, 0);
    assert.match(desconocido.stderr, /no-existe\.json/);
  } finally {
    rmSync(salida, { recursive: true, force: true });
  }
});
