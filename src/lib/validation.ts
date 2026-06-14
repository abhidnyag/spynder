// Shared auth validation so the client and server enforce identical rules.

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const SPECIAL_CHAR_RE = /[^A-Za-z0-9]/;
export const PASSWORD_MIN = 8;

/** Returns an error message, or null when valid. */
export function validateEmail(email: string): string | null {
  return EMAIL_RE.test(email.trim()) ? null : "Enter a valid email address.";
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (!SPECIAL_CHAR_RE.test(password)) return "Password must include at least one special character (e.g. !@#$).";
  return null;
}
