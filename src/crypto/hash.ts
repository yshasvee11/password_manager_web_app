/**
 * src/crypto/hash.js
 * Cryptographic hashing utilities.
 */

/**
 * Computes K_final by hashing the concatenation of K_user and serverKey.
 * K_final = SHA-256(K_user + serverKey)
 * Both inputs should be Uint8Array.
 * @param {Uint8Array} kUser - derived Argon2id key (32 bytes)
 * @param {Uint8Array} serverKey - random high-entropy key from server (32 bytes)
 * @returns {Promise<Uint8Array>} K_final (32 bytes)
 */
export async function computeFinalKey(kUser: Uint8Array, serverKey: Uint8Array) {
  if (!(kUser instanceof Uint8Array) || !(serverKey instanceof Uint8Array)) {
    throw new Error('Keys must be Uint8Arrays');
  }

  // Concatenate K_user and serverKey
  const combined = new Uint8Array(kUser.length + serverKey.length);
  combined.set(kUser, 0);
  combined.set(serverKey, kUser.length);

  // Hash using WebCrypto API (SHA-256)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', combined);
  
  // Clear combined array from memory (best effort in JS)
  combined.fill(0);
  
  return new Uint8Array(hashBuffer);
}
