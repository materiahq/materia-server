import * as crypto from 'crypto';
import { IEntity } from '@materia/interfaces';

import { DBEntity } from '../../lib/entities/db-entity';
import { Entity } from '../../lib/entities/entity';
import { App } from '../../lib/app';

export class DatabaseLib {
	static entitySpacing = 20;

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
		return entities.map(entity => {
			const finalEntity = DatabaseLib.loadEntityJson(entity);
			if ( ! finalEntity.x && ! finalEntity.y ) {
				const ui = DatabaseLib.loadUi(app.path, entities, entity.name);
				finalEntity.x = isNaN(ui.x) || ui.x < 0 ? 0 : ui.x;
				finalEntity.y = isNaN(ui.y) || ui.y < 0 ? 0 : ui.y;
			}
			// const ui = this.loadUi(app.path, entities, entity.name);
			return finalEntity;
		});
	}
	private static entityWidth(entity) {
		return 200;
	}

	private static entityHeight(entity) {
		return 40 + 48 * entity.fields.length;
	}

	private static getWorkspaceSize(entities) {
		const workspaceSize = { width: 0, height: 0 };
		for (const i in entities) {
			if (entities[i].x != -1 && entities[i].y != -1) {
				const maxX = entities[i].x + DatabaseLib.entityWidth(entities[i]);
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
		const elemWidth = DatabaseLib.entityWidth(entity);
		const elemHeight = DatabaseLib.entityHeight(entity);
		for (const i in entities) {
			if (entities[i].x != -1 && entities[i].y != -1) {
				if (
					entities[i].x > pX - DatabaseLib.entityWidth(entities[i]) &&
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

	static loadUi(p, entities, entityName) {
		const ui = {
			x: -1,
			y: -1
		};

		const workspaceSize = DatabaseLib.getWorkspaceSize(entities);
		if (workspaceSize.height >= workspaceSize.width) {
			ui.y = 0;
			ui.x = workspaceSize.width + DatabaseLib.entitySpacing * 2;
		} else {
			let posX = 0;
			let posY = 1e10;
			for (const i in entities) {
				if (entities[i].x != -1 && entities[i].y != -1) {
					const pX = entities[i].x;
					const pY =
						entities[i].y + DatabaseLib.entityHeight(entities[i]);
					if (
						pY < posY &&
						DatabaseLib.isAvailableSpace(entities, entities[i], pX, pY)
					) {
						posX = pX;
						posY = pY;
					}
				}
			}
			ui.x = posX;
			if (posY > 1e9) {
				ui.y = 0;
			} else {
				ui.y = posY + DatabaseLib.entitySpacing * 2;
			}
		}

		return ui;
	}

}