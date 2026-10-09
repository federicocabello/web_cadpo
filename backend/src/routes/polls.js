const router = require('express').Router();
const controller = require('../controllers/pollsController');
const requireAdmin = require('../middleware/requireAdmin');
const uploadPollImage = require('../middleware/uploadPollImage');

router.get('/', controller.getPublic);
router.post('/:id/vote', controller.vote);
router.get('/admin/all', requireAdmin, controller.getAdmin);
router.post('/admin', requireAdmin, uploadPollImage.any(), controller.create);
router.put('/admin/:id', requireAdmin, uploadPollImage.any(), controller.update);
router.delete('/admin/:id/votes', requireAdmin, controller.resetVotes);
router.delete('/admin/:id', requireAdmin, controller.remove);

module.exports = router;
