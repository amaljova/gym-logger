/**
 * Safe UUID generator.
 *
 * `crypto.randomUUID()` is only available in secure contexts (HTTPS / localhost)
 * and only on iOS Safari 15.4+. When the app is opened over a plain-HTTP LAN
 * address (common when testing on a phone) or on an older iOS device,
 * `crypto.randomUUID` is `undefined` and every call that relied on it threw —
 * which silently broke database seeding, starting a workout, and adding sets.
 *
 * This helper uses the native implementation when present and falls back to a
 * `crypto.getRandomValues`-based v4 UUID, and finally to `Math.random` if even
 * that is unavailable. The result is always a valid UUID string.
 */
export function uuid(): string {
  // Preferred: native, cryptographically strong, available in secure contexts.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback: build a v4 UUID from getRandomValues (works in non-secure contexts).
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Per RFC 4122 §4.4 — set version (4) and variant bits.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
    return (
      hex[0] + hex[1] + hex[2] + hex[3] + '-' +
      hex[4] + hex[5] + '-' +
      hex[6] + hex[7] + '-' +
      hex[8] + hex[9] + '-' +
      hex[10] + hex[11] + hex[12] + hex[13] + hex[14] + hex[15]
    );
  }

  // Last-resort fallback (no Web Crypto at all). Not cryptographically strong,
  // but guarantees the app keeps working.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
