"use strict";
import { CodeStreamSession } from "../session";
import { CSEntity } from "../shared/api.protocol";
import { KeyValue } from "./baseCache";
import { BaseManager } from "./baseManager";
import { EntityCache } from "./entityCache";

export type Id = string;

/**
 * Base class for entity managers.
 */
export abstract class EntityManager<T extends CSEntity> extends BaseManager<T> {
	protected readonly cache: EntityCache<T> = new EntityCache<T>(
		this.getIndexedFields(),
		this.fetch.bind(this)
	);

	public constructor(public session: CodeStreamSession) {
		super(session);
	}

	async getById(id: Id): Promise<T> {
		return this.cache.getById(id);
	}

	protected fetchCriteria(obj: T): KeyValue<T>[] {
		return [["id", obj.id]];
	}

	protected fetch(criteria: KeyValue<T>[]): Promise<T> {
		const [idCriteria] = criteria;
		const id = idCriteria[1] as Id;
		return this.fetchById(id);
	}

	protected abstract fetchById(id: Id): Promise<T>;
}
