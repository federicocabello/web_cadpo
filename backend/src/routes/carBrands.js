const express = require('express');
const carBrandsController = require('../controllers/carBrandsController');
const uploadCarBrandLogo = require('../middleware/uploadCarBrandLogo');

const router = express.Router();

router.get('/', carBrandsController.getAll);
router.post('/', uploadCarBrandLogo.single('logo'), carBrandsController.create);
router.put('/:id', uploadCarBrandLogo.single('logo'), carBrandsController.update);
router.delete('/:id', carBrandsController.remove);

module.exports = router;
