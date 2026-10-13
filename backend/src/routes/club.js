const router = require('express').Router();
const controller = require('../controllers/clubController');
const requireAdmin = require('../middleware/requireAdmin');

router.get('/', controller.getPublic);
router.get('/live-timing', controller.getLiveTiming);
router.get('/live-timing/:id', controller.getLiveTiming);
router.get('/admin', requireAdmin, controller.getAdmin);
router.get('/admin/discover', requireAdmin, controller.discoverServers);
router.post('/admin', requireAdmin, controller.create);
router.put('/admin/:id', requireAdmin, controller.update);
router.put('/admin', requireAdmin, controller.update);
router.delete('/admin/:id', requireAdmin, controller.remove);

module.exports = router;
