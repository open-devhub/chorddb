import { createCipheriv, createDecipheriv, randomBytes, scryptSync, type CipherGCMTypes } from "node:crypto";

export interface EncryptOptions {
	key: Buffer;
	algorithm?: CipherGCMTypes;
}

export interface DecryptOptions {
	key: Buffer;
	iv: string | Buffer;
	authTag: string | Buffer;
	algorithm?: CipherGCMTypes;
}

export interface EncryptedResult {
	ciphertext: string;
	iv: string;
	authTag: string;
}

export const DEFAULT_ALGORITHM: CipherGCMTypes = "aes-256-gcm";
export const DEFAULT_SALT = "chorddb";
export const DEFAULT_IV_LENGTH = 12;
export const DEFAULT_KEY_LENGTH = 32;

export function getKey(password: string, salt = DEFAULT_SALT, keyLen = DEFAULT_KEY_LENGTH): Buffer {
	return scryptSync(password, salt, keyLen);
}

export function encrypt(data: string, options: EncryptOptions): EncryptedResult {
	const { key, algorithm = DEFAULT_ALGORITHM } = options;

	const iv = randomBytes(DEFAULT_IV_LENGTH);
	const cipher = createCipheriv(algorithm, key, iv);

	let ciphertext = cipher.update(data, "utf8", "base64");
	ciphertext += cipher.final("base64");

	const authTag = cipher.getAuthTag();

	return {
		ciphertext,
		iv: iv.toString("base64"),
		authTag: authTag.toString("base64"),
	};
}

export function decrypt(ciphertext: string, options: DecryptOptions): string | undefined {
	const { key, iv, authTag, algorithm = DEFAULT_ALGORITHM } = options;

	try {
		const ivBuffer = typeof iv === "string" ? Buffer.from(iv, "base64") : iv;
		const authTagBuffer = typeof authTag === "string" ? Buffer.from(authTag, "base64") : authTag;

		const decipher = createDecipheriv(algorithm, key, ivBuffer);
		decipher.setAuthTag(authTagBuffer);

		let plaintext = decipher.update(ciphertext, "base64", "utf8");
		plaintext += decipher.final("utf8");

		return plaintext;
	} catch {
		return undefined;
	}
}
