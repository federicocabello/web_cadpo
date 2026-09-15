const router = require('express').Router();
const statisticsController = require('../controllers/statisticsController');

router.get('/', statisticsController.getOverview);
router.get('/drivers', statisticsController.searchDrivers);
router.get('/drivers/:id', statisticsController.getDriverStatistics);

module.exports = router;
