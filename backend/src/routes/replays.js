const router = require('express').Router();
const controller = require('../controllers/replaysController');
const requireAdmin = require('../middleware/requireAdmin');
const uploadReplay = require('../middleware/uploadReplay');

router.get('/', controller.getAll);
router.get('/:id/download', controller.download);
router.post('/', requireAdmin, uploadReplay.single('replay'), controller.create);
router.delete('/:id', requireAdmin, controller.remove);

module.exports = router;
