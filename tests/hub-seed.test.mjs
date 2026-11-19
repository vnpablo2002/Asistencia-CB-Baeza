import test from 'node:test';
import assert from 'node:assert/strict';
import { leerImagenes, mapearEjercicios } from '../scripts/seed-hub-ejercicios.mjs';

const imagen = 'data:image/gif;base64,R0lGODlh';
const original = {
  id: 'ejercicio-1', name: 'Ejercicio', nameEn: 'Drill', date: '2026-11-19',
  source: 'Fuente', goal: 'Objetivo', how: 'Pasos', habilidades: ['bote', 'defensa'],
  formato: 'juego', oposicion: 'igualdad', organizacion: 'parejas', detalleCorto: true,
  claves: ['Uno', 'Dos'], easier: 'Fácil', harder: 'Difícil', note: 'Nota',
  links: [{ type: 'instagram', label: 'Reel', url: 'https://www.instagram.com/reel/123/' }],
  thumbYoutube: 'Cm34CsIixC4', thumbImage: 'espejo', material: ['conos']
};

test('la semilla conserva campos, relaciones y medios, con excepciones explícitas', () => {
  const imagenes = leerImagenes(`const IMAGES = ${JSON.stringify({ espejo: imagen })};\n`);
  const { ejercicios, avisos } = mapearEjercicios([original], imagenes);
  assert.deepEqual(ejercicios, [{
    slug: 'ejercicio-1', nombre: 'Ejercicio', nombre_en: 'Drill', fecha_enviado: '2026-11-19',
    fuente: 'Fuente', objetivo: 'Objetivo', como_se_hace: 'Pasos', claves: ['Uno', 'Dos'],
    version_facil: 'Fácil', version_dificil: 'Difícil', nota: 'Nota', formato: 'juego',
    oposicion: 'igualdad', organizacion: 'parejas', detalle_corto: true,
    habilidades: ['bote', 'defensa'], material: ['conos'],
    enlaces: [{ tipo: 'video', etiqueta: 'Reel', url: 'https://www.instagram.com/reel/123/', orden: 0 }],
    medios: [
      { tipo: 'gif', youtube_id: null, ruta_o_url: imagen, es_miniatura: true, orden: 0 },
      { tipo: 'youtube', youtube_id: 'Cm34CsIixC4', ruta_o_url: null, es_miniatura: false, orden: 1 }
    ], creado_por: 'trainer-bot'
  }]);
  assert.equal(avisos.length, 2);
});

test('rechaza valores desconocidos, slugs duplicados y medios que no se pueden conservar', () => {
  assert.throws(() => mapearEjercicios([{ ...original, formato: 'partido' }], { espejo: imagen }), /formato desconocido/);
  assert.throws(() => mapearEjercicios([original, original], { espejo: imagen }), /Identidad o fecha inválida/);
  assert.throws(() => mapearEjercicios([original], {}), /imagen espejo ausente/);
  assert.throws(() => mapearEjercicios([{ ...original, campoNuevo: 'no perder' }], { espejo: imagen }), /campos inesperados/);
});
