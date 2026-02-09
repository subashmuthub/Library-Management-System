import api from './api';

// Authentication endpoints
export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  updateProfile: async (userData) => {
    const response = await api.put('/users/profile', userData);
    return response.data;
  },
};

// Entry logging endpoints
export const entryService = {
  logEntry: async (entryData) => {
    const response = await api.post('/entry/log', entryData);
    return response.data;
  },

  getMyHistory: async () => {
    const response = await api.get('/entry/history');
    return response.data;
  },

  getCurrentOccupancy: async () => {
    const response = await api.get('/entry/occupancy');
    return response.data;
  },
};

// Book management endpoints
export const bookService = {
  searchBooks: async (params) => {
    const response = await api.get('/books/search', { params });
    return response.data;
  },

  getBookById: async (bookId) => {
    const response = await api.get(`/books/${bookId}`);
    return response.data;
  },

  getBookLocationHistory: async (bookId) => {
    const response = await api.get(`/books/${bookId}/history`);
    return response.data;
  },
};

// RFID scanning endpoints
export const rfidService = {
  scanTag: async (scanData) => {
    const response = await api.post('/rfid/scan', scanData);
    return response.data;
  },

  listTags: async () => {
    const response = await api.get('/rfid/tags');
    return response.data;
  },

  getMode: async () => {
    const response = await api.get('/rfid/mode');
    return response.data;
  },
};

// Shelf management endpoints
export const shelfService = {
  listShelves: async () => {
    const response = await api.get('/shelves');
    return response.data;
  },

  getShelfById: async (shelfId) => {
    const response = await api.get(`/shelves/${shelfId}`);
    return response.data;
  },

  getBooksOnShelf: async (shelfId) => {
    const response = await api.get(`/shelves/${shelfId}/books`);
    return response.data;
  },
};

// Navigation endpoints
export const navigationService = {
  findBook: async (bookId) => {
    const response = await api.get(`/navigation/find/${bookId}`);
    return response.data;
  },
};

// Beacon endpoints
export const beaconService = {
  listBeacons: async () => {
    const response = await api.get('/beacons');
    return response.data;
  },

  getBeaconByZone: async (zone) => {
    const response = await api.get(`/beacons/zone/${zone}`);
    return response.data;
  },
};
