const router = require('express').Router();
const controller = require('../controllers/templatesController');
const requireAdmin = require('../middleware/requireAdmin');
const uploadTemplate = require('../middleware/uploadTemplate');
const uploadPaintFiles = require('../middleware/uploadPaintFiles');
const receivePaintFiles = uploadPaintFiles.array('archivos', 20);

router.get('/', controller.getAll);
router.get('/championships', controller.getChampionships);
router.get('/championships/:idcampeonato/drivers', controller.getEnrolledDrivers);
router.get('/championships/:idcampeonato/paintings/:idpiloto', controller.getSubmittedPaintings);
router.post('/paintings', (req, res, next) => {
  receivePaintFiles(req, res, error => {
    if (!error) return controller.uploadPaintings(req, res, next);
    return uploadPaintFiles.cleanupFiles(req.files)
      .then(() => next(error))
      .catch(next);
  });
});
router.get('/paintings/admin', requireAdmin, controller.getAdminPaintings);
router.get('/paintings/admin/:idcampeonato/:idpiloto/download', requireAdmin, controller.downloadPilotPaintingsZip);
router.patch('/championships/:idcampeonato/paintings-enabled', requireAdmin, controller.updatePaintingsEnabled);
router.get('/paintings/:id/preview', controller.previewSubmittedPainting);
router.get('/paintings/:id/download', requireAdmin, controller.downloadPainting);
router.delete('/paintings/:id', requireAdmin, controller.removePainting);
router.get('/:id/download', controller.download);
router.post('/', requireAdmin, uploadTemplate.single('plantilla'), controller.create);
router.delete('/:id', requireAdmin, controller.remove);

module.exports = router;
