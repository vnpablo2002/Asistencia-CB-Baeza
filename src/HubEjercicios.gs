/**
 * Hub de ejercicios v2: listado para entrenadores, bandeja de revisión y entrada privada del agente.
 * La validación y los derivados viven en HubEsquema.gs (compartido con scripts/seed-hub-v2.mjs).
 */
const HubEjercicios = {
  MAXIMO_LOTE: 100,
  PAGINA: 1000,
  // Columnas que no viajan al navegador: internas, de auditoría o el tsvector.
  OCULTAS: ['busqueda', 'enviado_por', 'revisado_por', 'revisado_at', 'created_at', 'version_esquema'],

  /** Lee varias consultas PostgREST en paralelo, paginando cada una. */
  leer(consultas) {
    const pedir = (tabla, query, offset) => {
      const peticion = supabaseRequestParams_(tabla, 'get', query + '&limit=' + this.PAGINA + '&offset=' + offset);
      return Object.assign({ url: peticion.url }, peticion.options);
    };
    const respuestas = UrlFetchApp.fetchAll(consultas.map(c => pedir(c[0], c[1], 0)));
    return consultas.map((c, i) => {
      const filas = parseSupabaseResponse_(respuestas[i]);
      for (let offset = this.PAGINA; filas.length === offset; offset += this.PAGINA) {
        const peticion = pedir(c[0], c[1], offset);
        filas.push(...parseSupabaseResponse_(UrlFetchApp.fetch(peticion.url, peticion)));
      }
      return filas;
    });
  },

  /** Catálogo sin archivados, con recursos, pasos, bloques, agregados y vocabulario. Los avisos solo para admin. */
  listar(esAdmin) {
    const tablas = CONFIG.SHEETS;
    const columnas = SCHEMA[tablas.HUB_CONTENIDOS].filter(c => !this.OCULTAS.includes(c)).join(',');
    const [contenidos, recursos, pasos, bloques] = this.leer([
      [tablas.HUB_CONTENIDOS, 'select=' + columnas + '&order=fecha_enviado.desc,slug.asc'],
      [tablas.HUB_RECURSOS, 'select=contenido_id,orden,tipo_recurso,url,archivo_local,etiqueta,autor,idioma,duracion_seg,inicio_seg,fin_seg,relacion,principal,youtube_id&order=contenido_id.asc,orden.asc'],
      [tablas.HUB_PASOS, 'select=progresion_id,orden,ejercicio_id,criterio_avance&order=progresion_id.asc,orden.asc'],
      [tablas.HUB_BLOQUES, 'select=sesion_id,orden,contenido_id,minutos,nota&order=sesion_id.asc,orden.asc'],
    ]);
    const porId = new Map();
    const fichas = contenidos.map(fila => {
      const ficha = Object.assign({}, fila, { recursos: [] });
      if (ficha.tipo_contenido === 'progresion') ficha.pasos = [];
      if (ficha.tipo_contenido === 'sesion_modelo') ficha.bloques = [];
      porId.set(String(fila.id), ficha);
      return ficha;
    });
    const slugDe = id => (porId.get(String(id)) || {}).slug || null;
    const ordenar = (a, b) => a.orden - b.orden;
    recursos.slice().sort(ordenar).forEach(r => {
      const ficha = porId.get(String(r.contenido_id));
      if (!ficha) return;
      const recurso = Object.assign({}, r);
      delete recurso.contenido_id; delete recurso.orden;
      ficha.recursos.push(recurso);
    });
    pasos.slice().sort(ordenar).forEach(p => {
      const ficha = porId.get(String(p.progresion_id));
      if (ficha && ficha.pasos) ficha.pasos.push({ slug: slugDe(p.ejercicio_id), criterio_avance: p.criterio_avance });
    });
    bloques.slice().sort(ordenar).forEach(b => {
      const ficha = porId.get(String(b.sesion_id));
      if (ficha && ficha.bloques) ficha.bloques.push({ slug: slugDe(b.contenido_id), minutos: b.minutos, nota: b.nota });
    });
    const agregados = HubEsquema.agregados(fichas);
    const visibles = fichas.filter(f => f.estado !== 'archivado').map(f => {
      const salida = Object.assign({}, f, agregados.get(f.slug) || {});
      delete salida.id;
      if (!esAdmin) { delete salida.avisos; delete salida.sugerencias_vocabulario; }
      return salida;
    });
    return { fichas: visibles, vocabulario: HubEsquema.vocabulario() };
  },

  /** Bandeja de revisión: el administrador marca una ficha como revisada o la archiva. */
  cambiarEstado(slug, estado, email) {
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) throw new Error('Ficha no válida.');
    if (estado !== 'revisado' && estado !== 'archivado') throw new Error('Estado no válido.');
    const ahora = new Date().toISOString();
    const filas = supabaseRequest_(CONFIG.SHEETS.HUB_CONTENIDOS, 'patch', supabaseFilter_('slug', slug) + '&select=slug,estado',
      { estado: estado, revisado_por: email || null, revisado_at: ahora, updated_at: ahora }, 'return=representation');
    if (!Array.isArray(filas) || filas.length !== 1) throw new Error('La ficha no existe.');
    return { slug: filas[0].slug, estado: filas[0].estado };
  },

  autenticar(token) {
    if (SUPABASE_ENV !== 'DEV') throw new Error('Entrada del agente disponible solo en DEV.');
    const esperado = PropertiesService.getScriptProperties().getProperty('HUB_EJERCICIOS_AGENT_TOKEN');
    if (typeof esperado !== 'string' || esperado.length < 32 || esperado.length > 512 || typeof token !== 'string' || token.length > 512) throw new Error('Token del agente no válido o no configurado.');
    const digest = valor => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, valor, Utilities.Charset.UTF_8);
    const a = digest(token);
    const b = digest(esperado);
    let diferencia = 0;
    for (let i = 0; i < b.length; i++) diferencia |= a[i] ^ b[i];
    if (diferencia !== 0) throw new Error('Token del agente no válido o no configurado.');
  },

  /**
   * Entrada del agente (doPost). Admite { token, ficha }, { token, fichas: [...] } o la ficha con token en el mismo nivel.
   * Cada ficha se valida por separado: las válidas se guardan (UPSERT por slug) y las demás vuelven con sus errores.
   */
  recibir(datos) {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('La petición debe ser un objeto JSON con token.');
    this.autenticar(datos.token);
    const tiene = clave => Object.prototype.hasOwnProperty.call(datos, clave);
    if (tiene('ejercicio') || tiene('ejercicios')) {
      throw new Error('Formato v1 retirado: envía { token, ficha } o { token, fichas: [...] } con version_esquema: 2 (docs/hub-esquema-v2.md).');
    }
    let entradas;
    if (tiene('fichas') || tiene('ficha')) {
      if (Object.keys(datos).some(clave => !['token', 'ficha', 'fichas'].includes(clave)) || (tiene('fichas') && tiene('ficha'))) {
        throw new Error('Indica solo token y ficha, o token y fichas.');
      }
      entradas = tiene('ficha') ? [datos.ficha] : datos.fichas;
    } else {
      const ficha = Object.assign({}, datos);
      delete ficha.token;
      entradas = Object.keys(ficha).length ? [ficha] : [];
    }
    if (!Array.isArray(entradas) || !entradas.length) throw new Error('La petición no contiene fichas.');
    if (entradas.length > this.MAXIMO_LOTE) throw new Error('Máximo ' + this.MAXIMO_LOTE + ' fichas por petición.');

    const existentes = this.leer([[CONFIG.SHEETS.HUB_CONTENIDOS, 'select=slug,tipo_contenido&order=slug.asc']])[0];
    const lote = HubEsquema.validarLote(entradas, existentes.map(fila => [fila.slug, fila.tipo_contenido]));
    const respuesta = { ok: lote.rechazados.length === 0, insertados: [], actualizados: [], rechazados: lote.rechazados, avisos: lote.avisos };
    if (!lote.filas.length) return respuesta;

    const config = getSupabaseConfig_();
    const headers = { apikey: config.key, Accept: 'application/json', 'Content-Type': 'application/json' };
    if (!config.key.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + config.key;
    let guardados;
    try {
      guardados = parseSupabaseResponse_(UrlFetchApp.fetch(config.url + '/rest/v1/rpc/hub_v2_upsertar', {
        method: 'post', headers: headers, muteHttpExceptions: true,
        payload: JSON.stringify({ p_fichas: lote.filas, p_enviado_por: 'agente' }),
      }));
      SUPABASE_TABLE_CACHE_.clear();
    } catch (error) {
      throw new Error('No se pudieron guardar las fichas; no se ha guardado ninguna del lote.');
    }
    const porSlug = new Map((Array.isArray(guardados) ? guardados : []).map(fila => [fila && fila.slug, fila && fila.accion]));
    if (lote.filas.some(fila => !['insertado', 'actualizado'].includes(porSlug.get(fila.slug)))) {
      throw new Error('Respuesta inesperada al guardar las fichas.');
    }
    lote.filas.forEach(fila => (porSlug.get(fila.slug) === 'insertado' ? respuesta.insertados : respuesta.actualizados).push(fila.slug));
    return respuesta;
  },
};
