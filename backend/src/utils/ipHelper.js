/**
 * Helper utilities for extracting client IP and actor information from requests.
 * Handles IPv6-mapped IPv4 addresses (::ffff:x.x.x.x) automatically.
 */

/**
 * Extracts the real client IP from the request object.
 * Strips the IPv6-mapped IPv4 prefix (::ffff:) if present.
 * @param {import('express').Request} req
 * @returns {string}
 */
export const getClientIp = (req) => {
  const raw = req.ip || req.connection?.remoteAddress || '';
  return raw.replace(/^::ffff:/, '');
};

/**
 * Returns the acting username from the authenticated user, or a fallback string.
 * @param {import('express').Request} req
 * @param {string} [fallback='API']
 * @returns {string}
 */
export const getActor = (req, fallback = 'API') => {
  return req.user ? req.user.username : fallback;
};
