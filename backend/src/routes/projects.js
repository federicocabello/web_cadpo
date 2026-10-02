const router = require('express').Router();
const controller = require('../controllers/projectsController');
const requireAdmin = require('../middleware/requireAdmin');
const uploadProjectMedia = require('../middleware/uploadProjectMedia');

router.get('/', controller.getPublic);
router.get('/admin', requireAdmin, controller.getAdmin);
router.post('/admin', requireAdmin, uploadProjectMedia.array('fotos', 20), controller.create);
router.put('/admin/:id', requireAdmin, uploadProjectMedia.array('fotos', 20), controller.update);
router.delete('/admin/:id/fotos/:photoId', requireAdmin, controller.removePhoto);
router.delete('/admin/:id', requireAdmin, controller.remove);

module.exports = router;
