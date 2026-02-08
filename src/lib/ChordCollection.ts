import { Routes, type APIMessage } from "discord-api-types/v10";

import { decrypt, encrypt, type EncryptedResult } from "../utils/crypto.js";
import type { Chord, ChordCollectionOptions } from "./Chord.js";

export interface UpdateOperators {
	$set?: Record<string, any>;
	$inc?: Record<string, number>;
	$unset?: Record<string, true>;
	$push?: Record<string, any>;
}

export class ChordCollection<const Collections extends ChordCollectionOptions[] = []> {
	public constructor(
		public name: string,
		public channelId: string,
		public manager: Chord<Collections>,
	) {}

	public get rest() {
		return this.manager.rest;
	}

	public async findById<T extends Record<string, any>>(id: string): Promise<(T & { id: string }) | undefined> {
		try {
			const message = (await this.rest.get(Routes.channelMessage(this.channelId, id))) as APIMessage;

			const parsed = JSON.parse(message.content) as EncryptedResult;

			const decrypted = decrypt(parsed.ciphertext, {
				key: this.manager.options.key,
				iv: parsed.iv,
				authTag: parsed.authTag,
			});

			if (!decrypted) {
				return undefined;
			}

			const data = JSON.parse(decrypted);

			if (typeof data !== "object" || data === null || Array.isArray(data)) {
				throw new TypeError("Decrypted data is not an object");
			}

			delete (data as any).id;

			return { ...data, id };
		} catch {
			return undefined;
		}
	}

	public async updateById<T extends Record<string, any>>(
		id: string,
		update: UpdateOperators,
	): Promise<(T & { id: string }) | undefined> {
		const existing = await this.findById(id);

		if (!existing) {
			return;
		}

		if (!update.$set && !update.$inc && !update.$unset && !update.$push) {
			return existing as any;
		}

		const updated = ChordCollection.applyUpdate(existing as T, update);
		delete (updated as any).id;

		const encrypted = encrypt(JSON.stringify(updated), {
			key: this.manager.options.key,
			algorithm: this.manager.options.algorithm,
		});

		await this.rest.patch(Routes.channelMessage(this.channelId, id), {
			body: {
				content: JSON.stringify(encrypted),
			},
		});

		return { id, ...updated };
	}

	public async create<T extends Record<string, any>>(data: T): Promise<T & { id: string }> {
		const doc = structuredClone(data);

		delete (doc as any).id;

		const encrypted = encrypt(JSON.stringify(doc), {
			key: this.manager.options.key,
			algorithm: this.manager.options.algorithm,
		});

		const message = (await this.rest.post(Routes.channelMessages(this.channelId), {
			body: {
				content: JSON.stringify(encrypted),
			},
		})) as APIMessage;

		return { id: message.id, ...doc };
	}

	private static assertPathAllowed(path: string) {
		if (path === "id" || path.startsWith("id.")) {
			throw new Error(`Cannot update reserved field "id"`);
		}
	}

	private static applyUpdate<T extends Record<string, any>>(document: T, update: UpdateOperators): T {
		const next = structuredClone(document);

		if (update.$set) {
			for (const path in update.$set) {
				ChordCollection.assertPathAllowed(path);
				ChordCollection.setAtPath(next, path, update.$set[path]);
			}
		}

		if (update.$inc) {
			for (const path in update.$inc) {
				ChordCollection.assertPathAllowed(path);
				const prev = ChordCollection.getAtPath(next, path);

				if (prev !== undefined && typeof prev !== "number") {
					throw new TypeError(`Cannot $inc non-number field "${path}"`);
				}

				ChordCollection.setAtPath(next, path, (prev ?? 0) + update.$inc[path]!);
			}
		}

		if (update.$unset) {
			for (const path in update.$unset) {
				ChordCollection.assertPathAllowed(path);
				ChordCollection.deleteAtPath(next, path);
			}
		}

		if (update.$push) {
			for (const path in update.$push) {
				ChordCollection.assertPathAllowed(path);
				const arr = ChordCollection.getAtPath(next, path);

				if (!Array.isArray(arr)) {
					ChordCollection.setAtPath(next, path, [update.$push[path]]);
				} else {
					arr.push(update.$push[path]);
				}
			}
		}

		return next;
	}

	private static getAtPath(obj: any, path: string) {
		return path.split(".").reduce((acc, key) => acc?.[key], obj);
	}

	private static setAtPath(obj: any, path: string, value: any) {
		const keys = path.split(".");

		let curr = obj;
		for (let i = 0; i < keys.length - 1; i++) {
			const key = keys[i]!;

			if (typeof curr[key] !== "object" || curr[key] === null) {
				curr[key] = {};
			}

			curr = curr[key];
		}

		const key = keys.at(-1)!;

		if (key) {
			curr[key] = value;
		}
	}

	private static deleteAtPath(obj: any, path: string) {
		const keys = path.split(".");

		let curr = obj;
		for (let i = 0; i < keys.length - 1; i++) {
			curr = curr[keys[i]!];

			if (!curr) {
				return;
			}
		}

		const last = keys.at(-1);

		if (last) {
			delete curr[last];
		}
	}
}
