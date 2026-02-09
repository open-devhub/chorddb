import { Collection } from "@discordjs/collection";
import { Routes, type APIMessage } from "discord-api-types/v10";

import { decrypt, encrypt, type EncryptedResult } from "../utils/crypto.js";
import type { Chord, ChordCollectionOptions } from "./Chord.js";

export interface UpdateOperators {
	$set?: Record<string, any>;
	$inc?: Record<string, number>;
	$unset?: Record<string, true>;
	$push?: Record<string, any>;
}

export type FilterQuery<T> = Partial<T> | ((doc: T & { id: string }) => boolean);

export class ChordCollection<const Collections extends ChordCollectionOptions[] = []> {
	#messages = new Collection<string, APIMessage>();
	#documents = new Collection<string, any>();

	#bulkExhausted = false;
	#lastMessageId: string | undefined;

	public constructor(
		public name: string,
		public channelId: string,
		public manager: Chord<Collections>,
	) {}

	public get rest() {
		return this.manager.rest;
	}

	private get shouldCache() {
		return this.manager.isWrapped();
	}

	public async findById<T extends Record<string, any>>(id: string): Promise<(T & { id: string }) | undefined> {
		if (this.shouldCache && this.#documents.has(id)) {
			return this.#documents.get(id);
		}

		try {
			const message = (await this.rest.get(Routes.channelMessage(this.channelId, id))) as APIMessage;

			if (this.shouldCache) {
				this.#messages.set(id, message);
			}

			return this.decryptMessage<T>(message);
		} catch {
			return undefined;
		}
	}

	public async findAll<T extends Record<string, any>>(): Promise<Array<T & { id: string }>> {
		const results: Array<T & { id: string }> = [];

		await this.lazyFetch(async (messages) => {
			for (const msg of messages) {
				const data = await this.decryptMessage<T>(msg);

				if (!data) {
					continue;
				}

				results.push(data);
			}

			return true;
		});

		return results;
	}

	public async findBy<T extends Record<string, any>>(filter: FilterQuery<T>): Promise<Array<T & { id: string }>> {
		const results: Array<T & { id: string }> = [];

		await this.lazyFetch(async (messages) => {
			for (const msg of messages) {
				const data = await this.decryptMessage<T>(msg);

				if (!data) {
					continue;
				}

				if (ChordCollection.matchFilter(data, filter)) {
					results.push(data);
				}
			}

			return true;
		});

		return results;
	}

	public async findFirst<T extends Record<string, any>>(
		filter: FilterQuery<T>,
	): Promise<(T & { id: string }) | undefined> {
		let result: (T & { id: string }) | undefined;

		await this.lazyFetch(async (messages) => {
			for (const msg of messages) {
				const data = await this.decryptMessage<T>(msg);

				if (!data) {
					continue;
				}

				if (ChordCollection.matchFilter(data, filter)) {
					result = data;
					return false;
				}
			}

			return true;
		});

		return result;
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

		const message = await this.rest.patch(Routes.channelMessage(this.channelId, id), {
			body: {
				content: JSON.stringify(encrypted),
			},
		});

		if (this.shouldCache) {
			this.#messages.set(id, message as APIMessage);
			this.#documents.set(id, updated);
		}

		return { id, ...updated };
	}

	public async updateBy<T extends Record<string, any>>(
		filter: FilterQuery<T>,
		update: UpdateOperators,
	): Promise<Array<T & { id: string }>> {
		const docs = await this.findBy(filter);
		const updated: Array<T & { id: string }> = [];

		for (const doc of docs) {
			const result = await this.updateById<T>(doc.id, update);

			if (result) {
				updated.push(result);
			}
		}

		return updated;
	}

	public async updateAll<T extends Record<string, any>>(update: UpdateOperators): Promise<Array<T & { id: string }>> {
		return this.updateBy(() => true, update);
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

		if (this.shouldCache) {
			this.#messages.set(message.id, message);
			this.#documents.set(message.id, doc);
		}

		return { id: message.id, ...doc };
	}

	public async deleteById(id: string): Promise<boolean> {
		try {
			await this.rest.delete(Routes.channelMessage(this.channelId, id));
			this.#messages.delete(id);
			this.#documents.delete(id);
			return true;
		} catch {
			return false;
		}
	}

	public async deleteBy<T extends Record<string, any>>(filter: FilterQuery<T>): Promise<number> {
		const docs = await this.findBy(filter);
		let count = 0;

		for (const doc of docs) {
			const success = await this.deleteById(doc.id);

			if (success) {
				count++;
			}
		}

		return count;
	}

	public async deleteAll(): Promise<number> {
		const docs = await this.findAll();
		let count = 0;

		for (const doc of docs) {
			const success = await this.deleteById(doc.id);

			if (success) {
				count++;
			}
		}

		return count;
	}

	private decryptMessage<T extends Record<string, any>>(message: APIMessage): (T & { id: string }) | undefined {
		if (this.shouldCache && this.#documents.has(message.id)) {
			return this.#documents.get(message.id);
		}

		let parsed: EncryptedResult;

		try {
			parsed = JSON.parse(message.content);
		} catch {
			return undefined;
		}

		if (
			!parsed ||
			typeof parsed !== "object" ||
			typeof parsed.ciphertext !== "string" ||
			typeof parsed.iv !== "string" ||
			typeof parsed.authTag !== "string"
		) {
			return undefined;
		}

		const decrypted = decrypt(parsed.ciphertext, {
			key: this.manager.options.key,
			iv: parsed.iv,
			authTag: parsed.authTag,
		});

		if (!decrypted) {
			return undefined;
		}

		let data;

		try {
			data = JSON.parse(decrypted);
		} catch {
			return undefined;
		}

		if (typeof data !== "object" || data === null || Array.isArray(data)) {
			return undefined;
		}

		delete data.id;

		const result = { id: message.id, ...data };

		if (this.shouldCache) {
			this.#documents.set(message.id, result);
		}

		return result;
	}

	private async fetchNextPage(limit = 100, before?: string) {
		const query = new URLSearchParams();
		query.append("limit", limit.toString());

		if (before) {
			query.append("before", before);
		}

		return (await this.rest.get(Routes.channelMessages(this.channelId), { query })) as APIMessage[];
	}

	private async lazyFetch(fn: (messages: APIMessage[]) => Awaitable<boolean>, limit = 100) {
		if (this.shouldCache && this.#messages.size > 0) {
			const shouldStop = await fn([...this.#messages.values()]);

			if (shouldStop) {
				return;
			}
		}

		let exhausted = this.#bulkExhausted;
		let lastMessageId: string | undefined = this.#lastMessageId;

		while (!exhausted) {
			const messages = await this.fetchNextPage(limit, lastMessageId);

			if (messages.length < limit) {
				exhausted = true;
			}

			if (!messages.length) {
				return;
			}

			lastMessageId = messages.at(-1)!.id;

			if (this.shouldCache) {
				for (const message of messages) {
					this.#messages.set(message.id, message);
				}
			}

			const shouldStop = await fn(messages);

			if (shouldStop) {
				return;
			}
		}

		if (this.shouldCache) {
			this.#bulkExhausted = exhausted;
			this.#lastMessageId = lastMessageId;
		}
	}

	protected updateMessage(id: string, newMessage: APIMessage) {
		if (!this.shouldCache) {
			throw new Error("Cache mode is not enabled");
		}

		const decrypted = this.decryptMessage(newMessage);

		if (!decrypted) {
			this.#messages.delete(id);
			this.#documents.delete(id);
			return;
		}

		this.#messages.set(id, newMessage);
		this.#documents.set(id, decrypted);
	}

	protected deleteMessage(id: string) {
		if (!this.shouldCache) {
			throw new Error("Cache mode is not enabled");
		}

		this.#messages.delete(id);
		this.#documents.delete(id);
	}

	private static assertPathAllowed(path: string) {
		if (path === "id" || path.startsWith("id.")) {
			throw new Error(`Cannot update reserved field "id"`);
		}
	}

	private static matchFilter<T extends Record<string, any>>(
		document: T & { id: string },
		filter: FilterQuery<T>,
	): boolean {
		if (typeof filter === "function") {
			return filter(document);
		}

		for (const [key, value] of Object.entries(filter)) {
			const docValue = ChordCollection.getAtPath(document, key);

			if (docValue !== value) {
				return false;
			}
		}

		return true;
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
