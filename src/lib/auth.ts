import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const DEFAULT_DEV_ADMIN_PASSWORD = 'bloxfruit_staff_2026';
const DEFAULT_SESSION_SECRET = 'bfs-session-secret-dev-fallback-key-2026';

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_HASH || DEFAULT_DEV_ADMIN_PASSWORD;
}

/**
 * Constant-time comparison between input password and configured password/hash.
 */
export function verifyAdminPassword(input: string): boolean {
  if (!input) return false;
  const configured = getAdminPassword();

  // If bcrypt hash format
  if (configured.startsWith('$2a$') || configured.startsWith('$2b$')) {
    try {
      return bcrypt.compareSync(input, configured);
    } catch {
      return false;
    }
  }

  // Constant-time string comparison against plain password env var
  const inputBuffer = Buffer.from(input);
  const targetBuffer = Buffer.from(configured);

  if (inputBuffer.length !== targetBuffer.length) {
    // Timing attack mitigation: compare with dummy buffer
    crypto.timingSafeEqual(inputBuffer, inputBuffer);
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, targetBuffer);
}

export interface SessionPayload {
  role: 'staff';
  staffId: string;
  exp: number;
  iat: number;
}

/**
 * Creates a signed HMAC-SHA256 session token for authenticated staff members.
 * Valid for 24 hours.
 */
export function createStaffSessionToken(staffId = 'staff_member'): string {
  const secret = getSessionSecret();
  const payload: SessionPayload = {
    role: 'staff',
    staffId,
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a staff session token's signature and expiration using constant-time check.
 */
export function verifyStaffSessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, providedSig] = parts;
  const secret = getSessionSecret();

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);

  if (providedBuf.length !== expectedBuf.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payload: SessionPayload = JSON.parse(jsonStr);

    if (Date.now() > payload.exp) {
      return null; // Expired
    }

    if (payload.role !== 'staff') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
