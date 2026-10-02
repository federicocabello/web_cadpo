const router = require('express').Router();
const controller = require('../controllers/replaysController');
const requireAdmin = require('../middleware/requireAdmin');
const uploadReplay = require('../middleware/uploadReplay');
const uploadReplayChunk = require('../middleware/uploadReplayChunk');

router.get('/', controller.getAll);
router.get('/:id/download', controller.download);
router.post('/upload/init', requireAdmin, controller.initChunkedUpload);
router.post('/upload/:uploadId/chunk', requireAdmin, uploadReplayChunk.single('chunk'), controller.uploadChunk);
router.post('/upload/:uploadId/complete', requireAdmin, controller.completeChunkedUpload);
router.post('/', requireAdmin, uploadReplay.single('replay'), controller.create);
router.delete('/:id', requireAdmin, controller.remove);

module.exports = router;
