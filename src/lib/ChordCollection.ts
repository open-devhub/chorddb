import { Routes, type APIMessage } from "discord-api-types/v10";

import { decrypt, encrypt, type EncryptedResult } from "../utils/crypto.js";
import type { Chord, ChordCollectionOptions } from "./Chord.js";

export class ChordCollection<const Collections extends ChordCollectionOptions[] = []> {
	public constructor(
		public name: string,
		public channelId: string,
		public manager: Chord<Collections>,
	) {}

	public get rest() {
		return this.manager.rest;
	}

	public async findById(id: string) {
		try {
			const message = (await this.rest.get(Routes.channelMessage(this.channelId, id))) as APIMessage;
			const { ciphertext, iv, authTag }: EncryptedResult = JSON.parse(message.content);

			const data = decrypt(ciphertext, {
				key: this.manager.options.key,
				iv: iv,
				authTag: authTag,
			});

			if (!data) {
				return undefined;
			}

			return Object.assign(JSON.parse(data), { id });
		} catch {}

		return undefined;
	}

	public async create(data: any): Promise<any> {
		const encrypted = encrypt(JSON.stringify(data), {
			key: this.manager.options.key,
			algorithm: this.manager.options.algorithm,
		});

		const message = (await this.rest.post(Routes.channelMessages(this.channelId), {
			body: {
				content: JSON.stringify(encrypted),
			},
		})) as APIMessage;

		return Object.assign({ id: message.id }, data);
	}
}
