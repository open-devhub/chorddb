import { REST } from "@discordjs/rest";
import { Collection } from "@discordjs/collection";
import { GatewayOpcodes, type GatewayReceivePayload } from "discord-api-types/v10";

import { ChordCollection } from "./ChordCollection.js";
import { DEFAULT_ALGORITHM } from "../utils/crypto.js";

import type { CipherGCMTypes } from "node:crypto";

export interface ChordOptions<Collections extends ChordCollectionOptions[] = []> {
	token: string;
	collections: Collections;
	key: Buffer;
	algorithm?: CipherGCMTypes;
}

export interface ChordCollectionOptions<Name extends string = string> {
	name: Name;
	channelId: string;
}

type CollectionNames<Collections extends ChordCollectionOptions[]> =
	Collections[number] extends ChordCollectionOptions<infer N> ? N : never;

export class Chord<const Collections extends ChordCollectionOptions[] = []> {
	public rest: REST;
	public collections = new Collection<CollectionNames<Collections>, ChordCollection<Collections>>();

	public options: Required<ChordOptions<Collections>>;

	public constructor(options: ChordOptions<Collections>) {
		this.options = {
			token: options.token,
			collections: options.collections,
			key: options.key,
			algorithm: options.algorithm || DEFAULT_ALGORITHM,
		};

		this.rest = new REST().setToken(options.token);
	}

	public collect(name: CollectionNames<Collections>) {
		let collection = this.collections.get(name);

		if (collection) {
			return collection;
		}

		const options = this.options.collections?.find((c) => c.name === name);

		if (!options) {
			throw new Error(`Collection ${name} not found`);
		}

		collection = new ChordCollection(name, options.channelId, this);
		this.collections.set(name, collection);

		return collection;
	}

	public collectById(id: string) {
		const options = this.options.collections?.find((c) => c.channelId === id);

		if (!options) {
			throw new Error(`Collection with id ${id} not found`);
		}

		return this.collect(options.name as CollectionNames<Collections>);
	}

	public updateGatewayPayload(payload: GatewayReceivePayload) {
		if (payload.op !== GatewayOpcodes.Dispatch) {
			return;
		}

		// TODO: add message validation
	}
}
