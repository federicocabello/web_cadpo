const express = require('express');
const controller = require('../controllers/sponsorsController');
const requireAdmin = require('../middleware/requireAdmin');
const uploadSponsorMedia = require('../middleware/uploadSponsorMedia');

const router = express.Router();
const sponsorFields = uploadSponsorMedia.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'fotos', maxCount: 10 },
]);

router.get('/', controller.getPublic);
router.get('/admin', requireAdmin, controller.getAdmin);
router.post('/admin', requireAdmin, sponsorFields, controller.create);
router.put('/admin/:id', requireAdmin, sponsorFields, controller.update);
router.delete('/admin/:id/fotos/:photoId', requireAdmin, controller.removePhoto);
router.delete('/admin/:id', requireAdmin, controller.remove);

module.exports = router;
