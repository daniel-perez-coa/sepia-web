export const FEATURED_ADJUSTMENT_FIELDS = Object.freeze([
  Object.freeze({
    key: 'horizontal',
    label: 'Posición horizontal',
    type: 'select',
    defaultValue: 'left',
    options: Object.freeze(['left', 'center', 'right']),
  }),
  Object.freeze({
    key: 'vertical',
    label: 'Posición vertical',
    type: 'select',
    defaultValue: 'center',
    options: Object.freeze(['top', 'center', 'bottom']),
  }),
  Object.freeze({
    key: 'boxed',
    label: 'Mostrar caja',
    type: 'boolean',
    defaultValue: false,
  }),
  Object.freeze({
    key: 'rounded',
    label: 'Redondeado',
    type: 'select',
    defaultValue: 'none',
    options: Object.freeze(['none', 'soft', 'pill']),
  }),
]);

export const FEATURED_ADJUSTMENT_SCHEMA_VERSION = 1;

export const normalizeFeaturedAdjustments = (input = {}) => Object.fromEntries(
  FEATURED_ADJUSTMENT_FIELDS.map((field) => {
    const value = input?.[field.key];
    if (field.type === 'boolean') return [field.key, value === true];
    return [field.key, field.options.includes(value) ? value : field.defaultValue];
  }),
);

export const isValidFeaturedAdjustments = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  return FEATURED_ADJUSTMENT_FIELDS.every((field) => {
    const value = input[field.key];
    if (value === undefined) return true;
    return field.type === 'boolean' ? typeof value === 'boolean' : field.options.includes(value);
  });
};
