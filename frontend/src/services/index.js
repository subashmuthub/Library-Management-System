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
  // Get all books with pagination and filters
  getAllBooks: async (params) => {
    const response = await api.get('/books', { params });
    return response.data;
  },

  // Search books (legacy endpoint)
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

  addBook: async (bookData) => {
    const response = await api.post('/books', bookData);
    return response.data;
  },

  updateBook: async (bookId, bookData) => {
    const response = await api.put(`/books/${bookId}`, bookData);
    return response.data;
  },

  deleteBook: async (bookId) => {
    const response = await api.delete(`/books/${bookId}`);
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/books/categories');
    return response.data;
  },

  bulkImportBooks: async (books) => {
    const response = await api.post('/books/bulk-import', { books });
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

// Transaction endpoints (Checkout/Return)
export const transactionService = {
  checkoutBook: async (checkoutData) => {
    const response = await api.post('/transactions/checkout', checkoutData);
    return response.data;
  },

  returnBook: async (transactionId, returnData) => {
    const response = await api.post(`/transactions/${transactionId}/return`, returnData);
    return response.data;
  },

  renewBook: async (transactionId, renewData) => {
    const response = await api.post(`/transactions/${transactionId}/renew`, renewData);
    return response.data;
  },

  getAllTransactions: async (params) => {
    const response = await api.get('/transactions', { params });
    return response.data;
  },

  getTransactionById: async (transactionId) => {
    const response = await api.get(`/transactions/${transactionId}`);
    return response.data;
  },

  getUserCheckouts: async (userId) => {
    const response = await api.get(`/transactions/user/${userId}/active`);
    return response.data;
  },

  getOverdueBooks: async (params) => {
    const response = await api.get('/transactions/overdue', { params });
    return response.data;
  },

  getStatistics: async (params) => {
    const response = await api.get('/transactions/statistics', { params });
    return response.data;
  },
};

// Fine management endpoints
export const fineService = {
  getPendingFines: async (params) => {
    const response = await api.get('/fines', { params });
    return response.data;
  },

  getFineById: async (fineId) => {
    const response = await api.get(`/fines/${fineId}`);
    return response.data;
  },

  payFine: async (fineId, paymentData) => {
    const response = await api.post(`/fines/${fineId}/pay`, paymentData);
    return response.data;
  },

  waiveFine: async (fineId, reason) => {
    const response = await api.post(`/fines/${fineId}/waive`, { reason });
    return response.data;
  },

  createManualFine: async (fineData) => {
    const response = await api.post('/fines/manual', fineData);
    return response.data;
  },

  getStatistics: async (params) => {
    const response = await api.get('/fines/statistics', { params });
    return response.data;
  },
};

// Reservation endpoints
export const reservationService = {
  reserveBook: async (reservationData) => {
    const response = await api.post('/reservations', reservationData);
    return response.data;
  },

  getAllReservations: async (params) => {
    const response = await api.get('/reservations', { params });
    return response.data;
  },

  getUserReservations: async (userId, params) => {
    const response = await api.get(`/reservations/user/${userId || ''}`, { params });
    return response.data;
  },

  getBookQueue: async (bookId) => {
    const response = await api.get(`/reservations/book/${bookId}/queue`);
    return response.data;
  },

  cancelReservation: async (reservationId) => {
    const response = await api.post(`/reservations/${reservationId}/cancel`);
    return response.data;
  },

  fulfillReservation: async (reservationId, fulfillData) => {
    const response = await api.post(`/reservations/${reservationId}/fulfill`, fulfillData);
    return response.data;
  },

  getStatistics: async (params) => {
    const response = await api.get('/reservations/statistics', { params });
    return response.data;
  },
};

// User management endpoints
export const userManagementService = {
  getAllUsers: async (params) => {
    const response = await api.get('/user-management', { params });
    return response.data;
  },

  createUser: async (userData) => {
    const response = await api.post('/user-management', userData);
    return response.data;
  },

  getUserDetails: async (userId) => {
    const response = await api.get(`/user-management/${userId}`);
    return response.data;
  },

  updateUser: async (userId, userData) => {
    const response = await api.put(`/user-management/${userId}`, userData);
    return response.data;
  },

  toggleUserStatus: async (userId, statusData) => {
    const response = await api.post(`/user-management/${userId}/toggle-status`, statusData);
    return response.data;
  },

  resetPassword: async (userId, passwordData) => {
    const response = await api.post(`/user-management/${userId}/reset-password`, passwordData);
    return response.data;
  },

  getUserActivityLog: async (userId, params) => {
    const response = await api.get(`/user-management/${userId}/activity-log`, { params });
    return response.data;
  },

  getStatistics: async (params) => {
    const response = await api.get('/user-management/statistics', { params });
    return response.data;
  },
};
