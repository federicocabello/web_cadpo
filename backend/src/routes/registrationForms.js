const express = require('express');
const controller = require('../controllers/registrationFormsController');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();
router.get('/', controller.getPublicAll);
router.get('/admin/all', requireAdmin, controller.getAdminAll);
router.put('/admin/:id', requireAdmin, controller.saveConfig);
router.delete('/admin/:id', requireAdmin, controller.removeConfig);
router.get('/:id', controller.getPublicOne);
router.post('/:id/start', controller.start);
router.get('/:id/drivers', controller.searchDrivers);
router.get('/:id/numbers/:number', controller.checkNumber);
router.post('/:id/submit', controller.submit);

module.exports = router;
