const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categoriesController');
const uploadCategoryLogo = require('../middleware/uploadCategoryLogo');
const uploadRegistrationImages = require('../middleware/uploadRegistrationImages');
const requireAdmin = require('../middleware/requireAdmin');

router.get('/', categoriesController.getAll);
router.get('/:id/gallery', categoriesController.getGallery);
router.post('/:id/gallery/:championshipId', requireAdmin, uploadRegistrationImages.array('images', 10), categoriesController.uploadGalleryImages);
router.delete('/:id/gallery/:championshipId/:filename', requireAdmin, categoriesController.removeGalleryImage);
router.get('/:id', categoriesController.getById);
router.post('/', uploadCategoryLogo.single('logo'), categoriesController.create);
router.put('/:id', uploadCategoryLogo.single('logo'), categoriesController.update);
router.delete('/:id', categoriesController.remove);

module.exports = router;
