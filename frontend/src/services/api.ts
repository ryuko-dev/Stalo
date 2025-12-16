import axios from 'axios';

const api = axios.create({
  baseURL: '/api',  // Use relative URL - works for both local dev and production
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
