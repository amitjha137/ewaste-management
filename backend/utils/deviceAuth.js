import { listTokens } from './deviceTokens.js';

// Returns true when `token` is allowed to act as a device.
// If no tokens are configured at all, devices are allowed without a token
// (same behaviour as before).
export function isTokenAllowed(token) {
  let allowed = [];
  try { allowed = listTokens(); } catch (e) { allowed = []; }
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(token);
}

export function tokensRequired() {
  try { return listTokens().length > 0; } catch (e) { return false; }
}
