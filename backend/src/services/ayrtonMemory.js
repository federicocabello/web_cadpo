const { isD1Configured, queryD1 } = require('./ayrtonAudit');

const MEMORY_LIMIT = 6;
const MEMORY_TERMS_LIMIT = 6;
const MEMORY_STOP_WORDS = new Set([
  'como', 'cual', 'cuando', 'donde', 'quien', 'para', 'sobre', 'desde', 'hasta', 'esta', 'este',
  'estos', 'estas', 'tiene', 'tienen', 'quiero', 'saber', 'decime', 'dime', 'hay', 'del', 'las',
  'los', 'una', 'uno', 'unos', 'unas', 'que', 'por', 'con', 'sin', 'sus', 'son', 'cadpo',
]);

const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const getTerms = question => [...new Set(normalize(question).split(' ')
  .filter(term => term.length >= 4 && !MEMORY_STOP_WORDS.has(term)))]
  .slice(0, MEMORY_TERMS_LIMIT);

const loadApprovedMemory = async question => {
  if (!isD1Configured()) return [];
  const terms = getTerms(question);

  try {
    const result = await queryD1(`
      SELECT id, title, content, keywords, source, priority, updated_at
      FROM ayrton_knowledge
      WHERE approved = 1 AND active = 1
      ORDER BY priority DESC, updated_at DESC, id DESC
      LIMIT 250
    `);

    const generalContext = result.rows
      .filter(item => item.source === 'admin_context')
      .slice(0, 1);
    const relevantMemory = result.rows
      .filter(item => item.source !== 'admin_context')
      .map(item => ({
        item,
        score: terms.reduce((score, term) => (
          score + (normalize(`${item.title} ${item.keywords || ''} ${item.content}`).includes(term) ? 1 : 0)
        ), 0),
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score || Number(b.item.priority || 0) - Number(a.item.priority || 0))
      .slice(0, MEMORY_LIMIT)
      .map(entry => entry.item);

    return [...generalContext, ...relevantMemory];
  } catch (error) {
    if (!/no such table/i.test(error.message)) {
      console.error('[Ayrton] No se pudo consultar la memoria aprobada:', error.message);
    }
    return [];
  }
};

module.exports = { loadApprovedMemory };
