const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const esquema = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/HubEsquema.gs'), 'utf8') + '\nthis.HubEsquema = HubEsquema;', esquema);
const H = esquema.HubEsquema;
const EJEMPLOS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/hub-ejemplos-v2.json'), 'utf8'));

// Catálogo de prueba: los ejemplos del esquema (con sus derivados y agregados) más dos ejercicios hechos a medida.
function catalogo() {
  const extra = [
    { ...EJEMPLOS[0], slug: 'lee-la-mano', nombre: 'Lee la mano', resumen: 'El defensor enseña la mano y el atacante decide.', habilidad_principal: 'lectura_defensor',
      habilidades_secundarias: ['cambio_mano'], situacion_numerica: '1c1', oposicion: 'condicionada', dificultad: 3, jugadores_min: 2, jugadores_max: 16, material: [], minutos_min: 6, minutos_max: 8, fase_juego: ['ataque'], recursos: [] },
    { ...EJEMPLOS[0], slug: 'rooted', nombre: 'Rooted', resumen: 'Defensor clavado.', habilidad_principal: 'salida_1c1', habilidades_secundarias: [], situacion_numerica: '1c1', oposicion: 'real', dificultad: 4,
      categorias: ['cadete'], material: ['conos', 'petos'], fase_juego: ['ataque'], canastas_necesarias: 2, minutos_min: 12, minutos_max: 15, recursos: [], fecha_enviado: '2026-11-21' },
    { ...EJEMPLOS[0], slug: 'muerde-a-la-tercera', nombre: 'Muerde a la tercera', resumen: 'Pica al tercer bote.', habilidad_principal: 'bote_proteccion', habilidades_secundarias: [], recursos: [] },
    { ...EJEMPLOS[0], slug: 'superar-defensor-puertas', nombre: 'Puertas', resumen: 'Cruzar puertas.', recursos: [] },
    { ...EJEMPLOS[0], slug: 'pilla-pilla-botando', nombre: 'Pilla pilla botando', resumen: 'Pillar botando.', naturaleza: 'juego', competitivo: true, recursos: [] },
  ];
  const lote = H.validarLote(extra.concat(EJEMPLOS), []);
  assert.deepEqual(JSON.parse(JSON.stringify(lote.rechazados)), []);
  const fichas = lote.filas.map(f => JSON.parse(JSON.stringify(f)));
  const agregados = H.agregados(fichas);
  return { fichas: fichas.map(f => Object.assign(f, JSON.parse(JSON.stringify(agregados.get(f.slug) || {})))), vocabulario: JSON.parse(JSON.stringify(H.vocabulario())) };
}

function cliente() {
  const elements = {};
  const document = { addEventListener() {}, getElementById: id => elements[id] || null, querySelector: () => null, querySelectorAll: () => [] };
  const context = vm.createContext({ document, window: { addEventListener() {} }, requestAnimationFrame() {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../ui/app.html'), 'utf8').replace(/^<script[^>]*>|<\/script>\s*$/g, ''), context);
  const app = vm.runInContext('App', context);
  app.state.rol = 'entrenador'; app.state.currentView = 'hub-ejercicios'; app.preferences.idioma = 'es';
  const hub = app.views['hub-ejercicios'];
  hub.cargar(catalogo());
  hub.tab = 'ejercicios'; hub.consulta = ''; hub.orden = 'relevancia'; hub.filtros = { ejercicios: {}, aprender: {} };
  return { app, hub, elements, context };
}
const slugs = lista => Array.from(lista, f => f.slug);
const plano = v => JSON.parse(JSON.stringify(v));

test('la cabecera se oculta al bajar y vuelve al subir, con excepciones de foco y filtros', () => {
  const { hub, elements, context } = cliente();
  const clases = new Set();
  const cabecera = { classList: { add: c => clases.add(c), remove: c => clases.delete(c) } };
  context.document.querySelector = () => cabecera;
  elements['hub-q'] = {};
  elements['hub-capa-filtros'] = { hidden: true };
  const contenedor = { scrollTop: 0 };
  const ocultar = () => clases.has('hub-cabecera-oculta');
  const mover = y => { contenedor.scrollTop = y; hub.desplazarCabecera(contenedor); };
  mover(0); mover(5); assert.equal(ocultar(), false);
  mover(13); assert.equal(ocultar(), true);
  mover(12); assert.equal(ocultar(), false);
  mover(30); assert.equal(ocultar(), true);
  context.document.activeElement = elements['hub-q']; mover(40); assert.equal(ocultar(), false);
  context.document.activeElement = null; mover(60); assert.equal(ocultar(), true);
  elements['hub-capa-filtros'].hidden = false; mover(70); assert.equal(ocultar(), false);
  elements['hub-capa-filtros'].hidden = true; mover(90); assert.equal(ocultar(), true);
  mover(0); assert.equal(ocultar(), false);
  hub.tab = 'revision'; mover(100); assert.equal(ocultar(), false);
});

test('las pestañas separan la práctica de la teoría y la revisión muestra lo propuesto', () => {
  const { hub } = cliente();
  assert.equal(slugs(hub.resultados()).includes('tres-fases-del-ataque-film-room'), false);
  hub.tab = 'aprender';
  assert.deepEqual(slugs(hub.resultados()), ['tres-fases-del-ataque-film-room']);
});

test('facetas: valores de una faceta se suman (O) y las facetas se combinan (Y)', () => {
  const { hub } = cliente();
  const f = hub.filtros.ejercicios;
  f.tipo = ['juego'];
  assert.deepEqual(slugs(hub.resultados()).sort(), ['pilla-pilla-botando', 'rey-de-la-pista']);
  f.tipo = ['juego', 'progresion'];
  assert.deepEqual(slugs(hub.resultados()).sort(), ['pilla-pilla-botando', 'progresion-leer-al-defensor-con-bote', 'rey-de-la-pista']);
  f.habilidad = ['salida_1c1'];
  assert.deepEqual(slugs(hub.resultados()).sort(), ['progresion-leer-al-defensor-con-bote', 'rey-de-la-pista'], 'la progresión la trabaja como secundaria');
  // La habilidad también encuentra secundarias.
  hub.filtros.ejercicios = { habilidad: ['cambio_mano'] };
  assert.deepEqual(slugs(hub.resultados()).sort(), ['especialistas', 'lee-la-mano', 'pilla-pilla-botando', 'progresion-leer-al-defensor-con-bote', 'superar-defensor-puertas']);
});

test('nivel y esfuerzo usan la dificultad y, en progresiones y sesiones, su rango', () => {
  const { hub } = cliente();
  hub.filtros.ejercicios = { nivel: ['avanzado'] };
  assert.deepEqual(slugs(hub.resultados()).sort(), ['progresion-leer-al-defensor-con-bote', 'rooted', 'sesion-bote-y-lectura-1c1-infantil'], 'los rangos 2–4 de la progresión y la sesión llegan a avanzado');
  hub.filtros.ejercicios = { nivel: ['intermedio'], tipo: ['progresion', 'sesion_modelo'] };
  assert.deepEqual(slugs(hub.resultados()).sort(), ['progresion-leer-al-defensor-con-bote', 'sesion-bote-y-lectura-1c1-infantil']);
  hub.filtros.ejercicios = { esfuerzo: ['intenso'] };
  assert.ok(hub.resultados().every(f => (f.esfuerzo_fisico || f.esfuerzo_fisico_max) >= 4));
});

test('jugadores, material, canastas, minutos, vídeo y competición filtran por lo que tiene el entrenador', () => {
  const { hub } = cliente();
  const f = hub.filtros.ejercicios;
  f.jugadores = 20;
  assert.ok(!slugs(hub.resultados()).includes('lee-la-mano'), 'lee-la-mano admite como mucho 16');
  assert.ok(slugs(hub.resultados()).includes('especialistas'), 'sin máximo escala sin límite');
  f.jugadores = null;
  f.material = [];
  assert.ok(!slugs(hub.resultados()).includes('rooted'), 'solo balones excluye lo que necesita conos y petos');
  f.material = ['conos'];
  assert.ok(!slugs(hub.resultados()).includes('rooted'));
  f.material = ['conos', 'petos'];
  assert.ok(slugs(hub.resultados()).includes('rooted'));
  hub.filtros.ejercicios = { canastas: [1] };
  assert.ok(!slugs(hub.resultados()).includes('rooted'));
  hub.filtros.ejercicios = { minutos: [10] };
  assert.ok(hub.resultados().every(x => hub.duracion(x)[0] <= 10));
  assert.ok(!slugs(hub.resultados()).includes('rooted'));
  hub.filtros.ejercicios = { recurso: ['video_exacto'] };
  assert.deepEqual(slugs(hub.resultados()), ['especialistas']);
  hub.filtros.ejercicios = { idioma: ['en'] };
  assert.deepEqual(slugs(hub.resultados()), ['especialistas']);
  hub.filtros.ejercicios = { competitivo: ['si'] };
  assert.ok(hub.resultados().every(x => x.competitivo === true));
});

test('quitar, limpiar y los atajos de tipo actualizan el estado sin perder el resto', () => {
  const { hub } = cliente();
  hub.actualizar = () => {};
  hub.alternar('fase', 'ataque'); hub.alternar('fase', 'defensa'); hub.alternar('minutos', 10); hub.alternar('minutos', 15);
  assert.deepEqual(plano(hub.filtros.ejercicios.fase), ['ataque', 'defensa']);
  assert.deepEqual(plano(hub.filtros.ejercicios.minutos), [15], 'una faceta de valor único sustituye el valor');
  hub.quitar('fase', 'ataque');
  assert.deepEqual(plano(hub.filtros.ejercicios.fase), ['defensa']);
  hub.rapido('juego'); hub.rapido('juego');
  assert.deepEqual(plano(hub.filtros.ejercicios.tipo), []);
  hub.jugadores(1); hub.jugadores(1);
  assert.equal(hub.filtros.ejercicios.jugadores, 11);
  hub.material('conos'); hub.material('conos');
  assert.equal(hub.filtros.ejercicios.material, null);
  assert.equal(hub.numActivos(hub.filtros.ejercicios), 3);
  hub.limpiar();
  assert.equal(hub.numActivos(hub.filtros.ejercicios), 0);
});

test('la búsqueda usa texto_busqueda sin tildes ni plurales y pondera el nombre', () => {
  const { hub } = cliente();
  hub.consulta = 'manos';
  const r = slugs(hub.resultados());
  const enNombre = r.filter(s => /mano/i.test(hub.porSlug[s].nombre));
  assert.ok(enNombre.includes('lee-la-mano'));
  assert.deepEqual(r.slice(0, enNombre.length), enNombre, 'coincidir en el nombre pesa más');
  assert.ok(r.includes('especialistas'), 'las etiquetas de habilidad («Cambios de mano») también cuentan');
  hub.consulta = 'TRANSICION';
  assert.ok(slugs(hub.resultados()).length === 0 || hub.resultados().every(f => /transici/i.test(f.texto_busqueda)));
  hub.tab = 'aprender'; hub.consulta = 'fases ataque';
  assert.deepEqual(slugs(hub.resultados()), ['tres-fases-del-ataque-film-room']);
  hub.consulta = 'ataque inexistentexyz';
  assert.equal(hub.resultados().length, 0);
});

test('el orden por dificultad, duración y recientes es estable', () => {
  const { hub } = cliente();
  hub.orden = 'dificultad';
  const dif = hub.resultados().map(f => hub.rango(f, 'dificultad')[0]);
  assert.deepEqual(dif, dif.slice().sort((a, b) => a - b));
  hub.orden = 'duracion';
  const dur = hub.resultados().map(f => hub.duracion(f)[0]);
  assert.deepEqual(dur, dur.slice().sort((a, b) => a - b));
  hub.orden = 'recientes';
  assert.equal(hub.resultados()[0].slug, 'rooted');
});

test('la tarjeta escapa el contenido y muestra habilidad, situación, medidores y miniatura', () => {
  const { hub } = cliente();
  const f = Object.assign({}, hub.porSlug.especialistas, { nombre: 'Ataque <img src=x onerror=alert(1)>' });
  const html = hub.tarjeta(f);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /Ataque &lt;img/);
  assert.match(html, /i\.ytimg\.com\/vi\/BJbJ_skvxNs\/mqdefault\.jpg/);
  assert.match(html, /Cambios de mano y dirección/);
  assert.match(html, />1c0</);
  assert.match(html, /aria-label="Dificultad: 2\/5"/);
  assert.match(html, /2:20–3:20/);
  const prog = hub.tarjeta(hub.porSlug['progresion-leer-al-defensor-con-bote']);
  assert.match(prog, /3 pasos/);
  assert.match(prog, /aria-label="Dificultad: 2–4\/5"/);
});

test('el reproductor respeta el tramo, los capítulos saltan al segundo y las URL inseguras no se pintan', () => {
  const { hub } = cliente();
  const esp = hub.porSlug.especialistas;
  hub.pila = ['especialistas'];
  hub.medio = null;
  assert.match(hub.escenario(esp), /class="hub-poster"/);
  hub.medio = { indice: 0, auto: true };
  assert.match(hub.escenario(esp), /youtube-nocookie\.com\/embed\/BJbJ_skvxNs\?rel=0&amp;playsinline=1&amp;modestbranding=1&amp;start=140&amp;end=200&amp;autoplay=1/);
  const teoria = hub.porSlug['tres-fases-del-ataque-film-room'];
  hub.medio = { indice: 0, inicio: 125, auto: true };
  const capitulo = hub.escenario(teoria);
  assert.match(capitulo, /start=125/);
  assert.doesNotMatch(capitulo, /end=/);
  const peligroso = { tipo_contenido: 'ejercicio', recursos: [{ tipo_recurso: 'articulo_web', url: 'javascript:alert(1)', etiqueta: 'x', principal: true }] };
  hub.medio = null;
  assert.doesNotMatch(hub.escenario(peligroso), /javascript:/);
  const imagen = { tipo_contenido: 'ejercicio', recursos: [{ tipo_recurso: 'pizarra_diagrama', url: 'https://x.es/p.png', etiqueta: 'P', principal: true }] };
  assert.match(hub.escenario(imagen), /<img class="hub-escenario-img" src="https:\/\/x\.es\/p\.png"/);
});

test('una respuesta que llega tras salir del hub o cerrar sesión no repinta', async () => {
  const { hub, app, elements, context } = cliente();
  elements['hub-ejercicios-contenido'] = { innerHTML: '' };
  let responder;
  app.escritura.activa = () => false;
  context.peticion = () => new Promise(resolve => { responder = resolve; });
  vm.runInContext('server = peticion', context);
  hub.fichas = [];
  hub.pintar = () => { elements['hub-ejercicios-contenido'].innerHTML = 'pintado:' + hub.fichas.length; };
  hub.render();
  app.state.currentView = 'gestion';
  responder({ success: true, fichas: [{ slug: 'no', nombre: 'No debe aparecer' }], vocabulario: catalogo().vocabulario });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(hub.fichas.length, 0);
  assert.equal(elements['hub-ejercicios-contenido'].innerHTML, 'pintado:0');
});
