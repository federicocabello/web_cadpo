const express = require('express');
const router = express.Router();
const resultsController = require('../controllers/resultsController');
const requireAdmin = require('../middleware/requireAdmin');
const uploadResultAppealVideo = require('../middleware/uploadResultAppealVideo');

router.get('/', resultsController.getAll);
router.get('/appeals', resultsController.getAppeals);
router.post('/appeals', requireAdmin, uploadResultAppealVideo.single('video'), resultsController.createAppeal);
router.put('/appeals/:appealId', requireAdmin, uploadResultAppealVideo.single('video'), resultsController.updateAppeal);
router.patch('/appeals/:appealId/status', requireAdmin, resultsController.updateAppealStatus);
router.delete('/appeals/:appealId', requireAdmin, resultsController.removeAppeal);
router.get('/:id', resultsController.getById);
router.post('/', resultsController.create);
router.post('/bulk', resultsController.saveBulk);
router.put('/:id', resultsController.update);
router.delete('/:id', resultsController.remove);

module.exports = router;
