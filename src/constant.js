const TEMPLATE_PLACEHOLDER_KEYS = [
  // Datos generales
  'titulosesion',
  'nombredocente',
  'ie',
  'nivel',
  'grado',
  'area',
  'fecha',
  'seccion',

  // Competencias y evaluación
  'Competencias',
  'Capacidades',
  'Desempeños',
  'Criterios',
  'Evaluacion',

  // Transversales
  'competenciastrans',
  'capacidadestrans',
  'enfoques',
  'valores',
  'actitudes',

  // Secuencia didáctica
  'Inicio',
  'Desarrollo',
  'Cierre',
  'tiempoinicio',
  'tiempodesarollo',
  'tiempocierre',

  // Ficha / propósito / evidencia
  'fichadeaprendizaje',
  'proposito',
  'evidencia',
  'estandar',
];

/**
 * Subset de TEMPLATE_PLACEHOLDER_KEYS cuyos valores pueden contener
 * markdown y fórmulas LaTeX ($...$ inline, $$...$$ display).
 * Estos campos se procesan con el parser LaTeX → OMML en lugar de
 * insertarse como texto plano.
 */
const MARKDOWN_PLACEHOLDER_KEYS = [
  'Inicio',
  'Desarrollo',
  'Cierre',
  'fichadeaprendizaje',
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
