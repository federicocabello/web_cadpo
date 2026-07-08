import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.error || error.message || 'Error de red';
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

export const eventsApi = {
  getAll: params => api.get('/events', { params }),
  getUpcoming: () => api.get('/events/proximas'),
  create: data => api.post('/events', data),
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
};

export const mediaApi = {
  getChampionshipImages: params => api.get('/media/championship-images', { params }),
};

export default api;
