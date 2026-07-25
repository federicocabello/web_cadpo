const countryCodes = {
  ar: 'ar', argentina: 'ar',
  br: 'br', brasil: 'br', brazil: 'br',
  cl: 'cl', chile: 'cl',
  uy: 'uy', uruguay: 'uy',
  py: 'py', paraguay: 'py',
  ec: 'ec', ecuador: 'ec',
  ve: 've', venezuela: 've',
  co: 'co', colombia: 'co',
};

const normalizeCountryCode = value => {
  const normalized = String(value || '').trim().toLocaleLowerCase('es-AR');
  return countryCodes[normalized] || normalized.slice(0, 2);
};

module.exports = normalizeCountryCode;
