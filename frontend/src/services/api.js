import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use(config => {
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
  getById: id => api.get(`/championships/${id}`),
  getStandings: id => api.get(`/championships/${id}/standings`),
  getCalendar: id => api.get(`/championships/${id}/calendario`),
  getPrizes: id => api.get(`/championships/${id}/premios`),
  getEnrolled: id => api.get(`/championships/${id}/inscriptos`),
  create: data => api.post('/championships', data),
  update: (id, data) => api.put(`/championships/${id}`, data),
  remove: id => api.delete(`/championships/${id}`),
};

export const registrationsApi = {
  getAll: params => api.get('/registrations', { params }),
  create: data => api.post('/registrations', data),
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
};

export const resultsApi = {
  getAll: params => api.get('/results', { params }),
  create: data => api.post('/results', data),
  update: (id, data) => api.put(`/results/${id}`, data),
  remove: id => api.delete(`/results/${id}`),
};

export const liveTimingApi = {
  get: championshipId => api.get('/live-timing', { params: { championshipId }, timeout: 12000 }),
};

export default api;
