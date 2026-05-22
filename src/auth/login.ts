import { deriveUserKey, clearBuffer } from '../crypto/keyDerivation.js';
import { computeFinalKey } from '../crypto/hash.js';
import { decryptVault, decryptBytes } from '../crypto/encryption.js';
import { base64ToBuffer } from '../utils/base64.js';

export async function performLoginCryptoFlow(masterPassword, firebaseData) {
    try {
        const salt = base64ToBuffer(firebaseData.salt);
        const wrappedServerKey = base64ToBuffer(firebaseData.wrappedServerKey);
        const wrappedServerKeyIv = base64ToBuffer(firebaseData.wrappedServerKeyIv);
        const iv = base64ToBuffer(firebaseData.iv);
        const ciphertext = base64ToBuffer(firebaseData.encryptedVault);

        const kUser = await deriveUserKey(masterPassword, salt);
        const serverKey = await decryptBytes(wrappedServerKey, kUser, wrappedServerKeyIv);
        const kFinal = await computeFinalKey(kUser, serverKey);

        let decryptedVaultString;
        try {
            decryptedVaultString = await decryptVault(ciphertext, kFinal, iv);
        } catch {
            clearBuffer(kUser);
            clearBuffer(serverKey);
            clearBuffer(kFinal);
            throw new Error('Invalid master password or corrupted vault.');
        }

        clearBuffer(kUser);
        clearBuffer(serverKey);
        clearBuffer(kFinal);

        return JSON.parse(decryptedVaultString);
    } catch {
        throw Object.assign(
            new Error('Wrong master password. Your Google login worked, but this password cannot unlock the vault.'),
            { code: 'vault/wrong-master-password' }
        );
    }
}
