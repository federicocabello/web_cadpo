const express = require('express');
const importerController = require('../controllers/importerController');

const router = express.Router();

router.post('/drivers', importerController.importDrivers);
router.post('/registrations', importerController.importRegistrations);

module.exports = router;
