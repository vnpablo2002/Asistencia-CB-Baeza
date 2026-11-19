// Asistente «Cancelar entrenamiento» (cliente): se cancela primero y después se elige el aviso.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function elemento() {
  return { value: '', checked: false, hidden: false, disabled: false, textContent: '', innerHTML: '', href: '', style: {}, dataset: {},
    classList: { _c: new Set(), add(c) { this._c.add(c); }, remove(c) { this._c.delete(c); }, contains(c) { return this._c.has(c); }, toggle(c, on) { on ? this._c.add(c) : this._c.delete(c); } },
    setAttribute() {}, removeAttribute() {}, focus() {}, querySelector: () => null };
}

function eventos() {
  const listeners = new Map();
  return {
    addEventListener(tipo, fn) { if (!listeners.has(tipo)) listeners.set(tipo, new Set()); listeners.get(tipo).add(fn); },
    removeEventListener(tipo, fn) { listeners.get(tipo)?.delete(fn); },
    emit(tipo) { for (const fn of [...(listeners.get(tipo) || [])]) fn({ type: tipo }); },
    cantidad(tipo) { return listeners.get(tipo)?.size || 0; },
  };
}

function client(notificacion) {
  const els = {}, calls = [], navegacion = [], notices = [], portapapeles = [];
  const document = Object.assign(eventos(), {
    hidden: false, documentElement: elemento(), querySelectorAll: () => [], querySelector: () => null, activeElement: null,
    getElementById: id => (els[id] ||= Object.assign(elemento(), { id })),
    createElement: () => Object.assign(elemento(), { select() {} }),
    body: { appendChild() {}, removeChild() {} },
  });
  const window = eventos();
  const context = vm.createContext({
    document, window,
    localStorage: { getItem: () => null, setItem() {} },
    navigator: { userAgent: 'test', clipboard: { writeText: texto => { portapapeles.push(texto); return Promise.resolve(); } } },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../ui/app.html'), 'utf8').replace(/^<script[^>]*>|<\/script>\s*$/g, ''), context);
  const app = vm.runInContext('App', context);
  context.showToast = (message, type) => notices.push({ message, type });
  app.state.rol = 'entrenador';
  app.state.usuario = { Nombre: ' Marta ', Apellidos: ' López ' };
  app.state.motivosCancelacion = ['Instalación no disponible', 'Climatología', 'Otro'];
  app.state.sesionId = 's1';
  app.state.viewHistory = ['equipos', 'sesiones', 'sesion'];
  app.cache.equipos = [{ ID: 'e1', Nombre: 'Cadete Masculino' }];
  app.cache.sesiones = [{ ID: 's1', ID_Equipo: 'e1', Fecha: '2026-11-16', HoraInicio: '19:00', HoraFin: '20:30' }];
  app.cache.jugadores = [
    { ID: 'j1', Nombre: 'Ana', Apellidos: 'Ruiz', TelefonoPadre1: '600111222', EmailPadre1: 'familia1@example.test' },
    { ID: 'j2', Nombre: 'Luis', Apellidos: 'Gil', EmailPadre1: 'familia2@example.test', NotificarAusenciasPadre1: false },
    { ID: 'j3', Nombre: 'Eva', Apellidos: 'Sanz', Telefono: '611222333' },
  ];
  app.cache.jugadoresEquipos = ['j1', 'j2', 'j3'].map(id => ({ ID: 'r-' + id, ID_Jugador: id, ID_Equipo: 'e1', Tipo: 'Principal', Activo: true }));
  app.cache.asistJugadores = [];
  app.navigate = vista => navegacion.push(vista);
  app.stats.invalidar = () => {};
  app.views.sesion._stopAutoSave = () => {};
  let responder = (canal) => {
    const canales = (app.cache.sesiones[0].CanalAvisoCancelacion || '').split(',').filter(Boolean);
    if (!canales.includes(canal)) canales.push(canal);
    return { success: true, sesion: { ...app.cache.sesiones[0], CanalAvisoCancelacion: canales.join(',') }, notificacion: notificacion || { canal, mensaje: 'Mensaje del servidor' } };
  };
  app.operation.run = (key, fn, args, onSuccess, onError, textos) => {
    calls.push({ key, fn, args: JSON.parse(JSON.stringify(args)), textos });
    if (fn === 'cancelarSesion') {
      const sesion = { ...app.cache.sesiones[0], Cancelada: true, MotivoCancelacion: args[1], DetalleCancelacion: (args[2] && args[2].detalle) || null, CanceladoPor: 'Marta López', CanalAvisoCancelacion: null };
      return Promise.resolve().then(() => onSuccess({ success: true, sesion }));
    }
    return Promise.resolve().then(() => responder(args[1])).then(res => {
      if (!res || res.success === false) throw new Error(res?.error || 'No confirmado');
      return onSuccess(res);
    });
  };
  const wizard = app.views.cancelarSesion;
  return { app, wizard, els, calls, navegacion, notices, portapapeles, document, window, navigator: context.navigator, setResponder(fn) { responder = fn; } };
}

const MENSAJE = '❌ *Entrenamiento cancelado*\n🏀 Equipo Cadete Masculino\n📅 lunes 16/11/2026 a las 19:00\n📝 Motivo: Climatología\nPista mojada\n\nUn saludo,\nMarta López';

test('motivo obligatorio de la lista del servidor; Atrás conserva la elección', () => {
  const { wizard, els } = client();
  wizard.abrir('s1');
  assert.equal(els['modal-cancelar-sesion'].classList.contains('hidden'), false);
  assert.equal(wizard._paso, 'motivo');
  for (const motivo of ['Instalación no disponible', 'Climatología', 'Otro']) assert.ok(els['cancelar-motivos'].innerHTML.includes('data-motivo="' + motivo + '"'));
  assert.equal(els['cancelar-sesion-info'].textContent.startsWith('Cadete Masculino · '), true);
  assert.equal(els['cancelar-continuar-motivo'].disabled, true);
  wizard.elegirMotivo('Inventado');
  assert.equal(wizard._paso, 'motivo');
  wizard.elegirMotivo('Climatología');
  assert.equal(wizard._paso, 'detalle');
  wizard.atras();
  assert.equal(wizard._paso, 'motivo');
  assert.equal(els['cancelar-continuar-motivo'].disabled, false);
});

test('al confirmar se cancela con el detalle (o vacío) y después aparece el aviso, sin canal todavía', async () => {
  const { app, wizard, els, calls, navegacion } = client();
  wizard.abrir('s1');
  wizard.elegirMotivo('Climatología');
  els['cancelar-detalle'].value = '  Pista\n mojada ';
  assert.equal(await wizard.confirmar(), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fn, 'cancelarSesion');
  assert.deepEqual(calls[0].args, ['s1', 'Climatología', { detalle: 'Pista mojada' }]);
  assert.equal(app.cache.sesiones[0].Cancelada, true);
  assert.equal(app.cache.sesiones[0].CanalAvisoCancelacion, null);
  assert.equal(app.state.sesionId, null);
  assert.deepEqual(navegacion, ['sesiones']);
  assert.equal(wizard._paso, 'aviso');
  assert.equal(wizard._cancelada, true);
  assert.equal(els['cancelar-titulo'].textContent, 'Avisar a las familias');
  assert.equal(els['cancelar-canal-correo-info'].textContent, '1 de 3 con correo', 'avisos por correo desactivados no cuentan');
  assert.equal(els['cancelar-canal-whatsapp'].href, 'https://wa.me/?text=' + encodeURIComponent(MENSAJE));
  assert.ok(!els['cancelar-canal-whatsapp'].href.includes('wa.me/34'), 'sin número: el entrenador elige el chat');
  wizard.atras();
  assert.equal(wizard._paso, 'aviso', 'no se puede volver a los pasos anteriores una vez cancelado');
});

test('cerrar tras cancelar deja la sesión cancelada, sin registrar canal', async () => {
  const { wizard, els, calls } = client();
  wizard.abrir('s1');
  wizard.elegirMotivo('Otro');
  assert.equal(await wizard.confirmar(), true);
  assert.deepEqual(calls[0].args, ['s1', 'Otro', { detalle: '' }]);
  wizard.cerrar();
  assert.equal(els['modal-cancelar-sesion'].classList.contains('hidden'), true);
  assert.equal(calls.length, 1);
});

test('el correo se envía una sola vez y la tarjeta sigue abierta', async () => {
  const { wizard, calls, els } = client({ canal: 'correo', avisados: 1, omitidos: 2, fallidos: 0 });
  wizard.abrir('s1');
  wizard.elegirMotivo('Climatología');
  assert.equal(await wizard.elegirCanal('correo'), false);
  assert.equal(await wizard.confirmar(), true);
  assert.equal(await wizard.elegirCanal('correo'), true);
  assert.deepEqual(calls[1].args, ['s1', 'correo']);
  assert.equal(wizard._paso, 'aviso');
  assert.equal(els['cancelar-canal-correo'].disabled, true);
  assert.equal(els['cancelar-canal-correo-info'].textContent, 'Enviado ✓');
  assert.match(els['cancelar-resultado'].innerHTML, /Familias avisadas por correo<\/dt><dd>1/);
  assert.match(els['cancelar-resultado'].innerHTML, /Omitidas por no tener correo<\/dt><dd>2/);
  assert.equal(els['cancelar-terminar'].textContent, 'Listo');
  assert.equal(await wizard.elegirCanal('correo'), false);
  assert.equal(calls.length, 2);
});

test('copiar y WhatsApp funcionan y se repiten mientras el correo espera; respuestas desordenadas conservan canales', async () => {
  const { app, wizard, calls, portapapeles, els, setResponder } = client();
  wizard.abrir('s1');
  wizard.elegirMotivo('Climatología');
  els['cancelar-detalle'].value = 'Pista mojada';
  await wizard.confirmar();
  let resolverCorreo;
  const base = { ...app.cache.sesiones[0] };
  setResponder(canal => canal === 'correo'
    ? new Promise(resolve => { resolverCorreo = resolve; })
    : { success: true, sesion: { ...base, CanalAvisoCancelacion: canal }, notificacion: { canal } });
  const pendiente = wizard.elegirCanal('correo');
  assert.equal(els['cancelar-canal-correo-info'].textContent, 'Enviando…');
  assert.equal(await wizard.elegirCanal('correo'), false);
  const href = els['cancelar-canal-whatsapp'].href;
  assert.equal(href, 'https://wa.me/?text=' + encodeURIComponent(MENSAJE));
  const copiar = wizard.elegirCanal('copiar');
  const whatsapp = wizard.elegirCanal('whatsapp');
  assert.deepEqual(portapapeles, [MENSAJE, MENSAJE], 'se copia en el gesto sin esperar al servidor');
  assert.equal(await copiar, true);
  assert.equal(await whatsapp, true);
  assert.equal(await wizard.elegirCanal('copiar'), true);
  assert.equal(await wizard.elegirCanal('whatsapp'), true);
  assert.equal(portapapeles.length, 4);
  assert.equal(els['cancelar-estado-copiar'].textContent, 'Copiado ✓');
  assert.equal(els['cancelar-estado-whatsapp'].textContent, 'Abierto ✓');
  assert.equal(els['cancelar-canal-correo'].disabled, true);
  resolverCorreo({ success: true, sesion: { ...base, CanalAvisoCancelacion: 'correo' }, notificacion: { canal: 'correo', avisados: 1 } });
  assert.equal(await pendiente, true);
  assert.deepEqual(new Set(app.cache.sesiones[0].CanalAvisoCancelacion.split(',')), new Set(['copiar', 'whatsapp', 'correo']));
  assert.equal(new Set(calls.slice(1).map(c => c.key)).size, 5);
  assert.equal(wizard._paso, 'aviso');
});

test('fallo total permite reintentar; el parcial muestra fallidos y no permite reenviar', async () => {
  const { app, wizard, els, setResponder, calls } = client();
  wizard.abrir('s1');
  wizard.elegirMotivo('Otro');
  await wizard.confirmar();
  let parcial = false;
  setResponder(() => ({ success: true, sesion: { ...app.cache.sesiones[0], CanalAvisoCancelacion: parcial ? 'correo' : null },
    notificacion: { canal: 'correo', error: 'Error de correo', avisados: parcial ? 1 : 0, fallidos: 1, fallidas: [{ jugador: 'Ana <Ruiz>' }] } }));
  assert.equal(await wizard.elegirCanal('correo'), false);
  assert.equal(els['cancelar-canal-correo'].disabled, false);
  assert.equal(els['cancelar-canal-correo-info'].textContent, 'Error. Puedes reintentar.');
  assert.equal(els['cancelar-terminar'].textContent, 'No avisar');
  assert.match(els['cancelar-resultado'].innerHTML, /Error de correo/);
  assert.match(els['cancelar-resultado'].innerHTML, /No se pudo enviar<\/dt><dd>1/);
  assert.match(els['cancelar-resultado'].innerHTML, /Ana &lt;Ruiz&gt;/);
  parcial = true;
  assert.equal(await wizard.elegirCanal('correo'), false);
  assert.equal(els['cancelar-canal-correo'].disabled, true);
  assert.equal(els['cancelar-canal-correo-info'].textContent, 'Enviado parcialmente');
  assert.match(els['cancelar-resultado'].innerHTML, /Familias avisadas por correo<\/dt><dd>1/);
  assert.match(els['cancelar-resultado'].innerHTML, /Ana &lt;Ruiz&gt;/);
  assert.equal(await wizard.elegirCanal('correo'), false);
  assert.equal(calls.length, 3);
});

test('correo ya registrado en otra petición no se reenvía ni se presenta como envío parcial', async () => {
  const { app, wizard, els, calls, setResponder } = client();
  app.preferences.idioma = 'en';
  wizard.abrir('s1');
  wizard.elegirMotivo('Otro');
  await wizard.confirmar();
  setResponder(() => ({ success: true, sesion: { ...app.cache.sesiones[0], CanalAvisoCancelacion: 'correo' },
    notificacion: { canal: 'correo', yaRegistrado: true, error: 'El aviso por correo ya está registrado; no se volverá a enviar.' } }));
  assert.equal(await wizard.elegirCanal('correo'), false);
  assert.equal(els['cancelar-canal-correo'].disabled, true);
  assert.equal(els['cancelar-canal-correo-info'].textContent, 'Already recorded');
  assert.match(els['cancelar-resultado'].innerHTML, /already recorded/);
  assert.equal(await wizard.elegirCanal('correo'), false);
  assert.equal(calls.length, 2);
});

test('error de servidor permite reintentar correo y el idioma inglés traduce los estados', async () => {
  const { app, wizard, els, setResponder } = client();
  app.preferences.idioma = 'en';
  wizard.abrir('s1');
  wizard.elegirMotivo('Otro');
  await wizard.confirmar();
  assert.equal(els['cancelar-terminar'].textContent, 'Do not notify');
  setResponder(() => Promise.reject(new Error('Sin conexión')));
  const pendiente = wizard.elegirCanal('correo');
  assert.equal(els['cancelar-canal-correo-info'].textContent, 'Sending…');
  assert.equal(await pendiente, false);
  assert.equal(els['cancelar-canal-correo'].disabled, false);
  assert.equal(els['cancelar-canal-correo-info'].textContent, 'Error. You can retry.');
  assert.match(els['cancelar-resultado'].innerHTML, /Offline/);
  setResponder(canal => ({ success: true, sesion: { ...app.cache.sesiones[0], CanalAvisoCancelacion: canal }, notificacion: { canal, avisados: 1 } }));
  assert.equal(await wizard.elegirCanal('correo'), true);
  assert.equal(els['cancelar-canal-correo-info'].textContent, 'Sent ✓');
  assert.equal(els['cancelar-terminar'].textContent, 'Done');
  assert.match(els['cancelar-resultado'].innerHTML, /Families notified by email/);
});

test('si falla el portapapeles se muestra el texto y si falla el registro se explica', async () => {
  const { wizard, els, navigator, setResponder } = client();
  wizard.abrir('s1');
  wizard.elegirMotivo('Otro');
  await wizard.confirmar();
  navigator.clipboard.writeText = () => Promise.reject(new Error('bloqueado'));
  setResponder(() => Promise.reject(new Error('Sin conexión')));
  assert.equal(await wizard.elegirCanal('copiar'), false);
  assert.match(els['cancelar-estado-copiar'].innerHTML, /Entrenamiento cancelado/);
  assert.match(els['cancelar-error-copiar'].textContent, /No se pudo guardar el canal\. Sin conexión/);
  assert.equal(els['cancelar-terminar'].textContent, 'Listo');
});

test('el error incluido en notificación de un canal también se muestra', async () => {
  const { app, wizard, els, setResponder } = client();
  wizard.abrir('s1');
  wizard.elegirMotivo('Otro');
  await wizard.confirmar();
  setResponder(canal => ({ success: true, sesion: { ...app.cache.sesiones[0], CanalAvisoCancelacion: canal }, notificacion: { canal, error: 'Fallo al registrar' } }));
  assert.equal(await wizard.elegirCanal('whatsapp'), false);
  assert.equal(els['cancelar-error-whatsapp'].textContent, 'Fallo al registrar');
  assert.equal(wizard._paso, 'aviso');
});

test('cerrar sin avisar no registra canal y conserva la firma del mensaje', async () => {
  const { app, wizard, els, calls } = client();
  wizard.abrir('s1');
  wizard.elegirMotivo('Otro');
  await wizard.confirmar();
  assert.equal(els['cancelar-terminar'].textContent, 'No avisar');
  wizard.cerrar();
  assert.equal(calls.length, 1);
  const sesion = { ID: 's1', ID_Equipo: 'e1', Fecha: '2026-11-16', HoraInicio: '19:00', HoraFin: '20:30' }, equipo = app.cache.equipos[0];
  assert.match(wizard.mensaje(sesion, equipo, 'Otro', ''), /\n\nUn saludo,\nCB Baeza$/);
  assert.match(wizard.mensaje({ ...sesion, CanceladoPor: 'Ana Gil' }, equipo, 'Otro', ''), /\n\nUn saludo,\nAna Gil$/);
});

test('una respuesta tardía actualiza solo su sesión y no cambia otro asistente abierto', async () => {
  const { app, wizard, els, setResponder } = client();
  wizard.abrir('s1');
  wizard.elegirMotivo('Otro');
  await wizard.confirmar();
  const primera = { ...app.cache.sesiones[0] };
  let resolver;
  setResponder(() => new Promise(resolve => { resolver = resolve; }));
  const pendiente = wizard.elegirCanal('correo');
  await Promise.resolve();
  wizard.cerrar();
  app.cache.sesiones.push({ ID: 's2', ID_Equipo: 'e1', Fecha: '2026-11-17', HoraInicio: '19:00', HoraFin: '20:30' });
  wizard.abrir('s2');
  assert.equal(els['cancelar-terminar'].textContent, 'No avisar');
  resolver({ success: true, sesion: { ...primera, CanalAvisoCancelacion: 'correo' }, notificacion: { canal: 'correo', avisados: 1 } });
  assert.equal(await pendiente, true);
  assert.equal(app.cache.sesiones.find(s => s.ID === 's1').CanalAvisoCancelacion, 'correo');
  assert.equal(app.cache.sesiones.find(s => s.ID === 's2').CanalAvisoCancelacion, undefined);
  assert.equal(wizard._sesionId, 's2');
  assert.equal(els['cancelar-canal-correo'].disabled, false);
  assert.equal(els['cancelar-terminar'].textContent, 'No avisar');
  assert.equal(els['cancelar-resultado'].innerHTML, '');
});
