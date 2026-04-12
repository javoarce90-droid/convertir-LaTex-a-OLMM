const TEMPLATE_PLACEHOLDER_KEYS = [
  // Datos generales
  'tituloSesion',
  'docente',
  'institucionEducativa',
  'nivel',
  'grado',
  'area',
  'seccion',
  'fecha',

  // Propósitos de aprendizaje
  'competencias',
  'capacidades',
  'desempeños',
  'criteriosDeEvaluacion',
  'instrumentosDeEvaluacion',
  'estandarDeAprendizaje',
  'proposito',
  'evidencia',

  // Enfoques transversales
  'competenciasTransversales',
  'enfoquesTransversales',
  'valores',
  'actitudes',

  // Secuencia didáctica
  'inicio',
  'inicioTiempo',
  'desarrollo',
  'desarrolloTiempo',
  'cierre',
  'cierreTiempo',

  // Ficha de aprendizaje
  'ejerciciosRespuestas',
];

/**
* Subset de TEMPLATE_PLACEHOLDER_KEYS cuyos valores pueden contener
* markdown y fórmulas LaTeX ($...$ inline, $$...$$ display).
* Estos campos se procesan con el parser LaTeX → OMML en lugar de
* insertarse como texto plano.
*/
const MARKDOWN_PLACEHOLDER_KEYS = [
  'inicio',
  'desarrollo',
  'cierre',
  'ejerciciosRespuestas',
];

// Sets para lookups O(1)
const ALLOWED_TEMPLATE_KEYS     = new Set(TEMPLATE_PLACEHOLDER_KEYS);
const MARKDOWN_PLACEHOLDER_KEYS_SET = new Set(MARKDOWN_PLACEHOLDER_KEYS);

module.exports = {
  TEMPLATE_PLACEHOLDER_KEYS,
  ALLOWED_TEMPLATE_KEYS,
  MARKDOWN_PLACEHOLDER_KEYS,
  MARKDOWN_PLACEHOLDER_KEYS_SET,
};