const express = require('express');
const router = express.Router();
const registrationsController = require('../controllers/registrationsController');

router.get('/', registrationsController.getAll);
router.post('/', registrationsController.create);
router.put('/bulk', registrationsController.updateBulk);
router.patch('/:idcampeonato/:idpiloto/payment', registrationsController.updatePayment);
router.delete('/:idcampeonato/:idpiloto', registrationsController.remove);

module.exports = router;
