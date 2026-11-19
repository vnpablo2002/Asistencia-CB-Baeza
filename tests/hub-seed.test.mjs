import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cargarEsquema, combinar, fuentesPorDefecto, sqlSemilla, RECLASIFICADOS, EJEMPLOS } from '../scripts/seed-hub-v2.mjs';

const ejemplos = JSON.parse(readFileSync(new URL('./fixtures/hub-ejemplos-v2.json', import.meta.url), 'utf8'));

test('sin argumentos usa los 43 reclasificados si existen y completa con los ejemplos; si no, solo los ejemplos', () => {
  assert.deepEqual(fuentesPorDefecto(() => true), [RECLASIFICADOS, EJEMPLOS]);
  assert.deepEqual(fuentesPorDefecto(() => false), [EJEMPLOS]);
});

test('al combinar fuentes gana la primera ficha de cada slug', () => {
  const fichas = combinar([[{ slug: 'a', nombre: 'nuevo' }], [{ slug: 'a', nombre: 'viejo' }, { slug: 'b' }]]);
  assert.deepEqual(fichas, [{ slug: 'a', nombre: 'nuevo' }, { slug: 'b' }]);
  assert.throws(() => combinar([{}]), /lista de fichas/);
});

test('la semilla valida con el mismo esquema que el endpoint y escapa el SQL', () => {
  const H = cargarEsquema();
  const existentes = ['lee-la-mano', 'muerde-a-la-tercera', 'rooted', 'superar-defensor-puertas', 'pilla-pilla-botando'].map(s => [s, 'ejercicio']);
  const lote = H.validarLote(ejemplos, existentes);
  assert.equal(lote.rechazados.length, 0);
  assert.equal(H.validarLote([{ ...ejemplos[0], dificultad: 7 }], []).rechazados.length, 1);
  const fila = { ...lote.filas[0], nota: "Comilla ' simple" };
  const sql = sqlSemilla([fila]);
  assert.match(sql, /^SELECT public\.hub_v2_upsertar\('/);
  assert.match(sql, /Comilla '' simple/);
  assert.match(sql, /'::jsonb, 'semilla'\) AS resultado;\n$/);
});
