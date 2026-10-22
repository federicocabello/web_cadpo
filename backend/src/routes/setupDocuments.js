const router = require('express').Router();
const controller = require('../controllers/setupDocumentsController');
const requireAdmin = require('../middleware/requireAdmin');
const uploadSetupDocument = require('../middleware/uploadSetupDocument');

router.get('/', controller.getPublic);
router.get('/admin', requireAdmin, controller.getAdmin);
router.post('/admin', requireAdmin, uploadSetupDocument.single('documento'), controller.create);
router.put('/admin/:id', requireAdmin, uploadSetupDocument.single('documento'), controller.update);
router.delete('/admin/:id', requireAdmin, controller.remove);

module.exports = router;
