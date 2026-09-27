/**
 * Utility Functions
 * 
 * Common helper functions used throughout the application.
 */

/**
 * Format database date to ISO string
 */
const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toISOString();
};

/**
 * Paginate array
 */
const paginate = (array, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  return array.slice(offset, offset + limit);
};

/**
 * Validate ISBN (10 or 13 digits)
 */
const isValidISBN = (isbn) => {
  const cleaned = isbn.replace(/[^0-9X]/gi, '');
  return cleaned.length === 10 || cleaned.length === 13;
};

/**
 * Generate random RFID tag ID (for testing)
 */
const generateTagId = () => {
  const prefix = 'RFID';
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `${prefix}-${random}`;
};

/**
 * Calculate age from publication year
 */
const calculateAge = (publicationYear) => {
  const currentYear = new Date().getFullYear();
  return currentYear - publicationYear;
};

/**
 * Sanitize search query (prevent SQL injection in dynamic queries)
 */
const sanitizeSearchQuery = (query) => {
  if (!query) return '';
  return query.replace(/[^a-zA-Z0-9\s]/g, '');
};

/**
 * Round to decimal places
 */
const roundTo = (value, decimals = 2) => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

module.exports = {
  formatDate,
  paginate,
  isValidISBN,
  generateTagId,
  calculateAge,
  sanitizeSearchQuery,
  roundTo
};
