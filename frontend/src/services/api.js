import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const vehicleAPI = {
  getAll: () => apiClient.get('/vehicles'),
  getById: (id) => apiClient.get(`/vehicles/${id}`),
  getCurrent: (id) => apiClient.get(`/vehicles/${id}/current`),
  getHistory: (id, startTime, endTime) => 
    apiClient.get(`/vehicles/${id}/history`, {
      params: { start_time: startTime, end_time: endTime, limit: 1000 }
    })
};

export const alertAPI = {
  getAll: (filters = {}) => apiClient.get('/alerts', { params: filters }),
  resolve: (id, resolvedBy, notes) => 
    apiClient.post(`/alerts/${id}/resolve`, { resolved_by: resolvedBy, notes })
};

export const dashboardAPI = {
  getSummary: () => apiClient.get('/dashboard/summary')
};

export const routeAPI = {
  getAll: () => apiClient.get('/routes'),
  create: (routeData) => apiClient.post('/routes', routeData)
};

export default apiClient;
