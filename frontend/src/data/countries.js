export const countries = [
  { code: 'ar', name: 'Argentina' },
  { code: 'br', name: 'Brasil' },
  { code: 'cl', name: 'Chile' },
  { code: 'bo', name: 'Bolivia' },
  { code: 'co', name: 'Colombia' },
  { code: 'ec', name: 'Ecuador' },
  { code: 'gy', name: 'Guyana' },
  { code: 'py', name: 'Paraguay' },
  { code: 'pe', name: 'Perú' },
  { code: 'sr', name: 'Surinam' },
  { code: 'uy', name: 'Uruguay' },
  { code: 've', name: 'Venezuela' },
  { code: 'ca', name: 'Canadá' },
  { code: 'us', name: 'Estados Unidos' },
  { code: 'mx', name: 'México' },
  { code: 'bz', name: 'Belice' },
  { code: 'cr', name: 'Costa Rica' },
  { code: 'sv', name: 'El Salvador' },
  { code: 'gt', name: 'Guatemala' },
  { code: 'hn', name: 'Honduras' },
  { code: 'ni', name: 'Nicaragua' },
  { code: 'pa', name: 'Panamá' },
  { code: 'cu', name: 'Cuba' },
  { code: 'do', name: 'República Dominicana' },
  { code: 'jm', name: 'Jamaica' },
  { code: 'pr', name: 'Puerto Rico' },
  { code: 'de', name: 'Alemania' },
  { code: 'at', name: 'Austria' },
  { code: 'be', name: 'Bélgica' },
  { code: 'bg', name: 'Bulgaria' },
  { code: 'hr', name: 'Croacia' },
  { code: 'dk', name: 'Dinamarca' },
  { code: 'sk', name: 'Eslovaquia' },
  { code: 'si', name: 'Eslovenia' },
  { code: 'es', name: 'España' },
  { code: 'ee', name: 'Estonia' },
  { code: 'fi', name: 'Finlandia' },
  { code: 'fr', name: 'Francia' },
  { code: 'gr', name: 'Grecia' },
  { code: 'hu', name: 'Hungría' },
  { code: 'ie', name: 'Irlanda' },
  { code: 'is', name: 'Islandia' },
  { code: 'it', name: 'Italia' },
  { code: 'lv', name: 'Letonia' },
  { code: 'lt', name: 'Lituania' },
  { code: 'lu', name: 'Luxemburgo' },
  { code: 'mc', name: 'Mónaco' },
  { code: 'no', name: 'Noruega' },
  { code: 'nl', name: 'Países Bajos' },
  { code: 'pl', name: 'Polonia' },
  { code: 'pt', name: 'Portugal' },
  { code: 'gb', name: 'Reino Unido' },
  { code: 'cz', name: 'República Checa' },
  { code: 'ro', name: 'Rumania' },
  { code: 'se', name: 'Suecia' },
  { code: 'ch', name: 'Suiza' },
  { code: 'tr', name: 'Turquía' },
  { code: 'ua', name: 'Ucrania' },
  { code: 'za', name: 'Sudáfrica' },
  { code: 'au', name: 'Australia' },
  { code: 'nz', name: 'Nueva Zelanda' },
  { code: 'cn', name: 'China' },
  { code: 'kr', name: 'Corea del Sur' },
  { code: 'in', name: 'India' },
  { code: 'id', name: 'Indonesia' },
  { code: 'jp', name: 'Japón' },
  { code: 'my', name: 'Malasia' },
  { code: 'sg', name: 'Singapur' },
  { code: 'th', name: 'Tailandia' },
  { code: 'ae', name: 'Emiratos Árabes Unidos' },
  { code: 'bh', name: 'Baréin' },
  { code: 'qa', name: 'Catar' },
  { code: 'sa', name: 'Arabia Saudita' },
];

const countriesByCode = new Map(countries.map(country => [country.code, country]));
const selectCountries = codes => codes.map(code => countriesByCode.get(code)).filter(Boolean);

export const driverCountries = selectCountries([
  'ar', 'br', 'cl', 'uy', 'py', 'ec', 've', 'co',
]);

export const circuitCountries = selectCountries([
  'ar', 'br', 'cl', 'uy',
  'us', 'ca', 'mx',
  'de', 'at', 'be', 'es', 'fr', 'gb', 'hu', 'it', 'mc', 'nl', 'pt', 'cz', 'se', 'tr',
  'au', 'nz', 'cn', 'jp', 'my', 'sg',
  'ae', 'bh', 'qa', 'sa', 'za',
]);

const aliases = Object.fromEntries(countries.flatMap(country => [
  [country.code, country.code],
  [country.name.toLocaleLowerCase('es-AR'), country.code],
]));

export const normalizeCountryCode = value => aliases[String(value || '').trim().toLocaleLowerCase('es-AR')] || '';

export const getCountryName = value => {
  const code = normalizeCountryCode(value);
  return countries.find(country => country.code === code)?.name || value || '';
};
