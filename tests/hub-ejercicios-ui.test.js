const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function cliente() {
  const elements = Object.fromEntries(['hub-ejercicios-contenido', 'hub-filtros', 'hub-lista', 'hub-cuenta', 'hub-buscar'].map(id => [id, { innerHTML: '', textContent: '', value: '' }]));
  const document = { addEventListener() {}, getElementById: id => elements[id] || null };
  const context = vm.createContext({ document, window: { addEventListener() {} }, requestAnimationFrame() {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../ui/app.html'), 'utf8').replace(/^<script[^>]*>|<\/script>\s*$/g, ''), context);
  const app = vm.runInContext('App', context);
  app.state.rol = 'entrenador'; app.state.currentView = 'hub-ejercicios'; app.preferences.idioma = 'es';
  const hub = app.views['hub-ejercicios'];
  hub.ejercicios = [
    { nombre:'Ataque <uno>', nombre_en:'Attack', objetivo:'Proteger el balón', como_se_hace:'Botar', claves:['Mirar al frente'], habilidades:['bote'], formato:'juego', oposicion:'igualdad', organizacion:'parejas', material:['conos'], enlaces:[{ tipo:'fuente', url:'javascript:alert(1)' }, { tipo:'video', url:'https://example.com' }], medios:[{ tipo:'youtube', youtube_id:'abcdefghijk', es_miniatura:true }] },
    { nombre:'Defensa', habilidades:['defensa'], formato:'analitico', oposicion:'limitada', organizacion:'grupo', claves:[] }
  ];
  return { app, hub, elements, context };
}

test('los filtros se combinan con búsqueda y limpiar los restablece', () => {
  const { hub, elements } = cliente();
  hub.pintarFiltros(); hub.pintarLista();
  assert.match(elements['hub-lista'].innerHTML, /Ataque &lt;uno&gt;/);
  hub.filtrar('habilidades', 'bote'); hub.filtrar('oposicion', 'igualdad'); hub.buscar('balón');
  assert.match(elements['hub-cuenta'].textContent, /^1 /);
  assert.doesNotMatch(elements['hub-lista'].innerHTML, /Defensa/);
  hub.filtrar('organizacion', 'grupo');
  assert.match(elements['hub-lista'].innerHTML, /No hay ejercicios/);
  hub.limpiar();
  assert.match(elements['hub-cuenta'].textContent, /^2 /);
});

test('detalle escapa datos, rechaza enlaces inseguros y muestra medios y traducciones', () => {
  const { hub, app } = cliente();
  app.preferences.idioma = 'en';
  const html = hub.tarjeta(hub.ejercicios[0]);
  assert.match(html, /Attack/); assert.match(html, /Coaching points/);
  assert.match(html, /Mirar al frente/); assert.match(html, /Cones/);
  assert.match(html, /youtube-nocookie\.com\/embed\/abcdefghijk/);
  assert.match(html, /https:\/\/example\.com/);
  assert.doesNotMatch(html, /javascript:alert/);
  assert.doesNotMatch(html, /Ataque <uno>/);
});

test('las imágenes embebidas solo se usan como imágenes, nunca como enlaces', () => {
  const { hub } = cliente();
  const ejercicio = { nombre:'Imagen', habilidades:[], claves:[], enlaces:[{ url:'data:image/png;base64,AAAA' }], medios:[{ tipo:'imagen', ruta_o_url:'data:image/png;base64,AAAA', es_miniatura:true }] };
  const html = hub.tarjeta(ejercicio);
  assert.match(html, /src="data:image\/png;base64,AAAA"/);
  assert.doesNotMatch(html, /href="data:/);
  ejercicio.medios[0].ruta_o_url = 'data:text/html;base64,AAAA';
  assert.doesNotMatch(hub.tarjeta(ejercicio), /data:text/);
});

test('carga el catálogo y descarta respuestas después de cerrar sesión o cambiar de vista', async () => {
  const { hub, app, elements, context } = cliente();
  let responder, nombre;
  app.escritura.activa = () => false;
  context.peticion = fn => { nombre = fn; return new Promise(resolve => { responder = resolve; }); };
  vm.runInContext('server = peticion', context);
  hub.render();
  assert.equal(nombre, 'listarEjercicios');
  app.state.currentView = 'gestion';
  responder({ success:true, ejercicios:[{ nombre:'No debe aparecer' }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.doesNotMatch(elements['hub-ejercicios-contenido'].innerHTML, /No debe aparecer/);
});
