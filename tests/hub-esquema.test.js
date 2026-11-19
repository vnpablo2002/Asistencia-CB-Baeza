const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/HubEsquema.gs'), 'utf8') + '\nthis.HubEsquema = HubEsquema;', context);
const H = context.HubEsquema;
const EJEMPLOS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/hub-ejemplos-v2.json'), 'utf8'));
// Ejercicios del catálogo a los que apuntan la progresión y la sesión de ejemplo.
const EXISTENTES = ['lee-la-mano', 'muerde-a-la-tercera', 'rooted', 'superar-defensor-puertas', 'pilla-pilla-botando'].map(s => [s, 'ejercicio']);
const ejemplo = slug => JSON.parse(JSON.stringify(EJEMPLOS.find(f => f.slug === slug)));
const plano = v => JSON.parse(JSON.stringify(v));
const tipos = (extra = []) => new Map(EXISTENTES.concat(EJEMPLOS.map(f => [f.slug, f.tipo_contenido]), extra));
const errores = (ficha, mapa = tipos()) => plano(H.validar(ficha, mapa).errores);
const rechaza = (ficha, patron, mapa) => {
  const lista = errores(ficha, mapa);
  assert.ok(lista.some(e => patron.test(e)), `se esperaba ${patron} y llegó ${JSON.stringify(lista)}`);
};
const ESPECIALISTAS = 'especialistas';

test('los cinco ejemplos del esquema son válidos en un mismo lote y conservan sus avisos', () => {
  const lote = H.validarLote(EJEMPLOS, EXISTENTES);
  assert.deepEqual(plano(lote.rechazados), []);
  assert.deepEqual(plano(lote.filas.map(f => f.slug)).sort(), EJEMPLOS.map(f => f.slug).sort());
  const rey = lote.avisos.find(a => a.slug === 'rey-de-la-pista');
  assert.ok(rey.avisos.some(a => /pendiente de subir/.test(a)));
  assert.deepEqual(plano(lote.filas.find(f => f.slug === 'rey-de-la-pista').avisos), plano(rey.avisos));
});

test('un payload v1 o de otra versión se rechaza con un mensaje claro', () => {
  const v1 = { slug: 'viejo', nombre: 'Viejo', formato: 'juego', habilidades: ['bote'] };
  assert.match(errores(v1)[0], /v1.*version_esquema: 2/);
  assert.match(errores({ ...ejemplo(ESPECIALISTAS), version_esquema: 1 })[0], /version_esquema debe ser 2/);
  assert.match(errores({ ...ejemplo(ESPECIALISTAS), tipo_contenido: 'juego' })[0], /tipo_contenido/);
});

test('§11.1 reglas 2 y 3: claves desconocidas, derivadas, no aplicables y obligatorias del tipo', () => {
  rechaza({ ...ejemplo(ESPECIALISTAS), habilidad_secundarias: ['bote'] }, /Clave desconocida: habilidad_secundarias/);
  rechaza({ ...ejemplo(ESPECIALISTAS), area: 'tecnica_individual' }, /area es un campo derivado/);
  rechaza({ ...ejemplo(ESPECIALISTAS), texto_busqueda: 'x' }, /texto_busqueda es un campo derivado/);
  rechaza({ ...ejemplo(ESPECIALISTAS), pasos: [] }, /pasos no aplica a ejercicio/);
  rechaza({ ...ejemplo('tres-fases-del-ataque-film-room'), esfuerzo_fisico: 2 }, /esfuerzo_fisico no aplica a teoria/);
  rechaza({ ...ejemplo('progresion-leer-al-defensor-con-bote'), minutos_min: 10 }, /minutos_min no aplica a progresion/);
  const sinNaturaleza = ejemplo(ESPECIALISTAS); delete sinNaturaleza.naturaleza;
  rechaza(sinNaturaleza, /Falta naturaleza/);
  const sinMaterial = ejemplo(ESPECIALISTAS); delete sinMaterial.material;
  rechaza(sinMaterial, /Falta material/);
  const sinIdeas = ejemplo('tres-fases-del-ataque-film-room'); delete sinIdeas.ideas_principales;
  rechaza(sinIdeas, /Falta ideas_principales/);
  const teoriaSoloTexto = { ...ejemplo('tres-fases-del-ataque-film-room'), recursos: [] };
  delete teoriaSoloTexto.descripcion; delete teoriaSoloTexto.minutos_clave;
  rechaza(teoriaSoloTexto, /descripcion es obligatoria en una teoria sin recursos/);
  // material vacío es válido: nada más que balones.
  assert.deepEqual(errores({ ...ejemplo(ESPECIALISTAS), material: [] }), []);
});

test('§11.1 reglas 4 y 5: vocabularios, tipos, rangos, longitudes, fechas y slug', () => {
  rechaza({ ...ejemplo(ESPECIALISTAS), categorias: ['alevin'] }, /categorias: valor fuera de vocabulario/);
  rechaza({ ...ejemplo(ESPECIALISTAS), material: ['conos', 'balones'] }, /material: valor fuera/);
  rechaza({ ...ejemplo(ESPECIALISTAS), dificultad: 6 }, /dificultad debe ser un entero entre 1 y 5/);
  rechaza({ ...ejemplo(ESPECIALISTAS), carga_cognitiva: 2.5 }, /carga_cognitiva debe ser un entero/);
  rechaza({ ...ejemplo(ESPECIALISTAS), nombre: 'x'.repeat(81) }, /nombre supera 80/);
  rechaza({ ...ejemplo(ESPECIALISTAS), fecha_enviado: '2026-02-30' }, /fecha_enviado debe ser una fecha/);
  rechaza({ ...ejemplo(ESPECIALISTAS), slug: 'Con_Mayusculas' }, /slug no cumple/);
  rechaza({ ...ejemplo(ESPECIALISTAS), competitivo: 'no' }, /competitivo debe ser true o false/);
  rechaza({ ...ejemplo(ESPECIALISTAS), momento_sesion: [] }, /Falta momento_sesion/);
  rechaza({ ...ejemplo(ESPECIALISTAS), puntos_clave: ['a', 'b', 'c', 'd', 'e', 'f'] }, /puntos_clave debe tener entre 0 y 5/);
});

test('§11.1 regla 6: habilidades secundarias', () => {
  rechaza({ ...ejemplo(ESPECIALISTAS), habilidades_secundarias: ['bote', 'pase', 'fintas', 'salto'] }, /habilidades_secundarias debe tener entre 0 y 3/);
  rechaza({ ...ejemplo(ESPECIALISTAS), habilidades_secundarias: ['bote', 'bote'] }, /repetidos/);
  rechaza({ ...ejemplo(ESPECIALISTAS), habilidades_secundarias: ['cambio_mano'] }, /no puede incluir la habilidad principal/);
  const sinPrincipal = { ...ejemplo('sesion-bote-y-lectura-1c1-infantil'), habilidades_secundarias: ['bote'] };
  delete sinPrincipal.habilidad_principal;
  rechaza(sinPrincipal, /requiere habilidad_principal/);
});

test('§11.1 regla 7: recursos', () => {
  const recurso = cambios => ({ ...ejemplo(ESPECIALISTAS), recursos: [{ ...ejemplo(ESPECIALISTAS).recursos[0], ...cambios }] });
  rechaza({ ...ejemplo(ESPECIALISTAS), recursos: Array.from({ length: 7 }, (_, i) => ({ ...ejemplo(ESPECIALISTAS).recursos[0], url: 'https://youtu.be/BJbJ_skvxN' + i, principal: i === 0 })) }, /recursos debe tener entre 0 y 6/);
  rechaza(recurso({ url: undefined }), /exactamente uno de url o archivo_local/);
  rechaza(recurso({ archivo_local: '/workspace/a.png' }), /exactamente uno de url o archivo_local/);
  rechaza(recurso({ url: 'http://www.youtube.com/watch?v=BJbJ_skvxNs' }), /https válida/);
  rechaza(recurso({ url: 'https://vimeo.com/123' }), /no cuadra con video_youtube/);
  rechaza(recurso({ tipo_recurso: 'video_otro' }), /no cuadra con video_otro/);
  rechaza(recurso({ url: 'https://www.youtube.com/watch?v=BJbJ_skvxNs&t=140' }), /no llevan t= ni start=/);
  rechaza({ ...ejemplo('rey-de-la-pista'), recursos: [{ ...ejemplo('rey-de-la-pista').recursos[0], archivo_local: '/tmp/x.png' }] }, /bajo \/workspace\//);
  rechaza(recurso({ url: undefined, archivo_local: '/workspace/v.mp4' }), /archivo_local solo se admite/);
  rechaza({ ...ejemplo('rey-de-la-pista'), recursos: [{ ...ejemplo('rey-de-la-pista').recursos[1], principal: true, duracion_seg: 60 }] }, /duracion_seg solo aplica a vídeos/);
  rechaza(recurso({ inicio_seg: 200, fin_seg: 140 }), /inicio_seg debe ser menor que fin_seg/);
  rechaza(recurso({ fin_seg: 900 }), /fin_seg supera duracion_seg/);
  const repetido = ejemplo(ESPECIALISTAS);
  repetido.recursos.push({ ...repetido.recursos[0], principal: false });
  rechaza(repetido, /url repetida/);
  rechaza(recurso({ principal: false }), /exactamente un recurso con principal: true \(hay 0\)/);
});

test('§11.1 regla 8: coherencia de oposición, situación numérica, minutos y jugadores', () => {
  rechaza({ ...ejemplo(ESPECIALISTAS), oposicion: 'real' }, /1c0 \(sin defensores\) exige oposicion/);
  rechaza({ ...ejemplo('rey-de-la-pista'), oposicion: 'sin_oposicion' }, /no puede ser sin_oposicion/);
  rechaza({ ...ejemplo(ESPECIALISTAS), ventaja_inicial: 'ataque' }, /ventaja_inicial debe ser ninguna/);
  rechaza({ ...ejemplo(ESPECIALISTAS), minutos_min: 20, minutos_max: 10 }, /minutos_min no puede superar/);
  rechaza({ ...ejemplo(ESPECIALISTAS), jugadores_min: 10, jugadores_max: 4 }, /jugadores_max no puede ser menor/);
  assert.deepEqual(errores({ ...ejemplo(ESPECIALISTAS), jugadores_max: null }), []);
});

test('§11.1 regla 9: fase de juego obligatoria salvo áreas física y mental', () => {
  rechaza({ ...ejemplo(ESPECIALISTAS), fase_juego: [] }, /fase_juego necesita al menos una fase/);
  assert.deepEqual(errores({ ...ejemplo(ESPECIALISTAS), habilidad_principal: 'agilidad', habilidades_secundarias: [], fase_juego: [] }), []);
  assert.deepEqual(errores({ ...ejemplo(ESPECIALISTAS), habilidad_principal: 'cooperacion', habilidades_secundarias: [], fase_juego: [] }), []);
});

test('§11.1 regla 10: ideas y capítulos de la teoría', () => {
  const teoria = () => ejemplo('tres-fases-del-ataque-film-room');
  rechaza({ ...teoria(), ideas_principales: ['a', 'b'] }, /ideas_principales debe tener entre 3 y 7/);
  rechaza({ ...teoria(), ideas_principales: Array(8).fill('idea') }, /ideas_principales debe tener entre 3 y 7/);
  rechaza({ ...teoria(), minutos_clave: [{ seg: 125, tema: 'b' }, { seg: 42, tema: 'a' }] }, /orden ascendente/);
  rechaza({ ...teoria(), minutos_clave: [{ seg: 1000, tema: 'fuera' }] }, /supera la duración del vídeo principal/);
  rechaza({ ...teoria(), recursos: [{ tipo_recurso: 'articulo_web', url: 'https://example.com/a', etiqueta: 'A', idioma: 'en', relacion: 'exacto', principal: true }] }, /minutos_clave requiere que el recurso principal sea un vídeo/);
});

test('§11.1 reglas 11 a 13: pasos, bloques, relacionados y cambio de tipo', () => {
  const prog = () => ejemplo('progresion-leer-al-defensor-con-bote');
  rechaza({ ...prog(), pasos: prog().pasos.slice(0, 1) }, /pasos debe tener entre 2 y 8/);
  rechaza({ ...prog(), pasos: [prog().pasos[0], prog().pasos[0]] }, /ejercicios repetidos/);
  rechaza({ ...prog(), pasos: [prog().pasos[0], { slug: 'no-existe', criterio_avance: 'x' }] }, /no-existe no existe/);
  rechaza({ ...prog(), pasos: [prog().pasos[0], { slug: 'tres-fases-del-ataque-film-room', criterio_avance: 'x' }] }, /es teoria y aquí solo se admite ejercicio/);
  const sesion = ejemplo('sesion-bote-y-lectura-1c1-infantil');
  rechaza({ ...sesion, bloques: [sesion.bloques[0]] }, /bloques debe tener entre 2 y 12/);
  rechaza({ ...sesion, bloques: [sesion.bloques[0], { slug: 'tres-fases-del-ataque-film-room', minutos: 10 }] }, /solo se admite ejercicio o progresion/);
  rechaza({ ...sesion, bloques: [sesion.bloques[0], { slug: 'rooted', minutos: 90 }] }, /minutos debe ser un entero entre 1 y 60/);
  rechaza({ ...prog(), relacionados: ['no-existe'] }, /no-existe no existe/);
  rechaza({ ...prog(), relacionados: ['rooted', 'rooted'] }, /relacionados contiene slugs repetidos/);
  rechaza({ ...prog(), relacionados: [prog().slug] }, /no puede incluir el propio slug/);
  rechaza(ejemplo(ESPECIALISTAS), /ya existe como teoria/, tipos([[ESPECIALISTAS, 'teoria']]));
});

test('§11.1 reglas 14 a 16: estado de Trainer Bot, datos personales y sugerencias', () => {
  rechaza({ ...ejemplo(ESPECIALISTAS), estado: 'revisado' }, /trainer_bot solo puede enviar estado propuesto/);
  assert.deepEqual(errores({ ...ejemplo(ESPECIALISTAS), creado_por: 'gestor', estado: 'revisado' }), []);
  rechaza({ ...ejemplo(ESPECIALISTAS), nota: 'Escribid a coach.baeza@gmail.com' }, /nota contiene un email/);
  rechaza({ ...ejemplo(ESPECIALISTAS), puntos_clave: ['Llamar al 612 345 678'] }, /puntos_clave\[0\] contiene un teléfono/);
  rechaza({ ...ejemplo(ESPECIALISTAS), recursos: [{ ...ejemplo(ESPECIALISTAS).recursos[0], autor: '+34 699123456' }] }, /recursos\[0\]\.autor contiene un teléfono/);
  // Las URL no son texto libre: un id numérico de TikTok no es un teléfono.
  const tiktok = ejemplo('rey-de-la-pista');
  tiktok.recursos[1] = { tipo_recurso: 'video_tiktok', url: 'https://www.tiktok.com/@club/video/7234567890123456789', etiqueta: 'Clip', idioma: 'sin_voz', relacion: 'variante', principal: false };
  assert.deepEqual(errores(tiktok), []);
  rechaza({ ...ejemplo(ESPECIALISTAS), sugerencias_vocabulario: [{ campo: 'nota', valor: 'x', motivo: 'm' }] }, /campo con vocabulario/);
  rechaza({ ...ejemplo(ESPECIALISTAS), sugerencias_vocabulario: [{ campo: 'material', valor: 'Balón-Gigante', motivo: 'm' }] }, /snake_case/);
  const conSugerencia = H.validar({ ...ejemplo(ESPECIALISTAS), sugerencias_vocabulario: [{ campo: 'material', valor: 'balon_gigante', motivo: 'Hay varios juegos con él' }] }, tipos());
  assert.deepEqual(plano(conSugerencia.errores), []);
  assert.ok(conSugerencia.avisos.some(a => /material=balon_gigante/.test(a)));
});

test('§11.2 avisos: se aceptan y se explican', () => {
  const avisos = f => H.validar(f, tipos()).avisos.join(' | ');
  const base = ejemplo(ESPECIALISTAS);
  assert.match(avisos({ ...base, resumen: base.objetivo.slice(0, 160), objetivo: base.objetivo.slice(0, 160) }), /resumen es idéntico a objetivo/);
  assert.match(avisos({ ...base, descripcion: 'Corta.' }), /menos de 150 caracteres/);
  assert.match(avisos({ ...ejemplo('rey-de-la-pista'), habilidad_principal: 'defensa_balon', habilidades_secundarias: [], fase_juego: ['ataque'] }), /Habilidad defensiva sin fase de defensa/);
  assert.match(avisos({ ...base, habilidad_principal: 'lectura_defensor', habilidades_secundarias: [], fase_juego: ['defensa'] }), /Habilidad de ataque sin fase de ataque/);
  const juego = ejemplo('rey-de-la-pista'); delete juego.reglas;
  assert.match(avisos(juego), /Juego sin reglas/);
  const teoria = ejemplo('tres-fases-del-ataque-film-room'); delete teoria.minutos_clave;
  assert.match(avisos(teoria), /más de 5 minutos sin minutos_clave/);
  const apoyo = ejemplo('rey-de-la-pista');
  apoyo.recursos[0].relacion = 'apoyo';
  assert.match(avisos(apoyo), /principal no lo es/);
});

test('un lote rechaza solo lo inválido y lo que depende de ello, y los slugs repetidos', () => {
  const malo = { ...ejemplo('rey-de-la-pista'), dificultad: 9 };
  const sesion = ejemplo('sesion-bote-y-lectura-1c1-infantil');
  const prog = ejemplo('progresion-leer-al-defensor-con-bote');
  const lote = H.validarLote([ejemplo(ESPECIALISTAS), malo, prog, sesion, ejemplo(ESPECIALISTAS)], EXISTENTES);
  assert.deepEqual(plano(lote.filas.map(f => f.slug)), [ESPECIALISTAS, prog.slug]);
  const porSlug = Object.fromEntries(lote.rechazados.map(r => [r.slug, r.errores.join(' | ')]));
  assert.match(porSlug['rey-de-la-pista'], /dificultad/);
  // La sesión apunta a la progresión (no está en este lote) y al juego rechazado.
  assert.match(porSlug['sesion-bote-y-lectura-1c1-infantil'], /rey-de-la-pista no existe/);
  assert.equal(lote.rechazados.filter(r => r.slug === ESPECIALISTAS && /repetido en el lote/.test(r.errores[0])).length, 1);
});

test('derivados §9: área, nivel, recursos, vídeo exacto, YouTube, asignable y texto de búsqueda', () => {
  const filas = Object.fromEntries(H.validarLote(EJEMPLOS, EXISTENTES).filas.map(f => [f.slug, f]));
  const esp = filas[ESPECIALISTAS];
  assert.equal(esp.area, 'tecnica_individual');
  assert.equal(esp.grupo_habilidad, 'bote');
  assert.deepEqual(plano(esp.areas_trabajadas), ['tecnica_individual']);
  assert.equal(esp.nivel_etiqueta, 'iniciacion');
  assert.deepEqual(plano(esp.tipos_recurso), ['video_youtube']);
  assert.equal(esp.recurso_principal_tipo, 'video_youtube');
  assert.equal(esp.youtube_id, 'BJbJ_skvxNs');
  assert.equal(esp.recursos[0].youtube_id, 'BJbJ_skvxNs');
  assert.equal(esp.tiene_video_exacto, true);
  assert.equal(esp.asignable, true);
  assert.match(esp.texto_busqueda, /Cambios de mano y dirección/);
  assert.match(esp.texto_busqueda, /Técnica individual/);
  assert.match(esp.texto_busqueda, /Iniciación/);
  const rey = filas['rey-de-la-pista'];
  assert.equal(rey.area, 'tactica_individual');
  assert.equal(rey.nivel_etiqueta, 'intermedio');
  assert.equal(rey.tiene_diagrama, false, 'una pizarra sin subir no cuenta como diagrama');
  assert.equal(rey.tiene_video, false);
  assert.equal(filas['tres-fases-del-ataque-film-room'].asignable, false);
  assert.equal(filas['tres-fases-del-ataque-film-room'].area, null);
  assert.deepEqual(plano(filas['progresion-leer-al-defensor-con-bote'].tipos_recurso), ['solo_texto']);
  assert.equal(filas['progresion-leer-al-defensor-con-bote'].recurso_principal_tipo, 'solo_texto');
  assert.equal(filas['sesion-bote-y-lectura-1c1-infantil'].asignable, false);
  const pizarra = H.derivar({ tipo_contenido: 'ejercicio', recursos: [{ tipo_recurso: 'pizarra_diagrama', url: 'https://x.es/a.png', relacion: 'exacto', principal: true }] });
  assert.equal(pizarra.tiene_diagrama, true);
  assert.equal(H.youtubeId('https://youtu.be/BJbJ_skvxNs'), 'BJbJ_skvxNs');
  assert.equal(H.youtubeId('https://www.youtube.com/shorts/BJbJ_skvxNs'), 'BJbJ_skvxNs');
  assert.equal(H.youtubeId('https://www.youtube.com/playlist?list=PL1'), null);
});

test('agregados de progresión y sesión se calculan desde sus hijos', () => {
  const hijo = (slug, campos) => ({ slug, tipo_contenido: 'ejercicio', categorias: ['infantil', 'cadete'], material: [], canastas_necesarias: 1, jugadores_min: 2, jugadores_max: null, ...campos });
  const fichas = [
    hijo('a', { dificultad: 2, esfuerzo_fisico: 3, carga_cognitiva: 2, complejidad_organizativa: 1, minutos_min: 5, minutos_max: 8, jugadores_min: 4, jugadores_max: 12, habilidad_principal: 'bote' }),
    hijo('b', { dificultad: 4, esfuerzo_fisico: 4, carga_cognitiva: 4, complejidad_organizativa: 3, minutos_min: 10, minutos_max: 15, categorias: ['cadete'], material: ['conos'], canastas_necesarias: 2, habilidad_principal: 'lectura_defensor' }),
    { slug: 'p', tipo_contenido: 'progresion', habilidad_principal: 'lectura_defensor', categorias: ['cadete'], pasos: [{ slug: 'a' }, { slug: 'b' }] },
    { slug: 's', tipo_contenido: 'sesion_modelo', categorias: ['cadete'], bloques: [{ slug: 'a', minutos: 10 }, { slug: 'p', minutos: 25 }, { slug: 'a', minutos: 5 }] },
  ];
  const ag = H.agregados(fichas);
  assert.deepEqual(plano(ag.get('p')), {
    dificultad_min: 2, dificultad_max: 4, esfuerzo_fisico_min: 3, esfuerzo_fisico_max: 4, carga_cognitiva_min: 2, carga_cognitiva_max: 4,
    complejidad_organizativa_min: 1, complejidad_organizativa_max: 3, jugadores_min: 4, jugadores_max: 12, canastas_necesarias: 2,
    material: ['conos'], minutos_min: 15, minutos_max: 23, categorias_comunes: ['cadete'], nivel_etiqueta: null,
  });
  const s = plano(ag.get('s'));
  assert.equal(s.minutos_total, 40);
  assert.deepEqual(s.distribucion_areas, { tecnica_individual: 15, tactica_individual: 25 });
  assert.deepEqual(s.distribucion_habilidades, { bote: 15, lectura_defensor: 25 });
  assert.deepEqual([s.dificultad_min, s.dificultad_max], [2, 4]);
  assert.equal(ag.has('a'), false);
});
