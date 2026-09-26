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
  remove: (idcampeonato, ronda) => api.delete(`/events/${idcampeonato}/${ronda}`),
};

export const championshipsApi = {
  getAll: params => api.get('/championships', { params }),
  getLatestActiveStandings: () => api.get('/championships/latest-active-standings'),
  getById: id => api.get(`/championships/${id}`),
  getStandings: id => api.get(`/championships/${id}/standings`),
  getCalendar: id => api.get(`/championships/${id}/calendario`),
  getPrizes: id => api.get(`/championships/${id}/premios`),
  savePrizes: (id, premios) => api.put(`/championships/${id}/premios`, { premios }),
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
  remove: id => api.delete(`/replays/${id}`),
};

export const templatesApi = {
  getAll: params => api.get('/templates', { params }),
  upload: (data, onUploadProgress) => api.post('/templates', data, { timeout: 0, onUploadProgress }),
  remove: id => api.delete(`/templates/${id}`),
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
  uploadImages: (id, data) => api.post(`/registration-forms/admin/${id}/images`, data, { timeout: 60000 }),
  removeImage: (id, filename) => api.delete(`/registration-forms/admin/${id}/images/${encodeURIComponent(filename)}`),
  getOfficialCars: id => api.get(`/registration-forms/admin/${id}/official-cars`),
  createOfficialCar: (id, data) => api.post(`/registration-forms/admin/${id}/official-cars`, data, { timeout: 60000 }),
  updateOfficialCar: (id, officialCarId, data) => api.put(`/registration-forms/admin/${id}/official-cars/${officialCarId}`, data, { timeout: 60000 }),
  removeOfficialCar: (id, officialCarId) => api.delete(`/registration-forms/admin/${id}/official-cars/${officialCarId}`),
  saveConfig: (id, data) => api.put(`/registration-forms/admin/${id}`, data),
  removeConfig: id => api.delete(`/registration-forms/admin/${id}`),
};

export default api;
