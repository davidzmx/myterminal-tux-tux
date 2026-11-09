const crypto = require('crypto');

/**
 * Cifrado Zero-Knowledge para sincronización en la nube usando AES-256-GCM
 * Deriva una clave de 256 bits a partir de la contraseña maestra del usuario
 * mediante PBKDF2 con 100,000 iteraciones y salt criptográfico seguro.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

/**
 * Cifra un objeto JavaScript o cadena de texto con una contraseña maestra.
 * @param {object|string} payload - Datos a cifrar (perfiles SSH, sesiones, etc.)
 * @param {string} masterPassword - Contraseña maestra elegida por el usuario
 * @returns {string} Paquete cifrado en formato JSON (salt, iv, authTag, data)
 */
function encryptSyncPayload(payload, masterPassword) {
  if (!masterPassword || typeof masterPassword !== 'string' || masterPassword.length === 0) {
    throw new Error('Se requiere una contraseña maestra para cifrar los datos.');
  }

  const plaintext = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derivar clave de 256 bits usando PBKDF2
  const key = crypto.pbkdf2Sync(masterPassword, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  const bundle = {
    version: 1,
    algorithm: ALGORITHM,
    kdf: 'pbkdf2-sha256',
    iterations: PBKDF2_ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted,
    createdAt: new Date().toISOString()
  };

  return JSON.stringify(bundle, null, 2);
}

/**
 * Descifra un paquete cifrado con la contraseña maestra.
 * @param {string|object} bundleOrString - Paquete cifrado en formato JSON
 * @param {string} masterPassword - Contraseña maestra ingresada por el usuario
 * @returns {object} Datos originales descifrados
 */
function decryptSyncPayload(bundleOrString, masterPassword) {
  if (!masterPassword || typeof masterPassword !== 'string') {
    throw new Error('Se requiere una contraseña maestra para descifrar.');
  }

  let bundle;
  if (typeof bundleOrString === 'string') {
    try {
      bundle = JSON.parse(bundleOrString);
    } catch (e) {
      throw new Error('El archivo de la nube no tiene un formato válido.');
    }
  } else {
    bundle = bundleOrString;
  }

  if (!bundle || !bundle.ciphertext || !bundle.salt || !bundle.iv || !bundle.authTag) {
    throw new Error('El paquete cifrado está corrupto o incompleto.');
  }

  const salt = Buffer.from(bundle.salt, 'base64');
  const iv = Buffer.from(bundle.iv, 'base64');
  const authTag = Buffer.from(bundle.authTag, 'base64');
  const iterations = bundle.iterations || PBKDF2_ITERATIONS;

  const key = crypto.pbkdf2Sync(masterPassword, salt, iterations, KEY_LENGTH, 'sha256');

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(bundle.ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (err) {
    throw new Error('Contraseña maestra incorrecta o el archivo ha sido alterado.');
  }
}

module.exports = {
  encryptSyncPayload,
  decryptSyncPayload
};

