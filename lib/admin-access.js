export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function getAdminEmail() {
  return normalizeEmail(process.env.SFA_ADMIN_EMAIL);
}

export function isAdminEmail(value) {
  const adminEmail = getAdminEmail();
  return Boolean(adminEmail) && normalizeEmail(value) === adminEmail;
}

export function isAdminUser(user) {
  return isAdminEmail(user?.email);
}

export function requiresAdminEmail(path) {
  return ADMIN_EMAIL_PATHS.has(path);
}
const ADMIN_EMAIL_PATHS = new Set([
  'sign-in/email',
  'sign-up/email',
  'request-password-reset',
]);
