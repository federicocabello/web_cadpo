const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');

router.get('/championship-images', mediaController.getChampionshipImages);

module.exports = router;
