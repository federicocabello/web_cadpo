const router = require('express').Router();
const controller = require('../controllers/templatesController');
const requireAdmin = require('../middleware/requireAdmin');
const uploadTemplate = require('../middleware/uploadTemplate');

router.get('/', controller.getAll);
router.get('/:id/download', controller.download);
router.post('/', requireAdmin, uploadTemplate.single('plantilla'), controller.create);
router.delete('/:id', requireAdmin, controller.remove);

module.exports = router;
