const fs = require('fs/promises');
const path = require('path');
const publicDir = require('../utils/publicDir');

const KNOWLEDGE_DIR = path.resolve(__dirname, '../../knowledge');
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.csv']);
const MAX_FILE_BYTES = 64 * 1024;
const MAX_DOCUMENTS = 5;
const CACHE_TTL_MS = 5 * 60 * 1000;
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
  const relevantDocuments = documents
    .map(document => ({
      ...document,
      score: questionTerms.reduce((score, term) => score + (normalize(`${document.name} ${document.content}`).includes(term) ? 1 : 0), 0),
    }))
    .filter(document => document.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, MAX_DOCUMENTS)
    .map(({ name, content }) => ({ name, content: content.slice(0, 12000) }));

  return { documents: relevantDocuments, downloads };
};

module.exports = { loadStaticKnowledge };
