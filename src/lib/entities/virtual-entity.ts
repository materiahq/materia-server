import { App } from '../app';
import { Entity } from './entity';
import { CustomQuery } from './queries/custom';
import { Field } from './field';

export interface IVirtualEntityConfig {
	id: string
	x: number
	y: number
	fields?: Array<Field>
	relations?: Array<any>
	queries?: Array<any>
	isRelation?: any
	virtual: boolean
}

export class VirtualEntity extends Entity {
	reservedQueries = [
		'custom'
	];
	model: any;

	constructor(app: App) {
		super(app, {
			// get: GetHttpQuery,
			// post: PostHttpQuery,
			// put: PutHttpQuery,
			// patch: PatchHttpQuery,
			// delete: DeleteHttpQuery,
			custom: CustomQuery
		});
	}

	generateDefaultQueries() {
	}

	loadModel() {
		return Promise.resolve();
	}

	toJson(): IVirtualEntityConfig {
		const json: any = super.toJson();
		json.virtual = true;
		return json;
	}
}