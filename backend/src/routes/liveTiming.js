const express = require('express');
const controller = require('../controllers/liveTimingController');

const router = express.Router();

router.get('/', controller.getLiveTiming);

module.exports = router;
