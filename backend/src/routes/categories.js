const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categoriesController');
const uploadCategoryLogo = require('../middleware/uploadCategoryLogo');

router.get('/', categoriesController.getAll);
router.get('/:id', categoriesController.getById);
router.post('/', uploadCategoryLogo.single('logo'), categoriesController.create);
router.put('/:id', uploadCategoryLogo.single('logo'), categoriesController.update);
router.delete('/:id', categoriesController.remove);

module.exports = router;
