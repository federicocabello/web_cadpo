const express = require('express');
const router = express.Router();
const c = require('../controllers/eventsController');
const requireAdmin = require('../middleware/requireAdmin');
const uploadRegistrationImages = require('../middleware/uploadRegistrationImages');

router.get('/',           c.getAll);
router.get('/proximas',   c.getUpcoming);
router.get('/:idcampeonato/:ronda/banners', c.getBanners);
router.post('/:idcampeonato/:ronda/banners', requireAdmin, uploadRegistrationImages.array('banners', 10), c.uploadBanners);
router.delete('/:idcampeonato/:ronda/banners/:filename', requireAdmin, c.removeBanner);
router.patch('/:idcampeonato/:ronda/multipliers', requireAdmin, c.updateMultipliers);
router.post('/batch',     c.createBatch);
router.post('/',          c.create);
router.put('/:oldIdcampeonato/:oldRonda', c.update);
router.delete('/:idcampeonato/:ronda', c.remove);

module.exports = router;
