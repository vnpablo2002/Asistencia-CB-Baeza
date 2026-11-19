/** Catálogo de ejercicios y entrada privada del agente. */
const HubEjercicios = {
  enums: {
    formato: ['analitico', 'juego'],
    oposicion: ['sin-oposicion', 'limitada', 'ventaja', 'igualdad', 'desventaja'],
    organizacion: ['parejas', 'filas', 'grupo'],
    habilidades: ['bote', 'proteccion', 'salida', 'finalizacion', 'lectura', 'cambio-ritmo', 'desmarque', 'defensa', 'transicion', 'rebote'],
    material: ['conos', 'petos', 'churro'],
    enlace: ['video', 'diagrama', 'fuente'],
    medio: ['youtube', 'imagen', 'gif'],
  },

  listar() {
    const tablas = CONFIG.SHEETS;
    const ejercicios = getSheetData(tablas.HUB_EJERCICIOS);
    const habilidades = getSheetData(tablas.HUB_HABILIDADES);
    const material = getSheetData(tablas.HUB_MATERIAL);
    const enlaces = getSheetData(tablas.HUB_ENLACES);
    const medios = getSheetData(tablas.HUB_MEDIOS);
    const agrupar = (filas, transformar) => {
      const grupos = new Map();
      filas.forEach(fila => {
        const id = String(fila.ejercicio_id);
        if (!grupos.has(id)) grupos.set(id, []);
        grupos.get(id).push(transformar(fila));
      });
      return grupos;
    };
    const porHabilidad = agrupar(habilidades, fila => fila.habilidad);
    const porMaterial = agrupar(material, fila => fila.material);
    const porEnlace = agrupar(enlaces, fila => ({ tipo: fila.tipo, etiqueta: fila.etiqueta, url: fila.url, orden: fila.orden }));
    const porMedio = agrupar(medios, fila => ({ tipo: fila.tipo, youtube_id: fila.youtube_id, ruta_o_url: fila.ruta_o_url, es_miniatura: fila.es_miniatura, orden: fila.orden }));
    const campos = ['id', 'slug', 'nombre', 'nombre_en', 'fecha_enviado', 'fuente', 'objetivo', 'como_se_hace', 'claves', 'version_facil', 'version_dificil', 'nota', 'formato', 'oposicion', 'organizacion', 'detalle_corto'];
    return ejercicios.filter(fila => fila.activo === true).map(fila => {
      const salida = {};
      campos.forEach(campo => { salida[campo] = campo === 'claves' ? (fila.claves || []) : fila[campo]; });
      const id = String(fila.id);
      salida.habilidades = porHabilidad.get(id) || [];
      salida.material = porMaterial.get(id) || [];
      salida.enlaces = (porEnlace.get(id) || []).sort((a, b) => a.orden - b.orden);
      salida.medios = (porMedio.get(id) || []).sort((a, b) => a.orden - b.orden);
      return salida;
    });
  },

  objeto(valor, nombre, campos) {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error(nombre + ' debe ser un objeto.');
    if (Object.keys(valor).some(campo => !campos.includes(campo))) throw new Error(nombre + ' contiene campos desconocidos.');
  },

  texto(valor, nombre, maximo, obligatorio) {
    if (valor === undefined || valor === null || valor === '') {
      if (obligatorio) throw new Error(nombre + ' es obligatorio.');
      return null;
    }
    if (typeof valor !== 'string' || valor.length > maximo || (obligatorio && !valor.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(valor)) {
      throw new Error(nombre + ' no es válido.');
    }
    return valor;
  },

  lista(valor, nombre, maximo) {
    if (valor === undefined || valor === null) return [];
    if (!Array.isArray(valor) || valor.length > maximo) throw new Error(nombre + ' no es válido.');
    return valor;
  },

  enum(valor, nombre, opciones) {
    if (typeof valor !== 'string' || !opciones.includes(valor)) throw new Error(nombre + ' no es válido.');
    return valor;
  },

  url(valor, nombre) {
    const url = this.texto(valor, nombre, 2048, true);
    const partes = /^https:\/\/([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]{1,5}))?(?:[/?#][^\s<>"\\]*)?$/i.exec(url);
    if (!partes || partes[1].length > 253 || partes[1].split('.').some(etiqueta => !etiqueta || etiqueta.length > 63 || etiqueta[0] === '-' || etiqueta[etiqueta.length - 1] === '-') ||
        (partes[2] && (Number(partes[2]) < 1 || Number(partes[2]) > 65535))) {
      throw new Error(nombre + ' debe ser una URL HTTPS válida.');
    }
    return url;
  },

  rutaMedio(valor) {
    if (typeof valor === 'string' && valor.length <= 800000 && /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[a-zA-Z0-9+/=]+$/.test(valor)) return valor;
    const ruta = this.texto(valor, 'ruta_o_url', 2048, true);
    if (/^https:\/\//i.test(ruta)) return this.url(ruta, 'ruta_o_url');
    if (/^(?:\/\/|[a-z][a-z0-9+.-]*:)/i.test(ruta) || /[\s<>"\\?#:]/.test(ruta) || ruta.split('/').includes('..')) {
      throw new Error('ruta_o_url no es válida.');
    }
    return ruta;
  },

  orden(valor, indice) {
    if (valor === undefined || valor === null) return indice;
    if (!Number.isInteger(valor) || valor < 0 || valor > 10000) throw new Error('orden no es válido.');
    return valor;
  },

  normalizar(ejercicio) {
    const campos = ['slug', 'nombre', 'nombre_en', 'fecha_enviado', 'fuente', 'objetivo', 'como_se_hace', 'claves', 'version_facil', 'version_dificil', 'nota', 'formato', 'oposicion', 'organizacion', 'detalle_corto', 'habilidades', 'material', 'enlaces', 'medios'];
    this.objeto(ejercicio, 'ejercicio', campos);
    const resultado = {};
    resultado.slug = this.texto(ejercicio.slug, 'slug', 120, true);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resultado.slug)) throw new Error('slug no es válido.');
    resultado.nombre = this.texto(ejercicio.nombre, 'nombre', 200, true);
    resultado.creado_por = 'trainer-bot';
    ['nombre_en', 'fuente'].forEach(campo => { resultado[campo] = this.texto(ejercicio[campo], campo, 500, false); });
    if (ejercicio.detalle_corto !== undefined && typeof ejercicio.detalle_corto !== 'boolean') throw new Error('detalle_corto no es válido.');
    resultado.detalle_corto = ejercicio.detalle_corto === undefined ? false : ejercicio.detalle_corto;
    ['objetivo', 'como_se_hace', 'version_facil', 'version_dificil', 'nota'].forEach(campo => { resultado[campo] = this.texto(ejercicio[campo], campo, 10000, false); });
    resultado.fecha_enviado = this.texto(ejercicio.fecha_enviado, 'fecha_enviado', 10, false);
    if (resultado.fecha_enviado) {
      const fecha = resultado.fecha_enviado;
      const parsed = new Date(fecha + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== fecha) throw new Error('fecha_enviado no es válida.');
    }
    resultado.claves = this.lista(ejercicio.claves, 'claves', 50).map(valor => this.texto(valor, 'clave', 1000, true));
    ['formato', 'oposicion', 'organizacion'].forEach(campo => { resultado[campo] = this.enum(ejercicio[campo], campo, this.enums[campo]); });
    ['habilidades', 'material'].forEach(campo => {
      resultado[campo] = this.lista(ejercicio[campo], campo, 50).map(valor => this.enum(valor, campo, this.enums[campo]));
      if (new Set(resultado[campo]).size !== resultado[campo].length) throw new Error(campo + ' contiene valores duplicados.');
    });
    resultado.enlaces = this.lista(ejercicio.enlaces, 'enlaces', 50).map((enlace, i) => {
      this.objeto(enlace, 'enlace', ['tipo', 'etiqueta', 'url', 'orden']);
      return { tipo: this.enum(enlace.tipo, 'tipo de enlace', this.enums.enlace), etiqueta: this.texto(enlace.etiqueta, 'etiqueta', 200, false), url: this.url(enlace.url, 'url'), orden: this.orden(enlace.orden, i) };
    });
    resultado.medios = this.lista(ejercicio.medios, 'medios', 50).map((medio, i) => {
      this.objeto(medio, 'medio', ['tipo', 'youtube_id', 'ruta_o_url', 'es_miniatura', 'orden']);
      const tipo = this.enum(medio.tipo, 'tipo de medio', this.enums.medio);
      const youtubeId = this.texto(medio.youtube_id, 'youtube_id', 64, tipo === 'youtube');
      if (youtubeId && !/^[a-z0-9_-]+$/i.test(youtubeId)) throw new Error('youtube_id no es válido.');
      const ruta = medio.ruta_o_url === undefined || medio.ruta_o_url === null || medio.ruta_o_url === '' ? null : this.rutaMedio(medio.ruta_o_url);
      if (tipo !== 'youtube' && !ruta) throw new Error('ruta_o_url es obligatoria.');
      if (medio.es_miniatura !== undefined && typeof medio.es_miniatura !== 'boolean') throw new Error('es_miniatura no es válido.');
      return { tipo: tipo, youtube_id: youtubeId, ruta_o_url: ruta, es_miniatura: medio.es_miniatura === undefined ? false : medio.es_miniatura, orden: this.orden(medio.orden, i) };
    });
    return resultado;
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

  guardar(datos) {
    this.objeto(datos, 'petición', ['token', 'ejercicio', 'ejercicios']);
    this.autenticar(datos.token);
    const individual = Object.prototype.hasOwnProperty.call(datos, 'ejercicio');
    const lote = Object.prototype.hasOwnProperty.call(datos, 'ejercicios');
    if (individual === lote) throw new Error('Indica ejercicio o ejercicios.');
    const entradas = individual ? [datos.ejercicio] : this.lista(datos.ejercicios, 'ejercicios', 100);
    if (!entradas.length) throw new Error('La lista de ejercicios está vacía.');
    const ejercicios = entradas.map(entrada => this.normalizar(entrada));
    if (new Set(ejercicios.map(ejercicio => ejercicio.slug)).size !== ejercicios.length) throw new Error('Hay slugs duplicados en la petición.');
    const config = getSupabaseConfig_();
    const headers = { apikey: config.key, Accept: 'application/json', 'Content-Type': 'application/json' };
    if (!config.key.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + config.key;
    let guardados;
    try {
      guardados = parseSupabaseResponse_(UrlFetchApp.fetch(config.url + '/rest/v1/rpc/hub_upsert_ejercicios', {
        method: 'post', headers: headers, muteHttpExceptions: true, payload: JSON.stringify({ p_ejercicios: ejercicios }),
      }));
      SUPABASE_TABLE_CACHE_.clear();
    } catch (error) {
      throw new Error('No se pudieron guardar los ejercicios.');
    }
    if (!Array.isArray(guardados) || guardados.length !== ejercicios.length || guardados.some(fila => !fila || typeof fila.id !== 'string' || typeof fila.slug !== 'string')) {
      throw new Error('Respuesta inesperada al guardar los ejercicios.');
    }
    const porSlug = new Map(guardados.map(fila => [fila.slug, { id: fila.id, slug: fila.slug }]));
    if (porSlug.size !== ejercicios.length || ejercicios.some(ejercicio => !porSlug.has(ejercicio.slug))) {
      throw new Error('Respuesta inesperada al guardar los ejercicios.');
    }
    const resultados = ejercicios.map(ejercicio => porSlug.get(ejercicio.slug));
    return individual ? { ok: true, id: resultados[0].id, slug: resultados[0].slug } : { ok: true, ejercicios: resultados };
  },
};
