import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use(config => {
  const adminToken = typeof localStorage !== 'undefined' ? localStorage.getItem('cadpo_admin_token') : '';
  if (adminToken) config.headers.Authorization = `Bearer ${adminToken}`;

  if (typeof localStorage !== 'undefined') {
    try {
      let voterId = localStorage.getItem('cadpo_voter_id');
      if (!voterId) {
        voterId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem('cadpo_voter_id', voterId);
      }
      config.headers['X-CADPO-Voter-ID'] = voterId;
    } catch {
      // La votación mantiene la validación por IP si el navegador bloquea el almacenamiento local.
    }
  }

  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.error || error.message || 'Error de red';
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

export const healthApi = {
  check: () => api.get('/health', { validateStatus: () => true }),
};

export const authApi = {
  adminLogin: password => api.post('/auth/admin-login', { password }),
};

export const ayrtonApi = {
  getStatus: () => api.get('/ayrton/status'),
  chat: (message, history = [], sessionId = '') => api.post('/ayrton/chat', { message, history, sessionId }, { timeout: 45000 }),
  getAdminContext: () => api.get('/ayrton/admin/context'),
  updateAdminContext: content => api.put('/ayrton/admin/context', { content }),
  getAdminKnowledge: () => api.get('/ayrton/admin/knowledge'),
  getAdminMessages: (limit = 40) => api.get('/ayrton/admin/messages', { params: { limit } }),
  getAdminUsage: () => api.get('/ayrton/admin/usage'),
  createKnowledge: data => api.post('/ayrton/admin/knowledge', data),
  updateKnowledge: (id, data) => api.put(`/ayrton/admin/knowledge/${id}`, data),
  removeKnowledge: id => api.delete(`/ayrton/admin/knowledge/${id}`),
};

export const eventsApi = {
  getAll: params => api.get('/events', { params }),
  getUpcoming: () => api.get('/events/proximas'),
  create: data => api.post('/events', data),
  createBatch: events => api.post('/events/batch', { events }),
  update: (idcampeonato, ronda, data) => api.put(`/events/${idcampeonato}/${ronda}`, data),
  updateMultipliers: (idcampeonato, ronda, data) => api.patch(`/events/${idcampeonato}/${ronda}/multipliers`, data),
  updateResultsVisibility: (idcampeonato, ronda, visible) => api.patch(`/events/${idcampeonato}/${ronda}/results-visibility`, { visible }),
  updateAppealDeadline: (idcampeonato, ronda, limite_apelaciones) => api.patch(`/events/${idcampeonato}/${ronda}/appeal-deadline`, { limite_apelaciones }),
  updateResultsConfirmation: (idcampeonato, ronda, confirmed) => api.patch(`/events/${idcampeonato}/${ronda}/results-confirmation`, { confirmed }),
  updateHomeVisibility: (idcampeonato, ronda, data) => api.patch(`/events/${idcampeonato}/${ronda}/home-visibility`, data),
  remove: (idcampeonato, ronda) => api.delete(`/events/${idcampeonato}/${ronda}`),
  getBanners: (idcampeonato, ronda) => api.get(`/events/${idcampeonato}/${ronda}/banners`),
  uploadBanners: (idcampeonato, ronda, data) => api.post(`/events/${idcampeonato}/${ronda}/banners`, data, { timeout: 120000 }),
  removeBanner: (idcampeonato, ronda, filename) => api.delete(`/events/${idcampeonato}/${ronda}/banners/${encodeURIComponent(filename)}`),
};

export const championshipsApi = {
  getAll: params => api.get('/championships', { params }),
  getLatestActiveStandings: () => api.get('/championships/latest-active-standings'),
  getById: id => api.get(`/championships/${id}`),
  getStandings: id => api.get(`/championships/${id}/standings`),
  getCalendar: id => api.get(`/championships/${id}/calendario`),
  getPrizes: id => api.get(`/championships/${id}/premios`),
  savePrizes: (id, premios) => api.put(`/championships/${id}/premios`, { premios }),
  getScoring: id => api.get(`/championships/${id}/puntajes`),
  saveScoring: (id, puntajes) => api.put(`/championships/${id}/puntajes`, { puntajes }),
  getDebutBallasts: id => api.get(`/championships/${id}/lastres-debut`),
  saveDebutBallasts: (id, lastres) => api.put(`/championships/${id}/lastres-debut`, { lastres }),
  getWarnings: id => api.get(`/championships/${id}/apercibimientos`),
  saveWarnings: (id, niveles) => api.put(`/championships/${id}/apercibimientos`, { niveles }),
  setWarningFulfillment: (id, idpiloto, cantidad, cumplida) => api.put(`/championships/${id}/apercibimientos/cumplimiento`, { idpiloto, cantidad, cumplida }),
  setDriverExclusion: (id, idpiloto, excluido) => api.put(`/championships/${id}/excluidos/${idpiloto}`, { excluido }),
  getQualifyingBans: id => api.get(`/championships/${id}/sanciones-clasificacion`),
  saveQualifyingBans: (id, sanciones) => api.put(`/championships/${id}/sanciones-clasificacion`, { sanciones }),
  getEnrolled: id => api.get(`/championships/${id}/inscriptos`),
  create: data => api.post('/championships', data),
  update: (id, data) => api.put(`/championships/${id}`, data),
  remove: id => api.delete(`/championships/${id}`),
};

export const registrationsApi = {
  getAll: params => api.get('/registrations', { params }),
  create: data => api.post('/registrations', data),
  updateBulk: changes => api.put('/registrations/bulk', { changes }),
  updatePayment: (idcampeonato, idpiloto, pago) =>
    api.patch(`/registrations/${idcampeonato}/${idpiloto}/payment`, { pago }),
  remove: (idcampeonato, idpiloto) => api.delete(`/registrations/${idcampeonato}/${idpiloto}`),
};

export const driversApi = {
  getAll: () => api.get('/drivers'),
  getById: id => api.get(`/drivers/${id}`),
  create: data => api.post('/drivers', data),
  update: (id, data) => api.put(`/drivers/${id}`, data),
  remove: id => api.delete(`/drivers/${id}`),
};

export const carsApi = {
  getAll: () => api.get('/cars'),
  getById: id => api.get(`/cars/${id}`),
  create: data => api.post('/cars', data),
  update: (id, data) => api.put(`/cars/${id}`, data),
  remove: id => api.delete(`/cars/${id}`),
};

export const carBrandsApi = {
  getAll: () => api.get('/car-brands'),
  create: data => api.post('/car-brands', data),
  update: (id, data) => api.put(`/car-brands/${id}`, data),
  remove: id => api.delete(`/car-brands/${id}`),
};

export const categoriesApi = {
  getAll: () => api.get('/categories'),
  getById: id => api.get(`/categories/${id}`),
  getGallery: id => api.get(`/categories/${id}/gallery`),
  uploadGalleryImages: (id, championshipId, data) => api.post(`/categories/${id}/gallery/${championshipId}`, data, { timeout: 60000 }),
  removeGalleryImage: (id, championshipId, filename, source) => api.delete(`/categories/${id}/gallery/${championshipId}/${encodeURIComponent(filename)}`, { params: { source } }),
  create: data => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  remove: id => api.delete(`/categories/${id}`),
};

export const circuitsApi = {
  getAll: () => api.get('/circuits'),
  getById: id => api.get(`/circuits/${id}`),
  create: data => api.post('/circuits', data),
  update: (id, data) => api.put(`/circuits/${id}`, data),
  createNote: (id, data) => api.post(`/circuits/${id}/notas`, data),
  updateNote: (id, noteId, data) => api.put(`/circuits/${id}/notas/${noteId}`, data),
  reorderNotes: (id, noteIds) => api.put(`/circuits/${id}/notas/orden`, { noteIds }),
  reuseNotes: (id, noteIds) => api.post(`/circuits/${id}/notas/reutilizar`, { noteIds }),
  removeNote: (id, noteId) => api.delete(`/circuits/${id}/notas/${noteId}`),
  removeNoteImage: (id, noteId, imageId) => api.delete(`/circuits/${id}/notas/${noteId}/imagenes/${imageId}`),
  remove: id => api.delete(`/circuits/${id}`),
};

export const mediaApi = {
  getChampionshipImages: params => api.get('/media/championship-images', { params }),
  getRegistrationImages: params => api.get('/media/registration-images', { params }),
};

export const importerApi = {
  importDrivers: drivers => api.post('/importer/drivers', { drivers }, { timeout: 60000 }),
  importRegistrations: (idcampeonato, registrations) => api.post('/importer/registrations', { idcampeonato, registrations }, { timeout: 60000 }),
};

export const resultsApi = {
  getAll: params => api.get('/results', { params }),
  getAppeals: params => api.get('/results/appeals', { params }),
  createAppeal: (data, onUploadProgress) => api.post('/results/appeals', data, { timeout: 0, onUploadProgress }),
  updateAppeal: (id, data, onUploadProgress) => api.put(`/results/appeals/${id}`, data, { timeout: 0, onUploadProgress }),
  updateAppealStatus: (id, estado) => api.patch(`/results/appeals/${id}/status`, { estado }),
  removeAppeal: id => api.delete(`/results/appeals/${id}`),
  create: data => api.post('/results', data),
  saveBulk: changes => api.post('/results/bulk', { changes }),
  update: (id, data) => api.put(`/results/${id}`, data),
  remove: id => api.delete(`/results/${id}`),
};

export const replaysApi = {
  getAll: params => api.get('/replays', { params }),
  upload: (data, onUploadProgress) => api.post('/replays', data, { timeout: 0, onUploadProgress }),
  initUpload: data => api.post('/replays/upload/init', data, { timeout: 30000 }),
  uploadChunk: (uploadId, data, onUploadProgress) => api.post(`/replays/upload/${uploadId}/chunk`, data, { timeout: 0, onUploadProgress }),
  completeUpload: uploadId => api.post(`/replays/upload/${uploadId}/complete`, {}, { timeout: 120000 }),
  remove: id => api.delete(`/replays/${id}`),
};

export const templatesApi = {
  getAll: params => api.get('/templates', { params }),
  getChampionships: () => api.get('/templates/championships'),
  getEnrolledDrivers: idcampeonato => api.get(`/templates/championships/${idcampeonato}/drivers`),
  getSubmittedPaintings: (idcampeonato, idpiloto) => api.get(`/templates/championships/${idcampeonato}/paintings/${idpiloto}`),
  uploadPaintings: (data, onUploadProgress) => api.post('/templates/paintings', data, { timeout: 0, onUploadProgress }),
  getAdminPaintings: params => api.get('/templates/paintings/admin', { params }),
  downloadPilotPaintings: (idcampeonato, idpiloto) => api.get(`/templates/paintings/admin/${idcampeonato}/${idpiloto}/download`, { responseType: 'blob', timeout: 0 }),
  setPaintingsDeadline: (idcampeonato, fecha_cierre) => api.patch(`/templates/championships/${idcampeonato}/paintings-enabled`, { fecha_cierre }),
  downloadPainting: id => api.get(`/templates/paintings/${id}/download`, { responseType: 'blob', timeout: 0 }),
  removePainting: id => api.delete(`/templates/paintings/${id}`),
  upload: (data, onUploadProgress) => api.post('/templates', data, { timeout: 0, onUploadProgress }),
  remove: id => api.delete(`/templates/${id}`),
};

export const sponsorsApi = {
  getAll: () => api.get('/sponsors'),
  getAdminAll: () => api.get('/sponsors/admin'),
  create: data => api.post('/sponsors/admin', data, { timeout: 60000 }),
  update: (id, data) => api.put(`/sponsors/admin/${id}`, data, { timeout: 60000 }),
  removePhoto: (id, photoId) => api.delete(`/sponsors/admin/${id}/fotos/${photoId}`),
  remove: id => api.delete(`/sponsors/admin/${id}`),
};

export const projectsApi = {
  getAll: () => api.get('/projects'),
  getAdminAll: () => api.get('/projects/admin'),
  create: data => api.post('/projects/admin', data, { timeout: 120000 }),
  update: (id, data) => api.put(`/projects/admin/${id}`, data, { timeout: 120000 }),
  removePhoto: (id, photoId) => api.delete(`/projects/admin/${id}/fotos/${photoId}`),
  remove: id => api.delete(`/projects/admin/${id}`),
};

export const setupDocumentsApi = {
  getAll: () => api.get('/setup-documents'),
  getAdminAll: () => api.get('/setup-documents/admin'),
  create: data => api.post('/setup-documents/admin', data, { timeout: 0 }),
  update: (id, data) => api.put(`/setup-documents/admin/${id}`, data, { timeout: 0 }),
  remove: id => api.delete(`/setup-documents/admin/${id}`),
};

export const pollsApi = {
  getAll: () => api.get('/polls'),
  vote: (id, idopciones) => api.post(`/polls/${id}/vote`, { idopciones }),
  getAdminAll: () => api.get('/polls/admin/all'),
  create: data => api.post('/polls/admin', data, { timeout: 60000 }),
  update: (id, data) => api.put(`/polls/admin/${id}`, data, { timeout: 60000 }),
  updateVisibility: (id, visible) => api.patch(`/polls/admin/${id}/visibility`, { visible }),
  resetVotes: id => api.delete(`/polls/admin/${id}/votes`),
  remove: id => api.delete(`/polls/admin/${id}`),
};

export const complaintsApi = {
  getContext: () => api.get('/complaints/context'),
  create: data => api.post('/complaints', data),
  getAdminAll: params => api.get('/complaints/admin', { params }),
  getAdminConfig: idcampeonato => api.get(`/complaints/admin/config/${idcampeonato}`),
  updateAdminConfig: (idcampeonato, tandas) => api.put(`/complaints/admin/config/${idcampeonato}`, { tandas }),
  markSeen: (id, visto) => api.patch(`/complaints/admin/${id}/seen`, { visto }),
  update: (id, data) => api.put(`/complaints/admin/${id}`, data),
  remove: id => api.delete(`/complaints/admin/${id}`),
};

export const statisticsApi = {
  getOverview: () => api.get('/statistics'),
  searchDrivers: search => api.get('/statistics/drivers', { params: { search } }),
  getDriver: id => api.get(`/statistics/drivers/${id}`),
};

export const liveTimingApi = {
  get: championshipId => api.get('/live-timing', { params: { championshipId }, timeout: 12000 }),
};

export const clubApi = {
  get: () => api.get('/club'),
  getLiveTiming: id => api.get(id ? `/club/live-timing/${id}` : '/club/live-timing', { timeout: 16000 }),
  getAdmin: () => api.get('/club/admin'),
  discover: () => api.get('/club/admin/discover', { timeout: 30000 }),
  create: data => api.post('/club/admin', data),
  update: (id, data) => api.put(`/club/admin/${id}`, data),
  remove: id => api.delete(`/club/admin/${id}`),
};

export const monitorApi = {
  getStatus: () => api.get('/monitor'),
  update: enabled => api.put('/monitor', { enabled }),
  sendTestEmail: () => api.post('/monitor/test-email'),
};

export const registrationFormsApi = {
  getAll: () => api.get('/registration-forms'),
  getById: id => api.get(`/registration-forms/${id}`),
  start: id => api.post(`/registration-forms/${id}/start`),
  searchDrivers: (id, search, formToken) => api.get(`/registration-forms/${id}/drivers`, { params: { search, formToken } }),
  getPreviousRanking: (id, formToken) => api.get(`/registration-forms/${id}/previous-ranking`, { params: { formToken } }),
  checkNumber: (id, number, driverId, excludeCurrent = false) => api.get(`/registration-forms/${id}/numbers/${number}`, {
    params: {
      ...(driverId ? { idpiloto: driverId } : {}),
      ...(excludeCurrent ? { excludeCurrent: 1 } : {}),
    },
  }),
  checkAvailability: (id, data) => api.post(`/registration-forms/${id}/availability`, data),
  submit: (id, data) => api.post(`/registration-forms/${id}/submit`, data),
  getAdminAll: () => api.get('/registration-forms/admin/all'),
  getImages: id => api.get(`/registration-forms/admin/${id}/images`),
  getFreeDrivers: id => api.get(`/registration-forms/admin/${id}/free-drivers`),
  updateFreeDrivers: (id, idpilotos) => api.put(`/registration-forms/admin/${id}/free-drivers`, { idpilotos }),
  uploadImages: (id, data) => api.post(`/registration-forms/admin/${id}/images`, data, { timeout: 60000 }),
  removeImage: (id, filename) => api.delete(`/registration-forms/admin/${id}/images/${encodeURIComponent(filename)}`),
  getOfficialCars: id => api.get(`/registration-forms/admin/${id}/official-cars`),
  createOfficialCar: (id, data) => api.post(`/registration-forms/admin/${id}/official-cars`, data, { timeout: 60000 }),
  updateOfficialCar: (id, officialCarId, data) => api.put(`/registration-forms/admin/${id}/official-cars/${officialCarId}`, data, { timeout: 60000 }),
  removeOfficialCar: (id, officialCarId) => api.delete(`/registration-forms/admin/${id}/official-cars/${officialCarId}`),
  updateVisibility: (id, visible) => api.patch(`/registration-forms/admin/${id}/visibility`, { visible }),
  saveConfig: (id, data) => api.put(`/registration-forms/admin/${id}`, data),
  removeConfig: id => api.delete(`/registration-forms/admin/${id}`),
};

export default api;
