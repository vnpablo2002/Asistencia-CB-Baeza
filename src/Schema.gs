/**
 * Esquema de las tablas Supabase y lista permitida de campos por tabla.
 */
const SCHEMA = {
  Temporadas: [
    'ID', 'Nombre', 'FechaInicio', 'FechaFin', 'Activa'
  ],
  Equipos: [
    'ID', 'Nombre', 'Categoria', 'Modalidad', 'ID_Temporada'
  ],
  Horarios: [
    'ID', 'ID_Equipo', 'DiaSemana', 'HoraInicio', 'HoraFin'
  ],
  Jugadores: [
    'ID', 'Nombre', 'Apellidos', 'FechaNac', 'Telefono', 'Email', 'FotoURL', 'Dorsal',
    'Usuario', 'PIN', 'CodigoPadres', 'EmailPadre1', 'EmailPadre2', 'NombrePadre1', 'ApellidosPadre1', 'NombrePadre2', 'ApellidosPadre2',
    'NombrePadre1Original', 'NombrePadre2Original',
    'TelefonoPadre1', 'TelefonoPadre2',
    'NotificarAusenciasPadre1', 'NotificarAusenciasPadre2', 'BienvenidaVista'
  ],
  Jugadores_Equipos: [
    'ID', 'ID_Jugador', 'ID_Equipo', 'Tipo', 'Activo', 'FechaAlta', 'FechaBaja'
  ],
  Entrenadores: [
    'ID', 'Nombre', 'Apellidos', 'Email', 'Telefono', 'FotoURL', 'PIN', 'EsAdmin'
  ],
  Administradores: [
    'ID', 'Email', 'PIN', 'Activo'
  ],
  Entrenadores_Equipos: [
    'ID', 'ID_Entrenador', 'ID_Equipo', 'Activo', 'TipoRol', 'FechaAlta', 'FechaBaja'
  ],
  Sesiones: [
    'ID', 'ID_Equipo', 'ID_Temporada', 'ID_Horario', 'Fecha', 'HoraInicio', 'HoraFin', 'EsExtra', 'Notas', 'AsistenciaGuardada',
    'Cancelada', 'MotivoCancelacion', 'FechaCancelacion', 'FechaPrimerRegistro', 'DetalleCancelacion', 'CanceladoPor', 'CanalAvisoCancelacion'
  ],
  Asist_Jugadores: [
    'ID', 'ID_Sesion', 'ID_Jugador', 'Estado', 'EsInvitado', 'Excluido', 'FechaRegistro',
    'TieneJustificacion', 'TipoJustificacion', 'MotivoCategoria', 'MotivoDetalle',
    'FechaJustificacion', 'JustificadoPor', 'MensajeGenerado', 'NotificadoEntrenador', 'EsProgramada', 'MinutosRetraso'
  ],
  Asist_Entrenadores: [
    'ID', 'ID_Sesion', 'ID_Entrenador', 'Asistio', 'EsInvitado', 'Excluido', 'FechaRegistro'
  ],
  Programaciones_Justificaciones: [
    'ID', 'ID_Jugador', 'ID_Equipo', 'ID_Horario', 'TipoIncidencia', 'MotivoCategoria',
    'MotivoDetalle', 'HoraIncorporacion', 'Activo', 'FechaCreacion', 'FechaActualizacion'
  ],
  Avisos_Jugador: [
    'ID', 'ID_Jugador', 'Tipo', 'Mensaje', 'FechaCreacion', 'Leido', 'FechaLectura'
  ],
  hub_contenidos: [
    'id', 'slug', 'version_esquema', 'tipo_contenido', 'nombre', 'nombre_original', 'fecha_enviado', 'fuente', 'origen',
    'licencia_nota', 'creado_por', 'estado', 'confianza_clasificacion', 'sugerencias_vocabulario', 'nota', 'relacionados',
    'resumen', 'objetivo', 'descripcion', 'reglas', 'puntos_clave', 'errores_comunes', 'variante_facil', 'variante_dificil',
    'habilidad_principal', 'habilidades_secundarias', 'fase_juego', 'tema_teoria', 'naturaleza', 'oposicion', 'ventaja_inicial',
    'situacion_numerica', 'organizacion', 'espacio', 'canastas_necesarias', 'jugadores_min', 'jugadores_max', 'balones',
    'material', 'minutos_min', 'minutos_max', 'momento_sesion', 'competitivo', 'categorias', 'dificultad', 'esfuerzo_fisico',
    'carga_cognitiva', 'complejidad_organizativa', 'ideas_principales', 'minutos_clave', 'area', 'grupo_habilidad',
    'areas_trabajadas', 'nivel_etiqueta', 'tipos_recurso', 'recurso_principal_tipo', 'tiene_video', 'tiene_video_exacto',
    'tiene_diagrama', 'youtube_id', 'asignable', 'texto_busqueda', 'busqueda', 'avisos', 'enviado_por', 'revisado_por',
    'revisado_at', 'created_at', 'updated_at'
  ],
  hub_recursos: [
    'id', 'contenido_id', 'orden', 'tipo_recurso', 'url', 'archivo_local', 'etiqueta', 'autor', 'idioma',
    'duracion_seg', 'inicio_seg', 'fin_seg', 'relacion', 'principal', 'youtube_id'
  ],
  hub_progresion_pasos: ['progresion_id', 'orden', 'ejercicio_id', 'criterio_avance'],
  hub_sesion_bloques: ['sesion_id', 'orden', 'contenido_id', 'minutos', 'nota'],
};