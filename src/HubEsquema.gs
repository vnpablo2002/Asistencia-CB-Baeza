/**
 * Esquema v2 del hub de ejercicios (docs/hub-esquema-v2.md): vocabulario, validación (§11),
 * campos derivados (§9) y agregados de progresiones y sesiones modelo.
 * Es código puro: lo usan el endpoint de Apps Script, el listado y scripts/seed-hub-v2.mjs.
 */
const HubEsquema = (() => {
  const VERSION = 2;
  const TIPOS = ['ejercicio', 'progresion', 'sesion_modelo', 'teoria'];

  const AREAS = {
    tecnica_individual: 'Técnica individual',
    tactica_individual: 'Táctica individual',
    tactica_colectiva: 'Táctica colectiva',
    fisico_coordinacion: 'Físico y coordinación',
    mental_valores: 'Mental y valores',
  };
  // grupo: [etiqueta, área por defecto de sus habilidades]
  const GRUPOS = {
    bote: ['Bote', 'tecnica_individual'],
    tiro_finalizacion: ['Tiro y finalización', 'tecnica_individual'],
    pase_recepcion: ['Pase y recepción', 'tecnica_individual'],
    fundamentos_sin_bote: ['Fundamentos sin bote', 'tecnica_individual'],
    ataque_individual: ['Ataque individual', 'tactica_individual'],
    ataque_colectivo: ['Ataque colectivo', 'tactica_colectiva'],
    defensa_individual: ['Defensa individual', 'tactica_individual'],
    defensa_colectiva: ['Defensa colectiva', 'tactica_colectiva'],
    rebote: ['Rebote', 'tecnica_individual'],
    fisico: ['Físico y coordinación', 'fisico_coordinacion'],
    mental: ['Mental y valores', 'mental_valores'],
  };
  // habilidad: [etiqueta, grupo, área si difiere de la del grupo]
  const HABILIDADES = {
    bote: ['Bote de control', 'bote'],
    bote_velocidad: ['Bote en velocidad', 'bote'],
    bote_proteccion: ['Bote de protección', 'bote'],
    cambio_mano: ['Cambios de mano y dirección', 'bote'],
    cambio_ritmo: ['Cambio de ritmo', 'bote'],
    mecanica_tiro: ['Mecánica de tiro', 'tiro_finalizacion'],
    tiro_tras_recepcion: ['Tiro tras recepción', 'tiro_finalizacion'],
    tiro_tras_bote: ['Tiro tras bote', 'tiro_finalizacion'],
    tiro_libre: ['Tiro libre', 'tiro_finalizacion'],
    entrada_canasta: ['Entrada a canasta', 'tiro_finalizacion'],
    finalizacion_variada: ['Finalizaciones variadas', 'tiro_finalizacion'],
    finalizacion_contacto: ['Finalización con contacto', 'tiro_finalizacion'],
    pase: ['Pase', 'pase_recepcion'],
    recepcion: ['Recepción', 'pase_recepcion'],
    juego_pies_pivote: ['Paradas y pivotes', 'fundamentos_sin_bote'],
    triple_amenaza: ['Triple amenaza', 'fundamentos_sin_bote'],
    salida_1c1: ['Salida en 1c1', 'ataque_individual'],
    lectura_defensor: ['Lectura del defensor', 'ataque_individual'],
    fintas: ['Fintas', 'ataque_individual'],
    desmarque: ['Desmarque', 'ataque_individual'],
    juego_poste: ['Juego de poste', 'ataque_individual'],
    lectura_juego: ['Lectura de juego', 'ataque_colectivo'],
    pasar_y_cortar: ['Pasar y cortar', 'ataque_colectivo'],
    espaciado: ['Espaciado', 'ataque_colectivo'],
    bloqueo_directo: ['Bloqueo directo', 'ataque_colectivo'],
    bloqueo_indirecto: ['Bloqueo indirecto', 'ataque_colectivo'],
    contraataque: ['Contraataque', 'ataque_colectivo'],
    ataque_zona: ['Ataque a zona', 'ataque_colectivo'],
    sistemas_ataque: ['Sistemas de ataque', 'ataque_colectivo'],
    saques: ['Saques', 'ataque_colectivo'],
    posicion_defensiva: ['Posición defensiva', 'defensa_individual', 'tecnica_individual'],
    desplazamiento_defensivo: ['Desplazamientos defensivos', 'defensa_individual', 'tecnica_individual'],
    defensa_balon: ['Defensa del jugador con balón', 'defensa_individual'],
    defensa_sin_balon: ['Defensa sin balón', 'defensa_individual'],
    ayudas_rotaciones: ['Ayudas y rotaciones', 'defensa_colectiva'],
    defensa_bloqueos: ['Defensa de bloqueos', 'defensa_colectiva'],
    defensa_zona: ['Defensa zonal', 'defensa_colectiva'],
    presion: ['Presión', 'defensa_colectiva'],
    balance_defensivo: ['Balance defensivo', 'defensa_colectiva'],
    rebote_ofensivo: ['Rebote ofensivo', 'rebote'],
    rebote_defensivo: ['Rebote defensivo', 'rebote'],
    coordinacion: ['Coordinación', 'fisico'],
    agilidad: ['Agilidad', 'fisico'],
    velocidad_reaccion: ['Velocidad de reacción', 'fisico'],
    velocidad_aceleracion: ['Aceleración', 'fisico'],
    salto: ['Salto', 'fisico'],
    fuerza: ['Fuerza', 'fisico'],
    resistencia: ['Resistencia', 'fisico'],
    comunicacion: ['Comunicación', 'mental'],
    cooperacion: ['Cooperación', 'mental'],
    competitividad: ['Competitividad', 'mental'],
    concentracion: ['Concentración', 'mental'],
    gestion_error: ['Gestión del error', 'mental'],
  };

  const SITUACIONES = { grupal: 'Grupal' };
  for (let n = 1; n <= 5; n++) for (let m = 0; m <= 5; m++) SITUACIONES[n + 'c' + m] = n + 'c' + m;

  // Vocabularios cerrados con su etiqueta legible (ES). Las mismas etiquetas entran en texto_busqueda.
  const VOCAB = {
    tipo_contenido: { ejercicio: 'Ejercicio', progresion: 'Progresión', sesion_modelo: 'Sesión modelo', teoria: 'Teoría' },
    naturaleza: { analitico: 'Analítico', juego: 'Juego' },
    habilidad: Object.fromEntries(Object.keys(HABILIDADES).map(k => [k, HABILIDADES[k][0]])),
    fase_juego: { ataque: 'Ataque', defensa: 'Defensa', transicion_ataque: 'Transición ofensiva', transicion_defensa: 'Transición defensiva', balon_parado: 'Balón parado' },
    tema_teoria: {
      tecnica_tactica: 'Técnica y táctica', metodologia: 'Metodología', planificacion: 'Planificación',
      preparacion_fisica: 'Preparación física', psicologia_grupo: 'Psicología y grupo', reglamento: 'Reglamento',
      salud_prevencion: 'Salud y prevención',
    },
    oposicion: { sin_oposicion: 'Sin oposición', pasiva: 'Oposición pasiva', condicionada: 'Oposición condicionada', real: 'Oposición real' },
    ventaja_inicial: { ninguna: 'Sin ventaja inicial', ataque: 'Ventaja del ataque', defensa: 'Ventaja de la defensa' },
    situacion_numerica: SITUACIONES,
    organizacion: {
      individual: 'Individual', parejas: 'Parejas', trios: 'Tríos', filas: 'Filas', grupos_reducidos: 'Grupos reducidos',
      grupo_completo: 'Grupo completo', equipos: 'Equipos', circuito_estaciones: 'Circuito o estaciones',
    },
    espacio: { zona_canasta: 'Zona de canasta', cuarto_pista: 'Cuarto de pista', media_pista: 'Media pista', pista_completa: 'Pista completa', cualquier_espacio: 'Cualquier espacio' },
    balones: { ninguno: 'Sin balón', uno: 'Un balón', uno_por_grupo: 'Un balón por grupo', uno_por_pareja: 'Un balón por pareja', uno_por_jugador: 'Un balón por jugador' },
    material: {
      conos: 'Conos', chinos: 'Chinos', petos: 'Petos', picas: 'Picas', aros: 'Aros', escalera_coordinacion: 'Escalera de coordinación',
      vallas: 'Vallas', churros: 'Churros', escudos_contacto: 'Escudos de contacto', colchonetas: 'Colchonetas', sillas: 'Sillas',
      balones_medicinales: 'Balones medicinales', pelotas_tenis: 'Pelotas de tenis', gomas_elasticas: 'Gomas elásticas',
    },
    momento_sesion: { calentamiento: 'Calentamiento', parte_principal: 'Parte principal', vuelta_calma: 'Vuelta a la calma' },
    categorias: {
      pre_babybasket: 'Pre-babybasket', babybasket: 'Babybasket', pre_minibasket: 'Pre-minibasket', minibasket: 'Minibasket',
      infantil: 'Infantil', cadete: 'Cadete', junior: 'Júnior', senior: 'Sénior', bulevard: 'Bulevard',
    },
    origen: { externo: 'Externo', adaptado: 'Adaptado', propio: 'Propio' },
    creado_por: { trainer_bot: 'Trainer Bot', entrenador: 'Entrenador', gestor: 'Gestor' },
    estado: { propuesto: 'Propuesto', revisado: 'Revisado', archivado: 'Archivado' },
    confianza_clasificacion: { alta: 'Alta', media: 'Media', baja: 'Baja' },
    tipo_recurso: {
      video_youtube: 'Vídeo de YouTube', video_instagram: 'Vídeo de Instagram', video_tiktok: 'Vídeo de TikTok', video_otro: 'Vídeo',
      pizarra_diagrama: 'Pizarra', imagen_foto: 'Imagen', pdf_documento: 'PDF', articulo_web: 'Artículo web',
    },
    idioma: { es: 'Español', en: 'Inglés', otro: 'Otro idioma', sin_voz: 'Sin voz', desconocido: 'Idioma desconocido' },
    relacion: { exacto: 'Este ejercicio', variante: 'Variante', apoyo: 'Apoyo' },
    nivel: { iniciacion: 'Iniciación', intermedio: 'Intermedio', avanzado: 'Avanzado' },
  };

  // Aplicabilidad por tipo (§8), en el orden de TIPOS: R obligatorio, O opcional, C condicional, - no aplica.
  const APLICA = {
    version_esquema: 'RRRR', tipo_contenido: 'RRRR', slug: 'RRRR', nombre: 'RRRR', resumen: 'RRRR', fecha_enviado: 'RRRR',
    fuente: 'RRRR', origen: 'RRRR', creado_por: 'RRRR', estado: 'RRRR', confianza_clasificacion: 'RRRR', recursos: 'RRRR',
    nombre_original: 'OOOO', licencia_nota: 'OOOO', nota: 'OOOO', relacionados: 'OOOO', sugerencias_vocabulario: 'OOOO',
    objetivo: 'RRRO', descripcion: 'ROOC', habilidad_principal: 'RROO', habilidades_secundarias: 'OOOO', fase_juego: 'CCOO',
    categorias: 'RRRO',
    naturaleza: 'R---', oposicion: 'R---', ventaja_inicial: 'R---', situacion_numerica: 'R---', organizacion: 'R---',
    espacio: 'R---', canastas_necesarias: 'R---', jugadores_min: 'R---', jugadores_max: 'R---', balones: 'R---',
    material: 'R---', minutos_min: 'R---', minutos_max: 'R---', momento_sesion: 'R---', competitivo: 'R---',
    dificultad: 'R--R', esfuerzo_fisico: 'R---', carga_cognitiva: 'R---', complejidad_organizativa: 'R---',
    reglas: 'O---', errores_comunes: 'O---', variante_facil: 'O---', variante_dificil: 'O---', puntos_clave: 'OO--',
    pasos: '-R--', bloques: '--R-', tema_teoria: '---R', ideas_principales: '---R', minutos_clave: '---O',
  };
  const DERIVADOS = [
    'area', 'grupo_habilidad', 'areas_trabajadas', 'nivel', 'nivel_etiqueta', 'tipos_recurso', 'recurso_principal_tipo',
    'tiene_video', 'tiene_video_exacto', 'tiene_diagrama', 'youtube_id', 'asignable', 'dificultad_min', 'dificultad_max',
    'categorias_comunes', 'minutos_total', 'distribucion_areas', 'distribucion_habilidades', 'texto_busqueda',
  ];
  // Campos obligatorios cuya lista puede ir vacía o cuyo valor puede ser null.
  const PRESENCIA = new Set(['recursos', 'material', 'jugadores_max']);

  // Tipo de cada campo: [clase, ...parámetros].
  const CAMPOS = {
    nombre: ['texto', 80], nombre_original: ['texto', 120], fuente: ['texto', 150], licencia_nota: ['texto', 200],
    nota: ['texto', 500], resumen: ['texto', 160], objetivo: ['texto', 300], descripcion: ['texto', 2000],
    variante_facil: ['texto', 400], variante_dificil: ['texto', 400], fecha_enviado: ['fecha'],
    reglas: ['textos', 0, 8, 200], puntos_clave: ['textos', 0, 5, 140], errores_comunes: ['textos', 0, 5, 140],
    ideas_principales: ['textos', 3, 7, 200],
    origen: ['enum', 'origen'], creado_por: ['enum', 'creado_por'], estado: ['enum', 'estado'],
    confianza_clasificacion: ['enum', 'confianza_clasificacion'], habilidad_principal: ['enum', 'habilidad'],
    tema_teoria: ['enum', 'tema_teoria'], naturaleza: ['enum', 'naturaleza'], oposicion: ['enum', 'oposicion'],
    ventaja_inicial: ['enum', 'ventaja_inicial'], situacion_numerica: ['enum', 'situacion_numerica'],
    organizacion: ['enum', 'organizacion'], espacio: ['enum', 'espacio'], balones: ['enum', 'balones'],
    habilidades_secundarias: ['enums', 'habilidad', 0, 3], fase_juego: ['enums', 'fase_juego', 0, 3],
    material: ['enums', 'material', 0, 14], momento_sesion: ['enums', 'momento_sesion', 1, 3], categorias: ['enums', 'categorias', 0, 9],
    canastas_necesarias: ['entero', 0, 6], jugadores_min: ['entero', 1, 30], jugadores_max: ['entero', 1, 30],
    minutos_min: ['entero', 1, 60], minutos_max: ['entero', 1, 60],
    dificultad: ['entero', 1, 5], esfuerzo_fisico: ['entero', 1, 5], carga_cognitiva: ['entero', 1, 5], complejidad_organizativa: ['entero', 1, 5],
    competitivo: ['bool'],
  };
  // Campos con vocabulario que admiten sugerencias (§4.10); habilidades_secundarias se propone como habilidad_principal.
  const CAMPOS_ENUM = {
    tipo_contenido: 'tipo_contenido', naturaleza: 'naturaleza', habilidad_principal: 'habilidad', fase_juego: 'fase_juego',
    tema_teoria: 'tema_teoria', oposicion: 'oposicion', ventaja_inicial: 'ventaja_inicial', situacion_numerica: 'situacion_numerica',
    organizacion: 'organizacion', espacio: 'espacio', balones: 'balones', material: 'material', momento_sesion: 'momento_sesion',
    categorias: 'categorias', origen: 'origen', creado_por: 'creado_por', estado: 'estado',
    confianza_clasificacion: 'confianza_clasificacion', tipo_recurso: 'tipo_recurso', idioma: 'idioma', relacion: 'relacion',
  };
  const RECURSO_CLAVES = ['tipo_recurso', 'url', 'archivo_local', 'etiqueta', 'autor', 'idioma', 'duracion_seg', 'inicio_seg', 'fin_seg', 'relacion', 'principal'];
  const TIPOS_ARCHIVO_LOCAL = ['pizarra_diagrama', 'imagen_foto', 'pdf_documento'];
  const GRUPOS_DEFENSA = ['defensa_individual', 'defensa_colectiva'];
  const GRUPOS_ATAQUE = ['ataque_individual', 'ataque_colectivo'];
  const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
  const TELEFONO = /(?<!\d)(?:\+34)?[ ]?[6789]\d{2}[ ]?\d{3}[ ]?\d{3}(?!\d)/;
  const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
  const MENSAJE_V1 = 'Ficha v1 rechazada: falta version_esquema. El hub solo acepta el esquema v2 (version_esquema: 2, ver docs/hub-esquema-v2.md); reclasifica la ficha antes de enviarla.';

  const tiene = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const esObjeto = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const vacio = v => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  const unicos = lista => lista.filter((v, i) => v !== null && v !== undefined && lista.indexOf(v) === i);
  const esVideo = tipo => /^video_/.test(tipo || '');
  const areaDe = habilidad => HABILIDADES[habilidad] ? (HABILIDADES[habilidad][2] || GRUPOS[HABILIDADES[habilidad][1]][1]) : null;
  const grupoDe = habilidad => HABILIDADES[habilidad] ? HABILIDADES[habilidad][1] : null;
  const nivelDe = dificultad => !Number.isInteger(dificultad) ? null : dificultad <= 2 ? 'iniciacion' : dificultad === 3 ? 'intermedio' : 'avanzado';
  const etiqueta = (vocab, valor) => (VOCAB[vocab] && VOCAB[vocab][valor]) || null;

  function hostDe(url) {
    const m = /^https:\/\/([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::\d{1,5})?(?:[/?#][^\s<>"\\]*)?$/i.exec(url);
    return m && m[1].length <= 253 ? m[1].toLowerCase() : null;
  }
  const deDominio = (host, dominio) => host === dominio || host.endsWith('.' + dominio);
  const esYoutube = host => deDominio(host, 'youtube.com') || deDominio(host, 'youtube-nocookie.com') || host === 'youtu.be';

  function youtubeId(url) {
    const m = /^https:\/\/(?:(?:www|m|music)\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/.exec(String(url || ''));
    return m ? m[1] : null;
  }

  /** Valida una ficha v2. `tipos` es un Map slug → tipo_contenido con lo que ya existe (base de datos y lote). */
  function validar(entrada, tipos) {
    const errores = [];
    const avisos = [];
    const error = m => errores.push(m);
    if (!esObjeto(entrada)) return { slug: null, errores: ['La ficha debe ser un objeto JSON.'], avisos };
    const slug = typeof entrada.slug === 'string' ? entrada.slug : null;
    if (!tiene(entrada, 'version_esquema')) return { slug, errores: [MENSAJE_V1], avisos };
    if (entrada.version_esquema !== VERSION) return { slug, errores: ['version_esquema debe ser 2; el endpoint no interpreta otras versiones.'], avisos };
    const tipo = entrada.tipo_contenido;
    if (!TIPOS.includes(tipo)) return { slug, errores: ['tipo_contenido debe ser uno de: ' + TIPOS.join(', ') + '.'], avisos };
    const columna = TIPOS.indexOf(tipo);
    tipos = tipos || new Map();

    // 2. Claves desconocidas, derivadas o que no aplican al tipo.
    Object.keys(entrada).forEach(clave => {
      if (DERIVADOS.includes(clave)) error(clave + ' es un campo derivado: lo calcula el backend y no se envía.');
      else if (!tiene(APLICA, clave)) error('Clave desconocida: ' + clave + '.');
      else if (APLICA[clave][columna] === '-') error(clave + ' no aplica a ' + tipo + '.');
    });
    // 3. Obligatorios del tipo.
    Object.keys(APLICA).forEach(clave => {
      if (APLICA[clave][columna] !== 'R') return;
      if (PRESENCIA.has(clave) ? !tiene(entrada, clave) : vacio(entrada[clave])) error('Falta ' + clave + ' (obligatorio en ' + tipo + ').');
    });

    const f = { version_esquema: VERSION, tipo_contenido: tipo };
    if (typeof entrada.slug === 'string' && (entrada.slug.length > 60 || !SLUG.test(entrada.slug))) error('slug no cumple el patrón (minúsculas, números y guiones; máximo 60).');
    else if (entrada.slug !== undefined && typeof entrada.slug !== 'string') error('slug debe ser texto.');
    f.slug = slug;

    // 4–5. Tipos, rangos y vocabularios campo a campo.
    const texto = (valor, nombre, maximo) => {
      if (typeof valor !== 'string') { error(nombre + ' debe ser texto.'); return null; }
      if (!valor.trim()) { error(nombre + ' no puede ir en blanco.'); return null; }
      if (valor.length > maximo) error(nombre + ' supera ' + maximo + ' caracteres.');
      if (CONTROL.test(valor)) error(nombre + ' contiene caracteres de control.');
      return valor;
    };
    const entero = (valor, nombre, minimo, maximo) => {
      if (!Number.isInteger(valor) || valor < minimo || valor > maximo) { error(nombre + ' debe ser un entero entre ' + minimo + ' y ' + maximo + '.'); return null; }
      return valor;
    };
    const enumerado = (valor, nombre, vocab) => {
      if (typeof valor !== 'string' || !tiene(VOCAB[vocab], valor)) { error(nombre + ': valor fuera de vocabulario (' + JSON.stringify(valor) + ').'); return null; }
      return valor;
    };
    const lista = (valor, nombre, minimo, maximo) => {
      if (!Array.isArray(valor)) { error(nombre + ' debe ser una lista.'); return null; }
      if (valor.length < minimo || valor.length > maximo) error(nombre + ' debe tener entre ' + minimo + ' y ' + maximo + ' elementos.');
      return valor;
    };
    Object.keys(CAMPOS).forEach(clave => {
      if (!tiene(entrada, clave) || APLICA[clave][columna] === '-') return;
      const valor = entrada[clave];
      const [clase, a, b, c] = CAMPOS[clave];
      if (vacio(valor)) { f[clave] = clave === 'material' && Array.isArray(valor) ? [] : null; return; }
      if (clase === 'texto') f[clave] = texto(valor, clave, a);
      else if (clase === 'fecha') {
        const d = typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(valor + 'T00:00:00Z') : null;
        if (!d || isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) error(clave + ' debe ser una fecha YYYY-MM-DD válida.');
        f[clave] = valor;
      } else if (clase === 'textos') {
        const l = lista(valor, clave, a, b);
        f[clave] = l && l.map((v, i) => texto(v, clave + '[' + i + ']', c));
      } else if (clase === 'enum') f[clave] = enumerado(valor, clave, a);
      else if (clase === 'enums') {
        const l = lista(valor, clave, b, c);
        f[clave] = l && l.map(v => enumerado(v, clave, a));
        if (l && unicos(l).length !== l.length) error(clave + ' contiene valores repetidos.');
      } else if (clase === 'entero') f[clave] = entero(valor, clave, a, b);
      else if (clase === 'bool') {
        if (typeof valor !== 'boolean') error(clave + ' debe ser true o false.');
        f[clave] = valor;
      }
    });
    // Columnas no aplicables quedan a null; el UPSERT completo borra lo que no se envía.
    Object.keys(APLICA).forEach(clave => { if (!tiene(f, clave)) f[clave] = null; });

    // 6. Habilidades.
    const secundarias = f.habilidades_secundarias || [];
    if (secundarias.length && !f.habilidad_principal) error('habilidades_secundarias requiere habilidad_principal.');
    if (f.habilidad_principal && secundarias.includes(f.habilidad_principal)) error('habilidades_secundarias no puede incluir la habilidad principal.');

    // 7. Recursos.
    f.recursos = [];
    if (tiene(entrada, 'recursos') && entrada.recursos !== null) {
      const recursos = lista(entrada.recursos, 'recursos', 0, 6) || [];
      const vistos = new Set();
      recursos.forEach((r, i) => {
        const n = 'recursos[' + i + ']';
        if (!esObjeto(r)) { error(n + ' debe ser un objeto.'); return; }
        Object.keys(r).forEach(k => { if (!RECURSO_CLAVES.includes(k)) error(n + ': clave desconocida ' + k + '.'); });
        const tipoRecurso = enumerado(r.tipo_recurso, n + '.tipo_recurso', 'tipo_recurso');
        const video = esVideo(tipoRecurso);
        const salida = {
          tipo_recurso: tipoRecurso, url: null, archivo_local: null,
          etiqueta: texto(r.etiqueta, n + '.etiqueta', 80),
          autor: vacio(r.autor) ? null : texto(r.autor, n + '.autor', 100),
          idioma: enumerado(r.idioma, n + '.idioma', 'idioma'),
          duracion_seg: null, inicio_seg: null, fin_seg: null,
          relacion: enumerado(r.relacion, n + '.relacion', 'relacion'),
          principal: r.principal,
          youtube_id: null,
        };
        if (typeof r.principal !== 'boolean') error(n + '.principal debe ser true o false.');
        const conUrl = !vacio(r.url), conArchivo = !vacio(r.archivo_local);
        if (conUrl === conArchivo) error(n + ': indica exactamente uno de url o archivo_local.');
        if (conUrl) {
          const url = typeof r.url === 'string' && r.url.length <= 2048 ? r.url : null;
          const host = url && hostDe(url);
          if (!host) error(n + '.url debe ser una URL https válida.');
          else {
            const yt = esYoutube(host), ig = deDominio(host, 'instagram.com'), tt = deDominio(host, 'tiktok.com');
            if ((tipoRecurso === 'video_youtube' && !yt) || (tipoRecurso === 'video_instagram' && !ig) ||
                (tipoRecurso === 'video_tiktok' && !tt) || (tipoRecurso === 'video_otro' && (yt || ig || tt))) {
              error(n + '.url: el dominio ' + host + ' no cuadra con ' + tipoRecurso + '.');
            }
            if (yt && /[?&#](?:t|start)=/.test(url)) error(n + '.url: las URL de YouTube no llevan t= ni start=; usa inicio_seg.');
            if (tipoRecurso === 'video_youtube') {
              salida.youtube_id = youtubeId(url);
              if (!salida.youtube_id) avisos.push(n + ': no se reconoce el id del vídeo de YouTube; se mostrará como enlace.');
            }
          }
          salida.url = url;
          if (url) { if (vistos.has(url)) error(n + ': url repetida en la ficha.'); vistos.add(url); }
        }
        if (conArchivo) {
          const ruta = r.archivo_local;
          if (typeof ruta !== 'string' || !/^\/workspace\/[^\s]+$/.test(ruta) || ruta.split('/').includes('..') || ruta.length > 500) error(n + '.archivo_local debe ser una ruta absoluta bajo /workspace/.');
          if (tipoRecurso && !TIPOS_ARCHIVO_LOCAL.includes(tipoRecurso)) error(n + '.archivo_local solo se admite en ' + TIPOS_ARCHIVO_LOCAL.join(', ') + '.');
          salida.archivo_local = typeof ruta === 'string' ? ruta : null;
          if (vistos.has(ruta)) error(n + ': archivo_local repetido en la ficha.');
          vistos.add(ruta);
        }
        ['duracion_seg', 'inicio_seg', 'fin_seg'].forEach(k => {
          if (vacio(r[k])) return;
          if (!video) { error(n + '.' + k + ' solo aplica a vídeos.'); return; }
          salida[k] = entero(r[k], n + '.' + k, k === 'inicio_seg' ? 0 : 1, 86400);
        });
        if (salida.inicio_seg !== null && salida.fin_seg !== null && salida.inicio_seg >= salida.fin_seg) error(n + ': inicio_seg debe ser menor que fin_seg.');
        if (salida.duracion_seg !== null && salida.fin_seg !== null && salida.fin_seg > salida.duracion_seg) error(n + ': fin_seg supera duracion_seg.');
        if (salida.duracion_seg !== null && salida.inicio_seg !== null && salida.fin_seg === null && salida.inicio_seg >= salida.duracion_seg) error(n + ': inicio_seg supera duracion_seg.');
        f.recursos.push(salida);
      });
      const principales = f.recursos.filter(r => r.principal === true).length;
      if (f.recursos.length && principales !== 1) error('recursos: debe haber exactamente un recurso con principal: true (hay ' + principales + ').');
    }
    const principal = f.recursos.find(r => r.principal === true) || null;

    // 8. Coherencia de la organización.
    if (tipo === 'ejercicio') {
      const sinRival = f.oposicion === 'sin_oposicion' || f.oposicion === 'pasiva';
      const m = /^\dc(\d)$/.exec(f.situacion_numerica || '');
      if (m && m[1] === '0' && f.oposicion && !sinRival) error('situacion_numerica ' + f.situacion_numerica + ' (sin defensores) exige oposicion sin_oposicion o pasiva.');
      if (m && m[1] !== '0' && f.oposicion === 'sin_oposicion') error('situacion_numerica ' + f.situacion_numerica + ' tiene defensores: oposicion no puede ser sin_oposicion.');
      if (f.ventaja_inicial && f.ventaja_inicial !== 'ninguna' && sinRival) error('ventaja_inicial debe ser ninguna con oposicion ' + f.oposicion + '.');
      if (f.minutos_min !== null && f.minutos_max !== null && f.minutos_min > f.minutos_max) error('minutos_min no puede superar minutos_max.');
      if (f.jugadores_min !== null && f.jugadores_max !== null && f.jugadores_max < f.jugadores_min) error('jugadores_max no puede ser menor que jugadores_min.');
    }
    // 9. Fase de juego obligatoria salvo áreas física y mental.
    const area = areaDe(f.habilidad_principal);
    if ((tipo === 'ejercicio' || tipo === 'progresion') && !f.fase_juego && area !== 'fisico_coordinacion' && area !== 'mental_valores') {
      error('fase_juego necesita al menos una fase (solo puede ir vacía si la habilidad principal es física o mental).');
    }
    // 10. Teoría.
    if (tipo === 'teoria') {
      if (!f.recursos.length && vacio(entrada.descripcion)) error('descripcion es obligatoria en una teoria sin recursos.');
      if (tiene(entrada, 'minutos_clave') && !vacio(entrada.minutos_clave)) {
        const capitulos = lista(entrada.minutos_clave, 'minutos_clave', 0, 20) || [];
        if (!principal || !esVideo(principal.tipo_recurso)) error('minutos_clave requiere que el recurso principal sea un vídeo.');
        let anterior = -1;
        f.minutos_clave = capitulos.map((c, i) => {
          const n = 'minutos_clave[' + i + ']';
          if (!esObjeto(c)) { error(n + ' debe ser {seg, tema}.'); return null; }
          Object.keys(c).forEach(k => { if (k !== 'seg' && k !== 'tema') error(n + ': clave desconocida ' + k + '.'); });
          const seg = entero(c.seg, n + '.seg', 0, 86400);
          if (seg !== null && seg <= anterior) error('minutos_clave debe ir en orden ascendente.');
          if (seg !== null && principal && principal.duracion_seg && seg >= principal.duracion_seg) error(n + '.seg supera la duración del vídeo principal.');
          if (seg !== null) anterior = seg;
          return { seg: seg, tema: texto(c.tema, n + '.tema', 100) };
        });
      }
    }
    // 11. Pasos de progresión y bloques de sesión.
    const hijo = (valor, nombre, permitidos) => {
      if (typeof valor !== 'string' || !SLUG.test(valor)) { error(nombre + ' no es un slug válido.'); return null; }
      if (!tipos.has(valor)) error(nombre + ': el slug ' + valor + ' no existe.');
      else if (!permitidos.includes(tipos.get(valor))) error(nombre + ': ' + valor + ' es ' + tipos.get(valor) + ' y aquí solo se admite ' + permitidos.join(' o ') + '.');
      return valor;
    };
    if (tipo === 'progresion' && tiene(entrada, 'pasos') && entrada.pasos !== null) {
      const pasos = lista(entrada.pasos, 'pasos', 2, 8) || [];
      f.pasos = pasos.map((p, i) => {
        const n = 'pasos[' + i + ']';
        if (!esObjeto(p)) { error(n + ' debe ser {slug, criterio_avance}.'); return null; }
        Object.keys(p).forEach(k => { if (k !== 'slug' && k !== 'criterio_avance') error(n + ': clave desconocida ' + k + '.'); });
        return { slug: hijo(p.slug, n + '.slug', ['ejercicio']), criterio_avance: texto(p.criterio_avance, n + '.criterio_avance', 200) };
      });
      const slugs = f.pasos.filter(Boolean).map(p => p.slug);
      if (unicos(slugs).length !== slugs.length) error('pasos contiene ejercicios repetidos.');
    }
    if (tipo === 'sesion_modelo' && tiene(entrada, 'bloques') && entrada.bloques !== null) {
      const bloques = lista(entrada.bloques, 'bloques', 2, 12) || [];
      f.bloques = bloques.map((b, i) => {
        const n = 'bloques[' + i + ']';
        if (!esObjeto(b)) { error(n + ' debe ser {slug, minutos, nota?}.'); return null; }
        Object.keys(b).forEach(k => { if (!['slug', 'minutos', 'nota'].includes(k)) error(n + ': clave desconocida ' + k + '.'); });
        return { slug: hijo(b.slug, n + '.slug', ['ejercicio', 'progresion']), minutos: entero(b.minutos, n + '.minutos', 1, 60), nota: vacio(b.nota) ? null : texto(b.nota, n + '.nota', 200) };
      });
    }
    // 12. Relacionados.
    if (tiene(entrada, 'relacionados') && !vacio(entrada.relacionados)) {
      const rel = lista(entrada.relacionados, 'relacionados', 0, 5) || [];
      f.relacionados = rel.map((s, i) => {
        if (s === slug) error('relacionados no puede incluir el propio slug.');
        else hijo(s, 'relacionados[' + i + ']', TIPOS);
        return s;
      });
      if (unicos(rel).length !== rel.length) error('relacionados contiene slugs repetidos.');
    }
    // 13. Un slug existente no cambia de tipo.
    if (slug && tipos.has(slug) && tipos.get(slug) !== tipo) error('El slug ' + slug + ' ya existe como ' + tipos.get(slug) + '; tipo_contenido no se puede cambiar.');
    // 14. Trainer Bot solo propone.
    if (f.creado_por === 'trainer_bot' && f.estado && f.estado !== 'propuesto') error('creado_por trainer_bot solo puede enviar estado propuesto.');
    // 16. Sugerencias de vocabulario.
    if (tiene(entrada, 'sugerencias_vocabulario') && !vacio(entrada.sugerencias_vocabulario)) {
      const sugerencias = lista(entrada.sugerencias_vocabulario, 'sugerencias_vocabulario', 0, 5) || [];
      f.sugerencias_vocabulario = sugerencias.map((s, i) => {
        const n = 'sugerencias_vocabulario[' + i + ']';
        if (!esObjeto(s) || Object.keys(s).some(k => !['campo', 'valor', 'motivo'].includes(k))) { error(n + ' debe ser {campo, valor, motivo}.'); return null; }
        if (!tiene(CAMPOS_ENUM, s.campo)) error(n + '.campo debe ser un campo con vocabulario (' + JSON.stringify(s.campo) + ' no lo es).');
        if (typeof s.valor !== 'string' || s.valor.length > 40 || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(s.valor)) error(n + '.valor debe estar en snake_case ASCII (máximo 40).');
        return { campo: s.campo, valor: s.valor, motivo: texto(s.motivo, n + '.motivo', 200) };
      });
      avisos.push('Sugerencias de vocabulario para el Gestor: ' + f.sugerencias_vocabulario.filter(Boolean).map(s => s.campo + '=' + s.valor).join(', ') + '.');
    }
    // 15. Datos personales en cualquier texto (las URL y rutas no son texto libre).
    const revisar = (valor, ruta) => {
      if (typeof valor === 'string') {
        if (EMAIL.test(valor)) error(ruta + ' contiene un email: el hub no admite datos de contacto.');
        if (TELEFONO.test(valor)) error(ruta + ' contiene un teléfono: el hub no admite datos de contacto.');
      } else if (Array.isArray(valor)) valor.forEach((v, i) => revisar(v, ruta + '[' + i + ']'));
      else if (esObjeto(valor)) Object.keys(valor).forEach(k => { if (k !== 'url' && k !== 'archivo_local') revisar(valor[k], ruta + '.' + k); });
    };
    Object.keys(entrada).forEach(k => revisar(entrada[k], k));

    // 11.2 Avisos (se acepta y se guarda para la bandeja de revisión).
    if (f.resumen && f.objetivo && f.resumen.trim() === f.objetivo.trim()) avisos.push('resumen es idéntico a objetivo.');
    if (f.descripcion && f.descripcion.length < 150 && f.confianza_clasificacion === 'alta') avisos.push('descripcion tiene menos de 150 caracteres con confianza alta.');
    const grupo = grupoDe(f.habilidad_principal);
    const fases = f.fase_juego || [];
    if (GRUPOS_DEFENSA.includes(grupo) && !fases.includes('defensa') && !fases.includes('transicion_defensa')) avisos.push('Habilidad defensiva sin fase de defensa en fase_juego.');
    if (GRUPOS_ATAQUE.includes(grupo) && !fases.some(fase => ['ataque', 'transicion_ataque', 'balon_parado'].includes(fase))) avisos.push('Habilidad de ataque sin fase de ataque en fase_juego.');
    if (f.naturaleza === 'juego' && !f.reglas) avisos.push('Juego sin reglas.');
    if (tipo === 'teoria' && principal && esVideo(principal.tipo_recurso) && principal.duracion_seg > 300 && !f.minutos_clave) avisos.push('Teoría con vídeo de más de 5 minutos sin minutos_clave.');
    if (f.recursos.some(r => r.relacion === 'exacto') && principal && principal.relacion !== 'exacto') avisos.push('Hay un recurso exacto pero el principal no lo es.');
    f.recursos.filter(r => r.archivo_local).forEach(r => avisos.push('Recurso pendiente de subir: ' + r.archivo_local + '.'));

    return { slug, errores, avisos, ficha: errores.length ? null : f };
  }

  /** Derivados de una ficha válida (§9), salvo los agregados que dependen de otras fichas. */
  function derivar(f) {
    const recursos = f.recursos || [];
    const principal = recursos.find(r => r.principal) || null;
    const habilidades = [f.habilidad_principal].concat(f.habilidades_secundarias || []).filter(Boolean);
    const etiquetas = (vocab, valores) => (valores || []).map(v => etiqueta(vocab, v)).filter(Boolean);
    const area = areaDe(f.habilidad_principal);
    const grupo = grupoDe(f.habilidad_principal);
    const nivel = nivelDe(f.dificultad);
    const partes = [
      f.nombre, f.nombre_original, f.resumen, f.objetivo, f.descripcion,
      (f.reglas || []).join('. '), (f.puntos_clave || []).join('. '), (f.errores_comunes || []).join('. '),
      f.variante_facil, f.variante_dificil, (f.ideas_principales || []).join('. '),
      (f.minutos_clave || []).map(c => c.tema).join('. '),
      (f.pasos || []).map(p => p.criterio_avance).join('. '), (f.bloques || []).map(b => b.nota).filter(Boolean).join('. '),
      [etiqueta('tipo_contenido', f.tipo_contenido), etiqueta('naturaleza', f.naturaleza)]
        .concat(etiquetas('habilidad', habilidades), grupo ? [GRUPOS[grupo][0]] : [], unicos(habilidades.map(areaDe)).map(a => AREAS[a]))
        .concat(etiquetas('fase_juego', f.fase_juego), [etiqueta('tema_teoria', f.tema_teoria), etiqueta('oposicion', f.oposicion)])
        .concat(f.ventaja_inicial && f.ventaja_inicial !== 'ninguna' ? [etiqueta('ventaja_inicial', f.ventaja_inicial)] : [])
        .concat([f.situacion_numerica, etiqueta('organizacion', f.organizacion), etiqueta('espacio', f.espacio)])
        .concat(etiquetas('material', f.material), etiquetas('momento_sesion', f.momento_sesion), etiquetas('categorias', f.categorias))
        .concat([etiqueta('nivel', nivel)]).filter(Boolean).join(' · '),
    ];
    return {
      area: area,
      grupo_habilidad: grupo,
      areas_trabajadas: habilidades.length ? unicos(habilidades.map(areaDe)) : null,
      nivel_etiqueta: nivel,
      tipos_recurso: recursos.length ? unicos(recursos.map(r => r.tipo_recurso)) : ['solo_texto'],
      recurso_principal_tipo: principal ? principal.tipo_recurso : 'solo_texto',
      tiene_video: recursos.some(r => esVideo(r.tipo_recurso)),
      tiene_video_exacto: recursos.some(r => esVideo(r.tipo_recurso) && r.relacion === 'exacto'),
      tiene_diagrama: recursos.some(r => r.tipo_recurso === 'pizarra_diagrama' && !!r.url),
      youtube_id: principal ? principal.youtube_id : null,
      asignable: f.tipo_contenido === 'ejercicio' || f.tipo_contenido === 'progresion',
      texto_busqueda: partes.filter(p => p && String(p).trim()).join('\n'),
    };
  }

  /**
   * Valida un lote. Las fichas del lote cuentan como existentes para sus referencias; si una ficha se rechaza,
   * se revalidan las que dependían de ella. Devuelve las filas listas para la RPC hub_v2_upsertar.
   */
  function validarLote(entradas, existentes) {
    const base = new Map(existentes || []);
    const rechazados = [];
    const vistos = new Set();
    let candidatas = [];
    entradas.forEach(entrada => {
      const slug = esObjeto(entrada) && typeof entrada.slug === 'string' ? entrada.slug : null;
      if (slug && vistos.has(slug)) { rechazados.push({ slug, errores: ['slug repetido en el lote.'] }); return; }
      if (slug) vistos.add(slug);
      candidatas.push(entrada);
    });
    let resultados;
    for (;;) {
      const tipos = new Map(base);
      candidatas.forEach(e => {
        if (esObjeto(e) && typeof e.slug === 'string' && TIPOS.includes(e.tipo_contenido) && !(base.has(e.slug) && base.get(e.slug) !== e.tipo_contenido)) tipos.set(e.slug, e.tipo_contenido);
      });
      resultados = candidatas.map(e => validar(e, tipos));
      const fallidas = resultados.filter(r => r.errores.length);
      if (!fallidas.length || fallidas.length === resultados.length) break;
      // Repite sin las rechazadas para que nadie referencie una ficha que no se va a guardar.
      fallidas.forEach(r => rechazados.push({ slug: r.slug, errores: r.errores }));
      candidatas = candidatas.filter((e, i) => !resultados[i].errores.length);
    }
    resultados.filter(r => r.errores.length).forEach(r => rechazados.push({ slug: r.slug, errores: r.errores }));
    const validas = resultados.filter(r => !r.errores.length);
    return {
      filas: validas.map(r => fila(r.ficha, r.avisos)),
      rechazados: rechazados,
      avisos: validas.filter(r => r.avisos.length).map(r => ({ slug: r.slug, avisos: r.avisos })),
    };
  }

  /** Fila para la RPC: columnas de hub_contenidos más recursos, pasos y bloques. */
  function fila(f, avisos) {
    return Object.assign({}, f, derivar(f), { avisos: avisos || [] });
  }

  /**
   * Agregados de progresiones y sesiones modelo (§9). Se calculan al leer, para que reflejen siempre
   * los ejercicios actuales. Devuelve un Map slug → agregados.
   */
  function agregados(fichas) {
    const porSlug = new Map(fichas.map(f => [f.slug, f]));
    const hojas = (f, visitados) => {
      if (!f || visitados.has(f.slug)) return [];
      visitados.add(f.slug);
      if (f.tipo_contenido === 'ejercicio') return [f];
      const hijos = f.tipo_contenido === 'progresion' ? (f.pasos || []) : f.tipo_contenido === 'sesion_modelo' ? (f.bloques || []) : [];
      return hijos.reduce((acc, h) => acc.concat(hojas(porSlug.get(h.slug), visitados)), []);
    };
    const rango = (lista, campo) => {
      const valores = lista.map(f => f[campo]).filter(v => Number.isInteger(v));
      return valores.length ? [Math.min.apply(null, valores), Math.max.apply(null, valores)] : [null, null];
    };
    const interseccion = listas => listas.length ? listas.reduce((acc, l) => acc.filter(v => (l || []).includes(v))) : null;
    const resultado = new Map();
    fichas.forEach(f => {
      if (f.tipo_contenido !== 'progresion' && f.tipo_contenido !== 'sesion_modelo') return;
      const ejercicios = unicos(hojas(f, new Set()));
      const a = {};
      ['dificultad', 'esfuerzo_fisico', 'carga_cognitiva', 'complejidad_organizativa'].forEach(campo => {
        const r = rango(ejercicios, campo);
        a[campo + '_min'] = r[0]; a[campo + '_max'] = r[1];
      });
      const minimos = ejercicios.map(e => e.jugadores_min).filter(Number.isInteger);
      const maximos = ejercicios.map(e => e.jugadores_max).filter(Number.isInteger);
      a.jugadores_min = minimos.length ? Math.max.apply(null, minimos) : null;
      a.jugadores_max = maximos.length ? Math.min.apply(null, maximos) : null;
      const canastas = ejercicios.map(e => e.canastas_necesarias).filter(Number.isInteger);
      a.canastas_necesarias = canastas.length ? Math.max.apply(null, canastas) : null;
      a.material = unicos(ejercicios.reduce((acc, e) => acc.concat(e.material || []), []));
      if (f.tipo_contenido === 'progresion') {
        const pasos = (f.pasos || []).map(p => porSlug.get(p.slug)).filter(Boolean);
        a.minutos_min = pasos.length ? pasos.reduce((s, p) => s + (p.minutos_min || 0), 0) : null;
        a.minutos_max = pasos.length ? pasos.reduce((s, p) => s + (p.minutos_max || 0), 0) : null;
        a.categorias_comunes = interseccion(pasos.map(p => p.categorias || []));
      } else {
        const bloques = (f.bloques || []).filter(b => porSlug.has(b.slug));
        a.minutos_total = (f.bloques || []).reduce((s, b) => s + (b.minutos || 0), 0);
        a.categorias_comunes = interseccion(bloques.map(b => porSlug.get(b.slug).categorias || []));
        a.distribucion_areas = {};
        a.distribucion_habilidades = {};
        bloques.forEach(b => {
          const hijo = porSlug.get(b.slug);
          const area = areaDe(hijo.habilidad_principal);
          if (area) a.distribucion_areas[area] = (a.distribucion_areas[area] || 0) + b.minutos;
          if (hijo.habilidad_principal) a.distribucion_habilidades[hijo.habilidad_principal] = (a.distribucion_habilidades[hijo.habilidad_principal] || 0) + b.minutos;
        });
      }
      a.nivel_etiqueta = a.dificultad_min === null ? null : nivelDe(a.dificultad_min) === nivelDe(a.dificultad_max) ? nivelDe(a.dificultad_min) : null;
      resultado.set(f.slug, a);
    });
    return resultado;
  }

  /** Vocabulario para la interfaz: etiquetas, grupos y áreas. */
  function vocabulario() {
    return {
      etiquetas: VOCAB,
      areas: AREAS,
      grupos: Object.fromEntries(Object.keys(GRUPOS).map(g => [g, { etiqueta: GRUPOS[g][0], habilidades: Object.keys(HABILIDADES).filter(h => HABILIDADES[h][1] === g) }])),
      area_habilidad: Object.fromEntries(Object.keys(HABILIDADES).map(h => [h, areaDe(h)])),
    };
  }

  return { VERSION, TIPOS, VOCAB, DERIVADOS, validar, validarLote, derivar, fila, agregados, vocabulario, youtubeId, areaDe, nivelDe };
})();
