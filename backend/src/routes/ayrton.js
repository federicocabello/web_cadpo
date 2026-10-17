const router = require('express').Router();
const controller = require('../controllers/ayrtonController');
const requireAdmin = require('../middleware/requireAdmin');

router.get('/status', controller.status);
router.post('/chat', controller.chat);
router.get('/admin/context', requireAdmin, controller.getAdminContext);
router.put('/admin/context', requireAdmin, controller.updateAdminContext);
router.get('/admin/knowledge', requireAdmin, controller.getAdminKnowledge);
router.get('/admin/messages', requireAdmin, controller.getAdminMessages);
router.post('/admin/knowledge', requireAdmin, controller.createAdminKnowledge);
router.put('/admin/knowledge/:id', requireAdmin, controller.updateAdminKnowledge);
router.delete('/admin/knowledge/:id', requireAdmin, controller.removeAdminKnowledge);

module.exports = router;
