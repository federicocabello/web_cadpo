const fs = require('fs/promises');
const path = require('path');
const publicDir = require('../utils/publicDir');

const KNOWLEDGE_DIR = path.resolve(__dirname, '../../knowledge');
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.csv']);
const MAX_FILE_BYTES = 64 * 1024;
const MAX_DOCUMENTS = 5;
const CACHE_TTL_MS = 5 * 60 * 1000;
const SETUP_DOCUMENT = 'puesta-a-punto-assetto-corsa.md';
const ARGENTINE_CATEGORIES_DOCUMENT = 'categorias-argentinas-2026.md';
const ARGENTINE_CIRCUITS_DOCUMENT = 'circuitos-argentinos-y-f1-2026.md';
const SETUP_TERMS = [
  'setup', 'puesta a punto', 'assetto corsa', 'subviraje', 'sobreviraje', 'camber', 'caida',
  'toe', 'convergencia', 'caster', 'avance', 'neumatico', 'presion', 'temperatura',
  'suspension', 'resorte', 'muelle', 'amortiguador', 'damper', 'damping', 'bump',
  'rebote', 'rebound', 'barra estabilizadora', 'freno', 'reparto', 'diferencial',
  'aerodinamica', 'aleron', 'altura', 'relacion de caja',
];
const ARGENTINE_CATEGORY_TERMS = [
  'tn', 'turismo nacional', 'tn clase 2', 'tn clase 3', 'tc', 'turismo carretera',
  'tc2000', 'super tc2000', 'top race', 'turismo pista', 'copa abarth', 'copa bora',
  'formula 3cv', 'formula internacional', 'gt internacional', 'karting 100',
  'monomarca r12', 'zonal clase', 'categoria argentina', 'categorias argentinas',
];
const ARGENTINE_CATEGORY_TECHNICAL_TERMS = [
  'que es', 'que significa', 'sigla', 'auto', 'autos', 'modelo', 'modelos', 'mecanica',
  'motor', 'motores', 'cilindrada', 'potencia', 'caballo', 'caballos', 'hp', 'peso', 'pesan',
  'traccion', 'delantera', 'trasera', 'comportamiento', 'comporta', 'manejo', 'manejar',
  'tecnica', 'tecnico', 'reglamento', 'homologado', 'homologados', 'diferencia', 'comparar',
];
const CIRCUIT_TERMS = [
  'autodromo', 'autodromos', 'circuito', 'circuitos', 'trazado', 'trazados',
  'galvez', 'mouras', 'balcarce', 'rafaela', 'rosario', 'parana', 'concordia',
  'cabalén', 'cabalen', 'villicum', 'zonda', 'termas', 'viedma', 'toay', 'posadas',
  'obera', 'centenario', 'calafate', 'interlagos', 'spa', 'silverstone', 'monza',
];
const CIRCUIT_CONTEXT_TERMS = [
  'historia', 'historico', 'activo', 'actual', 'vigente', 'abandonado', 'desuso',
  'inactivo', 'reactivado', 'reabierto', 'actualizado', 'remodelado', 'obras',
  'estado', 'variante', 'caracteristica', 'ubicacion', 'homologado', 'corrieron',
  'corrio', 'categorias', 'temporadas', 'zonal', 'zonales', 'asfalto', 'tierra',
  'ripio', 'ovalo', 'karting', 'usado', 'usaron', 'futuro', 'proximo', 'proximos',
];
const STATIC_DOWNLOADS = [
  { filename: 'content-manager.zip', label: 'Content Manager', url: 'https://cadpotorneos.com/content-manager.zip' },
  { filename: 'instructivo-instalacion.mp4', label: 'Instructivo de instalación', url: 'https://cadpotorneos.com/instructivo-instalacion.mp4' },
];

let documentsCache = { loadedAt: 0, documents: [] };

const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const terms = value => [...new Set(normalize(value).split(' ').filter(term => term.length >= 4))];

const isSetupQuestion = question => {
  const normalizedQuestion = normalize(question);
  return SETUP_TERMS.some(term => normalizedQuestion.includes(normalize(term)));
};

const includesTerm = (value, term) => {
  const normalizedTerm = normalize(term);
  if (normalizedTerm.includes(' ')) return value.includes(normalizedTerm);
  return value.split(' ').includes(normalizedTerm);
};

const isArgentineCategoryQuestion = question => {
  const normalizedQuestion = normalize(question);
  const mentionsCategory = ARGENTINE_CATEGORY_TERMS.some(term => includesTerm(normalizedQuestion, term));
  const asksTechnicalContext = ARGENTINE_CATEGORY_TECHNICAL_TERMS.some(term => includesTerm(normalizedQuestion, term));
  return mentionsCategory && asksTechnicalContext;
};

const isCircuitKnowledgeQuestion = question => {
  const normalizedQuestion = normalize(question);
  if (/\b(formula 1|formula uno|f1)\b/.test(normalizedQuestion)) return true;
  const mentionsCircuit = CIRCUIT_TERMS.some(term => includesTerm(normalizedQuestion, term));
  const asksContext = CIRCUIT_CONTEXT_TERMS.some(term => includesTerm(normalizedQuestion, term));
  return mentionsCircuit && asksContext;
};

const loadDocuments = async () => {
  if (Date.now() - documentsCache.loadedAt < CACHE_TTL_MS) return documentsCache.documents;
  let entries = [];
  try {
    entries = await fs.readdir(KNOWLEDGE_DIR, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const documents = [];
  for (const entry of entries) {
    if (!entry.isFile() || !TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    const filePath = path.join(KNOWLEDGE_DIR, entry.name);
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_FILE_BYTES) continue;
    const content = (await fs.readFile(filePath, 'utf8')).trim();
    if (content) documents.push({ name: entry.name, content });
  }

  documentsCache = { loadedAt: Date.now(), documents };
  return documents;
};

const loadDownloads = async () => Promise.all(STATIC_DOWNLOADS.map(async resource => {
  try {
    const stat = await fs.stat(path.join(publicDir, resource.filename));
    return { ...resource, available: stat.isFile(), size: stat.size };
  } catch {
    return { ...resource, available: false, size: 0 };
  }
}));

const loadStaticKnowledge = async question => {
  const [documents, downloads] = await Promise.all([loadDocuments(), loadDownloads()]);
  const questionTerms = terms(question);
  const setupQuestion = isSetupQuestion(question);
  const argentineCategoryQuestion = isArgentineCategoryQuestion(question);
  const circuitKnowledgeQuestion = isCircuitKnowledgeQuestion(question);
  const relevantDocuments = documents
    .map(document => {
      const isSetupDocument = document.name.toLowerCase() === SETUP_DOCUMENT;
      const isArgentineCategoriesDocument = document.name.toLowerCase() === ARGENTINE_CATEGORIES_DOCUMENT;
      const isArgentineCircuitsDocument = document.name.toLowerCase() === ARGENTINE_CIRCUITS_DOCUMENT;
      const lexicalScore = questionTerms.reduce(
        (score, term) => score + (normalize(`${document.name} ${document.content}`).includes(term) ? 1 : 0),
        0,
      );
      return {
        ...document,
        score: (isSetupDocument && !setupQuestion)
          || (isArgentineCategoriesDocument && !argentineCategoryQuestion)
          || (isArgentineCircuitsDocument && !circuitKnowledgeQuestion)
          ? 0
          : lexicalScore
            + (setupQuestion && isSetupDocument ? 100 : 0)
            + (argentineCategoryQuestion && isArgentineCategoriesDocument ? 100 : 0)
            + (circuitKnowledgeQuestion && isArgentineCircuitsDocument ? 100 : 0),
      };
    })
    .filter(document => document.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, MAX_DOCUMENTS)
    .map(({ name, content }) => ({ name, content: content.slice(0, 12000) }));

  return { documents: relevantDocuments, downloads };
};

module.exports = { loadStaticKnowledge };
