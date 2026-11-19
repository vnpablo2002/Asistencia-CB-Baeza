const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function servidor({ falloAviso = false } = {}) {
  const rows = {
    Entrenadores: [{ ID: 'e1', Email: 'ana@example.test', PIN: '1234', Nombre: 'Ana', Apellidos: 'Pérez' }],
    Administradores: [{ ID: 'a1', Email: 'admin@example.test', PIN: '4321', Activo: true }],
    Sesiones: [{ ID: 's1', ID_Equipo: 'equipo', Cancelada: false }],
  };
  const writes = [];
  const avisos = [];
  let ocupado = false;
  const propiedades = new Map();
  let token = 0;
  const context = vm.createContext({
    Utilities: { getUuid: () => 'token-' + ++token },
    PropertiesService: { getScriptProperties: () => ({
      setProperty: (clave, valor) => propiedades.set(clave, valor),
      getProperty: clave => propiedades.get(clave) || null,
      deleteProperty: clave => propiedades.delete(clave),
    }) },
    LockService: { getScriptLock() {
      let propio = false;
      return {
        waitLock() { if (ocupado) throw new Error('Bloqueo ocupado'); ocupado = propio = true; },
        hasLock: () => propio,
        releaseLock() { ocupado = propio = false; },
      };
    } },
    getSheetData: table => rows[table] || [],
    findById: (table, id) => (rows[table] || []).find(row => row.ID === id),
    updateRow(table, id, cambios) {
      writes.push({ table, id, cambios: { ...cambios } });
      Object.assign(rows[table].find(row => row.ID === id), cambios);
    },
    Asistencia: { _timestamp_: () => '2026-11-11 10:00' },
    Notificaciones: { avisarCancelacionAFamilias(sesion, canal) {
      avisos.push({ sesion: { ...sesion }, canal });
      if (falloAviso) throw new Error('Error ficticio');
      return { canal };
    } },
    Logger: { log() {} },
  });
  for (const file of ['Config.gs', 'Auth.gs', 'Sesiones.gs', 'Code.gs']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context);
  }
  const cancelar = (auth, opciones) => {
    context.auth = auth;
    context.opciones = opciones;
    return vm.runInContext("cancelarSesion(auth, 's1', 'Climatología', opciones)", context);
  };
  const avisar = (auth, canal) => {
    context.auth = auth;
    context.canal = canal;
    return vm.runInContext("avisarCancelacion(auth, 's1', canal)", context);
  };
  const reactivar = auth => {
    context.auth = auth;
    return vm.runInContext("reactivarSesion(auth, 's1')", context);
  };
  return { rows, writes, avisos, cancelar, avisar, reactivar };
}

const entrenador = { tipo: 'entrenador', email: 'ANA@example.test', pin: '1234' };
const admin = { tipo: 'entrenador', email: 'admin@example.test', pin: '4321' };

test('guarda el nombre de la ficha autenticada al cancelar, ignorando el emisor facilitado por el cliente; el canal se guarda al avisar', () => {
  for (const canal of ['whatsapp', 'correo', 'copiar', 'ninguno']) {
    const s = servidor();
    const res = s.cancelar(entrenador, { CanceladoPor: 'Suplantación', nombre: 'Suplantación' });
    assert.equal(res.success, true);
    assert.equal(res.sesion.CanceladoPor, 'Ana Pérez');
    assert.equal(res.sesion.CanalAvisoCancelacion, null);
    assert.equal(s.writes[0].cambios.CanceladoPor, 'Ana Pérez');
    assert.equal(s.writes[0].cambios.CanalAvisoCancelacion, null);
    assert.equal(s.avisos.length, 0);
    const aviso = s.avisar(entrenador, canal);
    assert.equal(aviso.success, true);
    assert.equal(aviso.sesion.CanalAvisoCancelacion, canal);
    assert.equal(s.writes[1].cambios.CanalAvisoCancelacion, canal);
    assert.equal(s.avisos[0].sesion.CanceladoPor, 'Ana Pérez');
    assert.equal(s.avisos[0].canal, canal);
  }
});

test('admin sin ficha usa CB Baeza; cancelar no registra canal', () => {
  const s = servidor();
  const res = s.cancelar(admin);
  assert.equal(res.success, true);
  assert.equal(res.sesion.CanceladoPor, 'CB Baeza');
  assert.equal(res.sesion.CanalAvisoCancelacion, null);
});

test('admin con ficha utiliza el nombre de esa ficha; si está vacío usa CB Baeza', () => {
  for (const [nombre, apellidos, esperado] of [['Luis', 'García', 'Luis García'], ['', '', 'CB Baeza']]) {
    const s = servidor();
    s.rows.Entrenadores.push({ ID: 'e2', Email: 'admin@example.test', PIN: '4321', Nombre: nombre, Apellidos: apellidos });
    const res = s.cancelar(admin);
    assert.equal(res.success, true);
    assert.equal(res.sesion.CanceladoPor, esperado);
  }
});

test('autenticación inválida no escribe; un canal inválido no avisa ni guarda canal', () => {
  const s = servidor();
  assert.equal(s.cancelar({ ...entrenador, pin: 'incorrecto' }).success, false);
  assert.equal(s.writes.length, 0);
  assert.equal(s.cancelar(entrenador).success, true);
  assert.equal(s.avisar(entrenador, 'sms').success, false);
  assert.equal(s.writes.length, 1);
  assert.equal(s.avisos.length, 0);
  assert.equal(s.rows.Sesiones[0].CanalAvisoCancelacion, null);
});

test('fallo antes de enviar permite reintentar; reactivar borra identidad y canal', () => {
  const s = servidor({ falloAviso: true });
  assert.equal(s.cancelar(entrenador).success, true);
  const res = s.avisar(entrenador, 'correo');
  assert.equal(res.success, true);
  assert.ok(res.notificacion.error);
  assert.equal(s.rows.Sesiones[0].CanceladoPor, 'Ana Pérez');
  assert.equal(s.rows.Sesiones[0].CanalAvisoCancelacion, null);
  const reactivada = s.reactivar(entrenador);
  assert.equal(reactivada.success, true);
  assert.equal(reactivada.sesion.CanceladoPor, null);
  assert.equal(reactivada.sesion.CanalAvisoCancelacion, null);
  assert.equal(s.writes.at(-1).cambios.CanceladoPor, null);
  assert.equal(s.writes.at(-1).cambios.CanalAvisoCancelacion, null);
});

test('una cancelación anterior sin emisor ni canal se puede reactivar y volver a cancelar y avisar', () => {
  const s = servidor();
  Object.assign(s.rows.Sesiones[0], { Cancelada: true, MotivoCancelacion: 'Otro', FechaCancelacion: '2025-01-01 10:00' });
  const reactivada = s.reactivar(entrenador);
  assert.equal(reactivada.success, true);
  assert.equal(reactivada.sesion.CanceladoPor, null);
  assert.equal(reactivada.sesion.CanalAvisoCancelacion, null);
  const res = s.cancelar(entrenador);
  assert.equal(res.success, true);
  assert.equal(res.sesion.CanceladoPor, 'Ana Pérez');
  assert.equal(res.sesion.CanalAvisoCancelacion, null);
  const aviso = s.avisar(entrenador, 'copiar');
  assert.equal(aviso.success, true);
  assert.equal(aviso.sesion.CanalAvisoCancelacion, 'copiar');
});

test('copiar y WhatsApp se acumulan en cualquier orden y se pueden repetir sin duplicados', () => {
  for (const [primero, segundo] of [['copiar', 'whatsapp'], ['whatsapp', 'copiar']]) {
    const s = servidor();
    s.cancelar(entrenador);
    for (const canal of [primero, segundo, primero, segundo]) {
      assert.equal(s.avisar(entrenador, canal).success, true);
    }
    assert.equal(s.rows.Sesiones[0].CanalAvisoCancelacion, primero + ',' + segundo);
    assert.equal(s.avisos.length, 4);
    assert.equal(s.writes.length, 3);
  }
});

test('ninguno solo se registra sin canales y se sustituye cuando se avisa', () => {
  const s = servidor();
  s.cancelar(entrenador);
  assert.equal(s.avisar(entrenador, 'ninguno').sesion.CanalAvisoCancelacion, 'ninguno');
  assert.equal(s.avisar(entrenador, 'ninguno').sesion.CanalAvisoCancelacion, 'ninguno');
  assert.equal(s.avisar(entrenador, 'copiar').sesion.CanalAvisoCancelacion, 'copiar');
  assert.equal(s.avisar(entrenador, 'ninguno').sesion.CanalAvisoCancelacion, 'copiar');
  assert.equal(s.avisar(entrenador, 'whatsapp').sesion.CanalAvisoCancelacion, 'copiar,whatsapp');
});

test('valores antiguos se conservan y correo previo impide otro envío sin bloquear otros canales', () => {
  for (const anterior of ['correo', 'copiar', 'whatsapp', 'ninguno', null]) {
    const s = servidor();
    Object.assign(s.rows.Sesiones[0], { Cancelada: true, CanalAvisoCancelacion: anterior });
    const aviso = s.avisar(entrenador, 'correo');
    if (anterior === 'correo') {
      assert.equal(aviso.success, true);
      assert.equal(aviso.notificacion.yaRegistrado, true);
      assert.match(aviso.notificacion.error, /correo.*ya está registrado/);
      assert.equal(s.avisos.length, 0);
    } else {
      assert.equal(aviso.success, true);
      assert.equal(aviso.sesion.CanalAvisoCancelacion,
        anterior && anterior !== 'ninguno' ? anterior + ',correo' : 'correo');
    }
    const copiar = s.avisar(entrenador, 'copiar');
    assert.equal(copiar.success, true);
    assert.equal(copiar.sesion.CanalAvisoCancelacion.split(',').filter(c => c === 'correo').length, 1);
    assert.equal(s.avisar(entrenador, 'correo').notificacion.yaRegistrado, true);
  }
});

test('un fallo antes de enviar conserva los demás canales y restaura ninguno si era el único', () => {
  for (const anterior of ['ninguno', 'copiar,whatsapp']) {
    const s = servidor({ falloAviso: true });
    Object.assign(s.rows.Sesiones[0], { Cancelada: true, CanalAvisoCancelacion: anterior });
    const res = s.avisar(entrenador, 'correo');
    assert.equal(res.success, true);
    assert.match(res.notificacion.error, /volver a intentarlo/);
    assert.equal(res.sesion.CanalAvisoCancelacion, anterior);
  }
});

test('normaliza espacios y duplicados sin volver a añadir ninguno junto a otros canales', () => {
  const s = servidor();
  Object.assign(s.rows.Sesiones[0], { Cancelada: true, CanalAvisoCancelacion: 'ninguno, whatsapp, whatsapp' });
  const res = s.avisar(entrenador, 'ninguno');
  assert.equal(res.success, true);
  assert.equal(res.sesion.CanalAvisoCancelacion, 'whatsapp');
  assert.equal(s.avisar(entrenador, 'copiar').sesion.CanalAvisoCancelacion, 'whatsapp,copiar');
});
