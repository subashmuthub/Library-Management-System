import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with requests
});

// Response interceptor for error handling
// Temporarily disabled for testing without authentication
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Disabled 401 redirect for development/testing
    // if (error.response?.status === 401) {
    //   localStorage.removeItem('user');
    //   window.location.href = '/login';
    // }
    return Promise.reject(error);
  }
);

export default api;
