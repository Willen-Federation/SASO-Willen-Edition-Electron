import { safeStorage } from 'electron'

// At-rest encryption for sensitive strings (auth tokens, AI provider API
// keys). Wraps Electron's safeStorage so callers don't need to branch on
// platform availability.
//
// Stored values carry a prefix so future versions can rotate the cipher
// or detect legacy plaintext written before encryption was introduced:
//   enc:v1:<base64>  → safeStorage-encrypted (DPAPI / Keychain / kwallet)
//   raw:v1:<value>   → fallback when safeStorage isn't usable (e.g. some
//                       Linux desktops without a secret service running)
//   <anything else>  → legacy plaintext, treated as decrypted as-is so
//                       upgrades don't lock users out

const ENC_PREFIX = 'enc:v1:'
const RAW_PREFIX = 'raw:v1:'

function encryptionUsable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function encryptString(plaintext: string): string {
  if (!plaintext) return ''
  if (encryptionUsable()) {
    try {
      return ENC_PREFIX + safeStorage.encryptString(plaintext).toString('base64')
    } catch {
      // fall through to raw
    }
  }
  return RAW_PREFIX + plaintext
}

export function decryptString(stored: string | null | undefined): string {
  if (!stored) return ''
  if (stored.startsWith(ENC_PREFIX)) {
    try {
      return safeStorage.decryptString(
        Buffer.from(stored.slice(ENC_PREFIX.length), 'base64')
      )
    } catch {
      return ''
    }
  }
  if (stored.startsWith(RAW_PREFIX)) return stored.slice(RAW_PREFIX.length)
  // Legacy plaintext written before this helper landed.
  return stored
}
