/**
 * src/utils/base64.js
 * Utility functions for converting between Uint8Array and Base64 strings.
 * We need this to store binary data (like salt, serverKey, iv, ciphertext) in Firebase Firestore.
 */

/**
 * Converts a Uint8Array to a Base64 string.
 * @param {Uint8Array} buffer 
 * @returns {string} Default base64 encoded string
 */
export function bufferToBase64(buffer) {
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    return window.btoa(binary);
}

/**
 * Converts a Base64 string to a Uint8Array.
 * @param {string} base64 
 * @returns {Uint8Array}
 */
export function base64ToBuffer(base64) {
    const binaryStr = window.atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
}
