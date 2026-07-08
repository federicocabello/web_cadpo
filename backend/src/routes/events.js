const express = require('express');
const router = express.Router();
const c = require('../controllers/eventsController');

router.get('/',           c.getAll);
router.get('/proximas',   c.getUpcoming);
router.post('/',          c.create);
router.delete('/:idcampeonato/:ronda', c.remove);

module.exports = router;
