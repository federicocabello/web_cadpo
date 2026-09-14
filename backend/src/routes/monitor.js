const express = require('express');
const controller = require('../controllers/monitorController');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();
router.use(requireAdmin);
router.get('/', controller.getStatus);
router.put('/', controller.update);
router.post('/test-email', controller.sendTest);

module.exports = router;
