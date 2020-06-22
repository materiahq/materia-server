import * as crypto from 'crypto';
import { IEntity } from '@materia/interfaces';

import { DBEntity } from '../../lib/entities/db-entity';
import { Entity } from '../../lib/entities/entity';
import { App } from '../../lib/app';

export class DatabaseLib {
	static entitySpacing = 20;
	static entityWidth = 200;

	static generateActionId({ stringBase = 'base64', byteLength = 8 } = {}): Promise<string> {
		return new Promise((resolve, reject) => {
			crypto.randomBytes(byteLength, (err, buffer) => {
				if (err) {
					reject(err);
				} else {
					resolve(buffer.toString(stringBase));
				}
			});
		});
	}

	static loadEntityJson(entity: DBEntity): IEntity {
		return Object.assign({}, entity.toJson(), {
			name: entity.name,
			x: entity.x,
			y: entity.y,
			fields: entity.fields.map(field => {
				return Object.assign({}, field.toJson(), {
					isRelation: field.isRelation
				});
			}),
			queries: entity.getQueries().map(query => {
				const q = query.toJson();
				q.opts.params = query.params;
				q.actions = entity.app.actions.findAll({
					entity: entity.name,
					query: q.id
				});
				return q;
			}),
			fromAddon: entity.fromAddon ? entity.fromAddon.toJson() : null,
			relatedEntities: entity
				.getRelatedEntities()
				.map((relatedEntity: Entity) => {
					return Object.assign({}, relatedEntity.toJson(), {
						name: relatedEntity.name,
						fields: relatedEntity.fields.map(field =>
							field.toJson()
						),
						queries: relatedEntity.getQueries().map(query => {
							const q = query.toJson();
							q.params = query.params;
							return q;
						})
					});
				}).filter(relatedEntity => relatedEntity && relatedEntity.name)
		});
	}

	static loadEntitiesJson(app: App): IEntity[] {
		const entities = app.entities.findAll();
		const entitiesJson = entities.map(entity => this.loadEntityJson(entity));
		return entitiesJson.map(finalEntity => {
			if ( ! finalEntity.x && ! finalEntity.y ) {
				DatabaseLib.loadUi(entitiesJson, finalEntity);
				finalEntity.x = isNaN(finalEntity.x) || finalEntity.x < 0 ? 0 : finalEntity.x;
				finalEntity.y = isNaN(finalEntity.y) || finalEntity.y < 0 ? 0 : finalEntity.y;
			}
			return finalEntity;
		});
	}
	private static entityHeight(entity) {
		return 40 + 48 * entity.fields.length;
	}

	private static getWorkspaceSize(entities) {
		const workspaceSize = { width: 0, height: 0 };
		for (const i in entities) {
			if (entities[i].x != -1 && entities[i].y != -1) {
				const maxX = entities[i].x + DatabaseLib.entityWidth;
				const maxY = entities[i].y + DatabaseLib.entityHeight(entities[i]);
				if (maxX > workspaceSize.width) {
					workspaceSize.width = maxX;
				}
				if (maxY > workspaceSize.height) {
					workspaceSize.height = maxY;
				}
			}
		}
		return workspaceSize;
	}

	static isAvailableSpace(entities, entity, pX, pY) {
		const elemWidth = DatabaseLib.entityWidth;
		const elemHeight = DatabaseLib.entityHeight(entity);
		for (const i in entities) {
			if (entities[i].x != -1 && entities[i].y != -1) {
				if (
					entities[i].x > pX - DatabaseLib.entityWidth &&
					entities[i].x < pX + elemWidth &&
					entities[i].y > pY - DatabaseLib.entityHeight(entities[i]) &&
					entities[i].y < pY + elemHeight
				) {
					return false;
				}
			}
		}
		return true;
	}

	// ui storage functions
	static loadUi(entities, entity) {

		entity.x = entity.x || -1;
		entity.y = entity.y || -1;

		if (entity.x == -1 || entity.y == -1) {
			let workspaceSize = DatabaseLib.getWorkspaceSize(entities);
			if (workspaceSize.height >= workspaceSize.width) {
				entity.y = 0;
				entity.x = workspaceSize.width + DatabaseLib.entitySpacing * 2;
			}
			else {
				let posX = 0;
				let posY = 1e10;
				for (let i in entities) {
					if ( entities[i] && entities[i].x != -1 && entities[i].y != -1 ) {
						let pX = entities[i].x;
						let pY = entities[i].y + DatabaseLib.entityHeight(entities[i]);
						if (pY < posY && DatabaseLib.isAvailableSpace(entities, entity, pX, pY)) {
							posX = pX;
							posY = pY;
						}
					}
				}
				entity.x = posX;
				if (posY > 1e9) {
					entity.y = 0;
				}
				else {
					entity.y = posY + DatabaseLib.entitySpacing * 2;
				}
			}
		}
	}
}