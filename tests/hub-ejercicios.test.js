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
const EJEMPLOS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/hub-ejemplos-v2.json'), 'utf8'));
const ficha = slug => JSON.parse(JSON.stringify(EJEMPLOS.find(f => f.slug === slug)));
const plano = v => JSON.parse(JSON.stringify(v));

function servidor(env = 'DEV') {
  const rows = {
    Entrenadores: [{ Email: entrenador.email, PIN: entrenador.pin }],
    Administradores: [{ Email: admin.email, PIN: admin.pin, Activo: true }],
    Jugadores: [{ Usuario: jugador.usuario, PIN: jugador.pin }],
    hub_contenidos: [], hub_recursos: [], hub_progresion_pasos: [], hub_sesion_bloques: [],
  };
  const lecturas = [];
  const rpc = [];
  const patches = [];
  const properties = { HUB_EJERCICIOS_AGENT_TOKEN: TOKEN };
  let respuestaRpc = null;
  let fallaRpc = false;
  const context = vm.createContext({
    getSheetData: table => rows[table] || [],
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => properties[name] }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (algorithm, value) => crypto.createHash(algorithm).update(value).digest(),
    },
    getSupabaseConfig_: () => ({ url: 'https://dev.supabase.co', key: 'sb_secret_backend' }),
    supabaseRequestParams_: (tabla, method, query) => ({ url: tabla + '?' + query, options: { method } }),
    supabaseFilter_: (campo, valor) => campo + '=eq.' + valor,
    supabaseRequest_: (tabla, method, query, payload, prefer) => {
      patches.push({ tabla, method, query, payload, prefer });
      const slug = /slug=eq\.([^&]+)/.exec(query)[1];
      return rows.hub_contenidos.filter(f => f.slug === slug).map(f => ({ slug: f.slug, estado: payload.estado }));
    },
    SUPABASE_TABLE_CACHE_: new Map(),
    parseSupabaseResponse_: r => r,
    UrlFetchApp: {
      fetchAll: peticiones => peticiones.map(p => {
        const [tabla, query] = p.url.split('?');
        lecturas.push({ tabla, query });
        return rows[tabla].map(f => Object.assign({}, f));
      }),
      fetch(url, options) {
        if (fallaRpc) throw new Error('Detalle privado de Supabase');
        const cuerpo = JSON.parse(options.payload);
        rpc.push({ url, options, cuerpo });
        return respuestaRpc ? respuestaRpc(cuerpo) : cuerpo.p_fichas.map(f => ({ slug: f.slug, id: 'id-' + f.slug, accion: 'insertado' }));
      },
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: text => ({ text, setMimeType(mime) { this.mime = mime; return this; } }),
    },
  });
  for (const file of ['Config.gs', 'Schema.gs', 'Auth.gs', 'HubEsquema.gs', 'HubEjercicios.gs', 'Code.gs']) {
    let source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
    if (file === 'Config.gs') source = source.replace("const SUPABASE_ENV = 'UNPUBLISHED';", `const SUPABASE_ENV = '${env}';`);
    vm.runInContext(source, context);
  }
  return {
    rows, lecturas, rpc, patches, properties,
    responder(fn) { respuestaRpc = fn; },
    fallar() { fallaRpc = true; },
    post(body) {
      const output = context.doPost({ postData: { contents: JSON.stringify(body) } });
      assert.equal(output.mime, 'json');
      return JSON.parse(output.text);
    },
    listar: auth => plano(context.listarHub(auth)),
    estado: (auth, slug, estado) => plano(context.cambiarEstadoHub(auth, slug, estado)),
  };
}

test('doPost exige el token del agente y solo funciona en DEV', () => {
  for (const env of ['PRO', 'UNPUBLISHED']) {
    const s = servidor(env);
    const r = s.post({ token: TOKEN, ficha: ficha('especialistas') });
    assert.equal(r.ok, false);
    assert.match(r.error, /solo en DEV/);
    assert.equal(s.rpc.length + s.lecturas.length, 0);
  }
  const s = servidor();
  for (const token of ['', 'incorrecto', TOKEN + 'x', null, 123]) assert.equal(s.post({ token, ficha: ficha('especialistas') }).ok, false);
  s.properties.HUB_EJERCICIOS_AGENT_TOKEN = 'corto';
  assert.equal(s.post({ token: 'corto', ficha: ficha('especialistas') }).ok, false);
  assert.equal(s.rpc.length + s.lecturas.length, 0);
});

test('una ficha válida se valida, se deriva y se guarda con una sola RPC sin el token', () => {
  const s = servidor();
  const r = s.post({ token: TOKEN, ficha: ficha('especialistas') });
  assert.deepEqual(r, { ok: true, insertados: ['especialistas'], actualizados: [], rechazados: [], avisos: [] });
  assert.equal(s.rpc.length, 1);
  assert.equal(s.rpc[0].url, 'https://dev.supabase.co/rest/v1/rpc/hub_v2_upsertar');
  assert.equal(s.rpc[0].options.payload.includes(TOKEN), false);
  const fila = s.rpc[0].cuerpo.p_fichas[0];
  assert.equal(s.rpc[0].cuerpo.p_enviado_por, 'agente');
  assert.equal(fila.area, 'tecnica_individual');
  assert.equal(fila.youtube_id, 'BJbJ_skvxNs');
  assert.equal(fila.reglas, null, 'lo que no se envía se guarda vacío (UPSERT completo)');
  // La ficha plana (con token en el mismo nivel) también se acepta.
  assert.equal(s.post({ token: TOKEN, ...ficha('especialistas') }).ok, true);
});

test('un lote guarda las válidas, devuelve las rechazadas con sus errores y los avisos', () => {
  const s = servidor();
  s.rows.hub_contenidos.push(...['lee-la-mano', 'muerde-a-la-tercera', 'rooted', 'superar-defensor-puertas', 'pilla-pilla-botando'].map(slug => ({ slug, tipo_contenido: 'ejercicio' })));
  s.responder(cuerpo => cuerpo.p_fichas.map(f => ({ slug: f.slug, accion: f.slug === 'especialistas' ? 'actualizado' : 'insertado' })));
  const malo = { ...ficha('tres-fases-del-ataque-film-room'), esfuerzo_fisico: 3, nota: 'Contacto: 612345678' };
  const r = s.post({ token: TOKEN, fichas: [ficha('especialistas'), ficha('rey-de-la-pista'), malo, ficha('progresion-leer-al-defensor-con-bote')] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.actualizados, ['especialistas']);
  assert.deepEqual(r.insertados.sort(), ['progresion-leer-al-defensor-con-bote', 'rey-de-la-pista']);
  assert.equal(r.rechazados.length, 1);
  assert.equal(r.rechazados[0].slug, 'tres-fases-del-ataque-film-room');
  assert.ok(r.rechazados[0].errores.some(e => /esfuerzo_fisico no aplica a teoria/.test(e)));
  assert.ok(r.rechazados[0].errores.some(e => /teléfono/.test(e)));
  assert.ok(r.avisos.some(a => a.slug === 'rey-de-la-pista' && a.avisos.some(m => /pendiente de subir/.test(m))));
  assert.deepEqual(s.rpc[0].cuerpo.p_fichas.map(f => f.slug).sort(), ['especialistas', 'progresion-leer-al-defensor-con-bote', 'rey-de-la-pista']);
});

test('formatos v1, peticiones vacías o demasiado grandes y slugs de otro tipo se rechazan antes de escribir', () => {
  const s = servidor();
  const v1 = s.post({ token: TOKEN, ejercicio: { slug: 'viejo', nombre: 'Viejo', formato: 'juego' } });
  assert.equal(v1.ok, false);
  assert.match(v1.error, /Formato v1 retirado/);
  const plano1 = s.post({ token: TOKEN, slug: 'viejo', nombre: 'Viejo', formato: 'juego' });
  assert.equal(plano1.ok, false);
  assert.match(plano1.rechazados[0].errores[0], /v1.*version_esquema/);
  assert.match(s.post({ token: TOKEN, fichas: [] }).error, /no contiene fichas/);
  assert.match(s.post({ token: TOKEN, fichas: Array(101).fill(ficha('especialistas')) }).error, /Máximo 100/);
  assert.match(s.post({ token: TOKEN, ficha: ficha('especialistas'), extra: 1 }).error, /solo token y ficha/);
  s.rows.hub_contenidos.push({ slug: 'especialistas', tipo_contenido: 'teoria' });
  const cambio = s.post({ token: TOKEN, ficha: ficha('especialistas') });
  assert.match(cambio.rechazados[0].errores.join(' '), /ya existe como teoria/);
  assert.equal(s.rpc.length, 0);
});

test('un fallo de Supabase no filtra detalles ni da éxitos parciales', () => {
  const s = servidor();
  s.fallar();
  const r = s.post({ token: TOKEN, ficha: ficha('especialistas') });
  assert.equal(r.ok, false);
  assert.doesNotMatch(r.error, /privado/);
  assert.deepEqual([r.insertados, r.actualizados], [[], []]);
  const t = servidor();
  t.responder(() => [{ slug: 'otra', accion: 'insertado' }]);
  assert.match(t.post({ token: TOKEN, ficha: ficha('especialistas') }).error, /Respuesta inesperada/);
});

test('listarHub autoriza entrenador y admin, monta recursos, pasos y agregados y oculta archivados', () => {
  const s = servidor();
  for (const auth of [null, jugador, { ...entrenador, pin: '9999' }]) {
    assert.equal(s.listar(auth).success, false);
    assert.equal(s.lecturas.length, 0);
  }
  const base = { estado: 'propuesto', categorias: ['infantil'], material: [], avisos: ['Juego sin reglas.'], sugerencias_vocabulario: [{ campo: 'material', valor: 'x', motivo: 'y' }] };
  s.rows.hub_contenidos.push(
    { ...base, id: 'u1', slug: 'a', tipo_contenido: 'ejercicio', dificultad: 2, minutos_min: 5, minutos_max: 10, jugadores_min: 2, habilidad_principal: 'bote' },
    { ...base, id: 'u2', slug: 'b', tipo_contenido: 'ejercicio', dificultad: 4, minutos_min: 10, minutos_max: 12, jugadores_min: 4, habilidad_principal: 'pase' },
    { ...base, id: 'u3', slug: 'p', tipo_contenido: 'progresion', habilidad_principal: 'bote' },
    { ...base, id: 'u4', slug: 'viejo', tipo_contenido: 'ejercicio', estado: 'archivado' });
  s.rows.hub_recursos.push({ contenido_id: 'u1', orden: 1, etiqueta: 'segundo' }, { contenido_id: 'u1', orden: 0, etiqueta: 'primero', principal: true });
  s.rows.hub_progresion_pasos.push({ progresion_id: 'u3', orden: 1, ejercicio_id: 'u2', criterio_avance: 'luego' }, { progresion_id: 'u3', orden: 0, ejercicio_id: 'u1', criterio_avance: 'antes' });
  const r = s.listar(entrenador);
  assert.equal(r.success, true);
  assert.deepEqual(r.fichas.map(f => f.slug), ['a', 'b', 'p']);
  const a = r.fichas[0], p = r.fichas[2];
  assert.deepEqual(a.recursos.map(x => x.etiqueta), ['primero', 'segundo']);
  assert.equal('contenido_id' in a.recursos[0] || 'id' in a, false);
  assert.deepEqual(p.pasos, [{ slug: 'a', criterio_avance: 'antes' }, { slug: 'b', criterio_avance: 'luego' }]);
  assert.deepEqual([p.dificultad_min, p.dificultad_max, p.minutos_min, p.minutos_max], [2, 4, 15, 22]);
  assert.equal('avisos' in a || 'sugerencias_vocabulario' in a, false, 'los avisos solo los ve el admin');
  assert.equal(r.vocabulario.etiquetas.habilidad.bote, 'Bote de control');
  const contenidos = s.lecturas.find(l => l.tabla === 'hub_contenidos').query;
  assert.doesNotMatch(contenidos, /[=,](busqueda|enviado_por|revisado_por)(,|&)/);
  assert.match(contenidos, /texto_busqueda/);
  assert.deepEqual(s.listar(admin).fichas[0].avisos, ['Juego sin reglas.']);
});

test('cambiarEstadoHub solo lo usa el admin, valida el estado y registra quién revisa', () => {
  const s = servidor();
  s.rows.hub_contenidos.push({ slug: 'a', estado: 'propuesto' });
  assert.equal(s.estado(entrenador, 'a', 'revisado').success, false);
  assert.equal(s.patches.length, 0);
  assert.match(s.estado(admin, 'a', 'propuesto').error, /Estado no válido/);
  assert.match(s.estado(admin, 'A B', 'revisado').error, /Ficha no válida/);
  assert.match(s.estado(admin, 'no-existe', 'archivado').error, /no existe/);
  assert.deepEqual(s.estado(admin, 'a', 'revisado'), { success: true, slug: 'a', estado: 'revisado' });
  const patch = s.patches.at(-1);
  assert.equal(patch.method, 'patch');
  assert.equal(patch.payload.revisado_por, admin.email);
  assert.equal(patch.prefer, 'return=representation');
});
