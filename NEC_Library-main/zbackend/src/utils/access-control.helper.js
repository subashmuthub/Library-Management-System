/**
 * Access Control Helper
 * 
 * Centralized policy checker for institutional access rules,
 * specifically "Restricted Research Paper & ME Thesis" permissions.
 */

// Eligible degree programs for direct access to restricted research & thesis titles
const DIRECT_RESEARCH_DEGREES = [
  'me',
  'm.tech',
  'mtech',
  'phd',
  'ph.d',
  'research scholar',
  'ms',
  'm.s',
  'm.phil',
];

// Institutional roles with default administrative/faculty direct access
const DIRECT_RESEARCH_ROLES = [
  'admin',
  'librarian',
  'staff',
  'faculty',
  'teacher',
  'me_student',
  'research_scholar',
];

/**
 * Evaluates whether a user qualifies for direct checkout or reservation
 * of restricted research titles without requiring Librarian/Admin approval.
 * 
 * @param {Object} user - User object containing role, role_name, degree_type, etc.
 * @returns {boolean} - True if eligible for direct access
 */
const hasDirectResearchAccess = (user) => {
  if (!user) return false;

  // 1. Role-based privilege check
  const role = String(user.role || user.role_name || user.role?.role_name || '').toLowerCase();
  if (DIRECT_RESEARCH_ROLES.includes(role)) {
    return true;
  }

  // 2. Academic degree check (Postgraduate / Doctoral)
  const degree = String(user.degree_type || user.degree || '').trim().toLowerCase();
  return DIRECT_RESEARCH_DEGREES.includes(degree);
};

module.exports = {
  DIRECT_RESEARCH_DEGREES,
  DIRECT_RESEARCH_ROLES,
  hasDirectResearchAccess,
};
