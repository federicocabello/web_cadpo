import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use(config => {
  const adminToken = typeof localStorage !== 'undefined' ? localStorage.getItem('cadpo_admin_token') : '';
  if (adminToken) config.headers.Authorization = `Bearer ${adminToken}`;

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

export const eventsApi = {
  getAll: params => api.get('/events', { params }),
  getUpcoming: () => api.get('/events/proximas'),
  create: data => api.post('/events', data),
  createBatch: events => api.post('/events/batch', { events }),
  update: (idcampeonato, ronda, data) => api.put(`/events/${idcampeonato}/${ronda}`, data),
  updateMultipliers: (idcampeonato, ronda, data) => api.patch(`/events/${idcampeonato}/${ronda}/multipliers`, data),
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

export const pollsApi = {
  getAll: () => api.get('/polls'),
  vote: (id, idopciones) => api.post(`/polls/${id}/vote`, { idopciones }),
  getAdminAll: () => api.get('/polls/admin/all'),
  create: data => api.post('/polls/admin', data, { timeout: 60000 }),
  update: (id, data) => api.put(`/polls/admin/${id}`, data, { timeout: 60000 }),
  resetVotes: id => api.delete(`/polls/admin/${id}/votes`),
  remove: id => api.delete(`/polls/admin/${id}`),
};

export const complaintsApi = {
  getContext: () => api.get('/complaints/context'),
  create: data => api.post('/complaints', data),
  getAdminAll: params => api.get('/complaints/admin', { params }),
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
