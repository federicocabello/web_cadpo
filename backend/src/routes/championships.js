const express = require('express');
const router = express.Router();
const c = require('../controllers/championshipsController');
const uploadChampionshipRules = require('../middleware/uploadChampionshipRules');

router.get('/',                         c.getAll);
router.get('/:id',                      c.getById);
router.get('/:id/standings',            c.getStandings);
router.get('/:id/calendario',           c.getCalendar);
router.get('/:id/premios',              c.getPrizes);
router.get('/:id/inscriptos',           c.getEnrolled);
router.post('/',                        uploadChampionshipRules.single('reglamento'), c.create);
router.put('/:id',                      uploadChampionshipRules.single('reglamento'), c.update);
router.delete('/:id',                   c.remove);

module.exports = router;
