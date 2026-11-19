const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const TOKEN = 'token-largo-para-agente-1234567890';
const entrenador = { tipo: 'entrenador', email: 'coach@example.com', pin: '1234' };
const admin = { tipo: 'entrenador', email: 'admin@example.com', pin: '4321' };
const jugador = { tipo: 'jugador', usuario: 'j1', pin: '1111' };

function servidor(env = 'DEV') {
  const rows = {
    Entrenadores: [{ Email: entrenador.email, PIN: entrenador.pin }],
    Administradores: [{ Email: admin.email, PIN: admin.pin, Activo: true }],
    Jugadores: [{ Usuario: jugador.usuario, PIN: jugador.pin }],
    hub_ejercicios: [], hub_ejercicio_habilidades: [], hub_ejercicio_material: [],
    hub_ejercicio_enlaces: [], hub_ejercicio_medios: [],
  };
  const reads = [];
  const calls = [];
  const properties = { HUB_EJERCICIOS_AGENT_TOKEN: TOKEN };
  let failRpc = false;
  const context = vm.createContext({
    getSheetData(table) { reads.push(table); return rows[table] || []; },
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => properties[name] }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (algorithm, value) => crypto.createHash(algorithm).update(value).digest(),
    },
    getSupabaseConfig_: () => ({ url: 'https://dev.supabase.co', key: 'secret-backend' }),
    SUPABASE_TABLE_CACHE_: new Map(),
    parseSupabaseResponse_: response => response,
    UrlFetchApp: { fetch(url, options) {
      calls.push({ url, options });
      if (failRpc) throw new Error('Detalle privado de Supabase');
      return JSON.parse(options.payload).p_ejercicios.sort((a, b) => a.slug.localeCompare(b.slug))
        .map((e, i) => ({ id: 'id-' + i, slug: e.slug }));
    } },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: text => ({ text, setMimeType(mime) { this.mime = mime; return this; } }),
    },
  });
  for (const file of ['Config.gs', 'Auth.gs', 'HubEjercicios.gs', 'Code.gs']) {
    let source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
    if (file === 'Config.gs') source = source.replace("const SUPABASE_ENV = 'UNPUBLISHED';", `const SUPABASE_ENV = '${env}';`);
    vm.runInContext(source, context);
  }
  return {
    rows, reads, calls, properties, context,
    failRpc() { failRpc = true; },
    post(body) {
      const output = context.doPost({ postData: { contents: JSON.stringify(body) } });
      assert.equal(output.mime, 'json');
      return JSON.parse(output.text);
    },
    postRaw(contents) { return JSON.parse(context.doPost({ postData: { contents } }).text); },
    listar(auth) { return JSON.parse(JSON.stringify(context.listarEjercicios(auth))); },
  };
}

function ejercicio(cambios = {}) {
  return {
    slug: 'nuevo-ejercicio', nombre: 'Nuevo ejercicio', nombre_en: 'New drill',
    fecha_enviado: '2026-11-20', fuente: 'Trainer Bot', objetivo: 'Mejorar el bote',
    como_se_hace: 'Practicar', claves: ['Mirar al frente'], version_facil: 'Sin defensa',
    version_dificil: 'Con defensa', nota: '', formato: 'juego', oposicion: 'igualdad',
    organizacion: 'parejas', habilidades: ['bote', 'salida'], material: ['conos'],
    enlaces: [{ tipo: 'video', etiqueta: 'Vídeo', url: 'https://example.com/video' }],
    medios: [{ tipo: 'youtube', youtube_id: 'abc', es_miniatura: true }],
    ...cambios,
  };
}

test('listar solo autoriza entrenador y admin con credenciales válidas antes de leer el catálogo', () => {
  const s = servidor();
  for (const auth of [null, jugador, { ...entrenador, pin: '9999' }, { ...entrenador, email: 'nadie@example.com' }]) {
    assert.equal(s.listar(auth).success, false);
    assert.equal(s.reads.some(table => table.startsWith('hub_')), false);
  }
  assert.equal(s.listar(entrenador).success, true);
  assert.equal(s.listar(admin).success, true);
});

test('listar construye el contrato sin columnas adicionales y ordena enlaces y medios', () => {
  const s = servidor();
  s.rows.hub_ejercicios.push({ id: 'e1', slug: 'uno', nombre: 'Uno', claves: ['a'], activo: true, secreto: 'no mostrar' }, { id: 'e2', slug: 'inactivo', activo: false });
  s.rows.hub_ejercicio_habilidades.push({ ejercicio_id: 'e1', habilidad: 'bote' }, { ejercicio_id: 'otro', habilidad: 'defensa' });
  s.rows.hub_ejercicio_material.push({ ejercicio_id: 'e1', material: 'conos' });
  s.rows.hub_ejercicio_enlaces.push({ ejercicio_id: 'e1', tipo: 'fuente', url: 'https://b.es', orden: 2 }, { ejercicio_id: 'e1', tipo: 'video', url: 'https://a.es', orden: 1 });
  s.rows.hub_ejercicio_medios.push({ ejercicio_id: 'e1', tipo: 'gif', ruta_o_url: 'b.gif', orden: 3 }, { ejercicio_id: 'e1', tipo: 'imagen', ruta_o_url: 'a.png', orden: 0 });
  const listado = s.listar(entrenador).ejercicios;
  assert.equal(listado.length, 1);
  const item = listado[0];
  assert.deepEqual(item.habilidades, ['bote']);
  assert.deepEqual(item.material, ['conos']);
  assert.deepEqual(item.claves, ['a']);
  assert.deepEqual(item.enlaces.map(e => e.url), ['https://a.es', 'https://b.es']);
  assert.deepEqual(item.medios.map(m => m.ruta_o_url), ['a.png', 'b.gif']);
  assert.equal('secreto' in item, false);
});

test('doPost autoriza token en cada petición, no acepta PRO ni configuración ausente o corta', () => {
  for (const env of ['PRO', 'UNPUBLISHED']) {
    const s = servidor(env);
    assert.equal(s.post({ token: TOKEN, ejercicio: ejercicio() }).ok, false);
    assert.equal(s.calls.length, 0);
  }
  const s = servidor();
  for (const token of ['', 'incorrecto', TOKEN + 'x', null, 123]) {
    assert.equal(s.post({ token, ejercicio: ejercicio() }).ok, false);
  }
  delete s.properties.HUB_EJERCICIOS_AGENT_TOKEN;
  assert.equal(s.post({ token: TOKEN, ejercicio: ejercicio() }).ok, false);
  s.properties.HUB_EJERCICIOS_AGENT_TOKEN = 'corto';
  assert.equal(s.post({ token: 'corto', ejercicio: ejercicio() }).ok, false);
  assert.equal(s.calls.length, 0);
});

test('doPost admite objeto, plano y lote y envía un único RPC con claves solo al servidor', () => {
  const s = servidor();
  assert.deepEqual(s.post({ token: TOKEN, ejercicio: ejercicio() }), { ok: true, id: 'id-0', slug: 'nuevo-ejercicio' });
  assert.deepEqual(s.post({ token: TOKEN, ...ejercicio({ slug: 'plano' }) }), { ok: true, id: 'id-0', slug: 'plano' });
  const result = s.post({ token: TOKEN, ejercicios: [ejercicio(), ejercicio({ slug: 'otro' })] });
  assert.deepEqual(result, { ok: true, ejercicios: [{ id: 'id-0', slug: 'nuevo-ejercicio' }, { id: 'id-1', slug: 'otro' }] });
  const request = s.calls[2];
  assert.equal(request.url, 'https://dev.supabase.co/rest/v1/rpc/hub_upsert_ejercicios');
  assert.equal(request.options.headers.apikey, 'secret-backend');
  assert.equal(JSON.stringify(result).includes('secret-backend'), false);
  const payload = JSON.parse(request.options.payload);
  assert.equal(payload.p_ejercicios.length, 2);
  assert.deepEqual(payload.p_ejercicios[0].habilidades, ['bote', 'salida']);
  assert.equal(payload.p_ejercicios[0].enlaces[0].orden, 0);
  assert.equal(payload.p_ejercicios[0].medios[0].orden, 0);
  assert.equal('token' in payload, false);
});

test('la respuesta del lote conserva el orden solicitado aunque la RPC lo reordene', () => {
  const s = servidor();
  const resultado = s.post({ token: TOKEN, ejercicios: [ejercicio({ slug: 'zeta' }), ejercicio({ slug: 'alfa' })] });
  assert.deepEqual(resultado.ejercicios, [{ id: 'id-1', slug: 'zeta' }, { id: 'id-0', slug: 'alfa' }]);
});

test('doPost acepta rutas relativas y valida de nuevo el token al rotarlo', () => {
  const s = servidor();
  const item = ejercicio({ detalle_corto: true, medios: [{ tipo: 'imagen', ruta_o_url: 'espejo' }] });
  assert.equal(s.post({ token: TOKEN, ejercicio: item }).ok, true);
  assert.equal(JSON.parse(s.calls[0].options.payload).p_ejercicios[0].detalle_corto, true);
  s.properties.HUB_EJERCICIOS_AGENT_TOKEN = 'otro-token-largo-para-agente-123456789';
  assert.equal(s.post({ token: TOKEN, ejercicio: item }).ok, false);
  assert.equal(s.post({ token: s.properties.HUB_EJERCICIOS_AGENT_TOKEN, ejercicio: item }).ok, true);
  assert.equal(s.calls.length, 2);
});

test('una ficha reenviada puede conservar una imagen embebida de la semilla', () => {
  const s = servidor();
  const item = ejercicio({ medios: [{ tipo: 'imagen', ruta_o_url: 'data:image/png;base64,AAAA', es_miniatura: true }] });
  assert.equal(s.post({ token: TOKEN, ejercicio: item }).ok, true);
  assert.equal(JSON.parse(s.calls[0].options.payload).p_ejercicios[0].medios[0].ruta_o_url, item.medios[0].ruta_o_url);
});

test('cada validación rechaza todo el lote antes de cualquier escritura', () => {
  const invalidos = [
    ejercicio({ slug: 'Mayúscula o espacios' }), ejercicio({ nombre: ' '.repeat(2) }),
    ejercicio({ formato: 'inexistente' }), ejercicio({ oposicion: 'otro' }), ejercicio({ organizacion: 'otro' }),
    ejercicio({ habilidades: ['bote', 'bote'] }), ejercicio({ material: ['balon'] }), ejercicio({ claves: 'texto' }),
    ejercicio({ fecha_enviado: '2026-02-29' }), ejercicio({ nombre: 'x'.repeat(201) }),
    ejercicio({ detalle_corto: 'true' }),
    ejercicio({ enlaces: [{ tipo: 'video', url: 'javascript:alert(1)' }] }),
    ejercicio({ enlaces: [{ tipo: 'video', url: 'https://example.com:99999/' }] }),
    ejercicio({ enlaces: [{ tipo: 'video', url: 'https://example.com.evil..com/' }] }),
    ejercicio({ medios: [{ tipo: 'imagen', ruta_o_url: '//evil.example/image' }] }),
    ejercicio({ medios: [{ tipo: 'imagen', ruta_o_url: '../image' }] }),
    ejercicio({ medios: [{ tipo: 'imagen', ruta_o_url: 'data:image/png,abc' }] }),
    ejercicio({ medios: [{ tipo: 'youtube', youtube_id: 'a"b' }] }),
    ejercicio({ medios: [{ tipo: 'youtube', youtube_id: 'abc', es_miniatura: 'true' }] }),
    ejercicio({ enlaces: [{ tipo: 'otro', url: 'https://example.com' }] }),
    ejercicio({ enlaces: [{ tipo: 'video', url: 'https://example.com', orden: -1 }] }),
    ejercicio({ enlaces: Array(51).fill({ tipo: 'video', url: 'https://example.com' }) }),
    ejercicio({ propiedad_no_permitida: 'x' }),
  ];
  for (const invalido of invalidos) {
    const s = servidor();
    assert.equal(s.post({ token: TOKEN, ejercicios: [ejercicio(), invalido] }).ok, false, JSON.stringify(invalido));
    assert.equal(s.calls.length, 0);
  }
  const s = servidor();
  assert.equal(s.post({ token: TOKEN, ejercicios: [ejercicio(), ejercicio()] }).ok, false);
  assert.equal(s.post({ token: TOKEN, ejercicios: [] }).ok, false);
  assert.equal(s.post({ token: TOKEN, ejercicio: ejercicio(), ejercicios: [ejercicio()] }).ok, false);
  assert.equal(s.postRaw('{mal json').ok, false);
  assert.equal(s.postRaw('x'.repeat(1000001)).ok, false);
  assert.equal(s.calls.length, 0);
});

test('los fallos de Supabase no filtran detalles y no producen éxitos parciales', () => {
  const s = servidor();
  s.failRpc();
  const result = s.post({ token: TOKEN, ejercicios: [ejercicio(), ejercicio({ slug: 'otro' })] });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'No se pudieron guardar los ejercicios.');
  assert.equal(s.calls.length, 1);
});
