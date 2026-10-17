const { isD1Configured, queryD1 } = require('./ayrtonAudit');

const loadApprovedMemory = async () => {
  if (!isD1Configured()) return [];

  try {
    const result = await queryD1(`
      SELECT id, title, content, keywords, source, priority, updated_at
      FROM ayrton_knowledge
      WHERE approved = 1 AND active = 1 AND source = 'admin_context'
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `);
    return result.rows;
  } catch (error) {
    if (!/no such table/i.test(error.message)) {
      console.error('[Ayrton] No se pudo consultar la memoria aprobada:', error.message);
    }
    return [];
  }
};

module.exports = { loadApprovedMemory };
