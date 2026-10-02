const express = require('express');
const controller = require('../controllers/complaintsController');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.get('/context', controller.getContext);
router.post('/', controller.create);
router.get('/admin', requireAdmin, controller.getAdmin);
router.patch('/admin/:id/seen', requireAdmin, controller.markSeen);
router.put('/admin/:id', requireAdmin, controller.update);
router.delete('/admin/:id', requireAdmin, controller.remove);

module.exports = router;
