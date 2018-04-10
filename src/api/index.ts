import { App } from "../lib";
import { OAuth } from "./oauth";

import { Application as ExpressApplication } from 'express';

import { FilesController } from "./controllers/files.ctrl";
import { DatabaseController } from "./controllers/database.ctrl";
import { AppController } from "./controllers/app.ctrl";
import { GitController } from "./controllers/git.ctrl";
import { EndpointsController } from "./controllers/endpoints.ctrl";
import { PackageManagerController } from "./controllers/package-manager.ctrl";
import { AddonsController } from "./controllers/addons.ctrl";
import { PermissionsController } from "./controllers/permissions.ctrl";
import { BoilerplateController } from "./controllers/boilerplate.ctrl";

export class MateriaApi {
	oauth: OAuth

	databaseCtrl: DatabaseController
	filesCtrl: FilesController
	appCtrl: AppController
	gitCtrl: GitController
	endpointsCtrl: EndpointsController
	packageManagerCtrl: PackageManagerController
	addonsCtrl: AddonsController
	permissionsCtrl: PermissionsController
	boilerplateCtrl: BoilerplateController

	get api(): ExpressApplication { return this.app.server.expressApp; }

	constructor(private app: App) {
		this.oauth = new OAuth(this.app);
		this.databaseCtrl = new DatabaseController(this.app);
		this.filesCtrl = new FilesController(this.app);
		this.appCtrl = new AppController(this.app);
		this.gitCtrl = new GitController(this.app);
		this.endpointsCtrl = new EndpointsController(this.app);
		this.packageManagerCtrl = new PackageManagerController(this.app);
		this.addonsCtrl = new AddonsController(this.app);
		this.permissionsCtrl = new PermissionsController(this.app);
		this.boilerplateCtrl = new BoilerplateController(this.app);
	}

	checkParams() {

		return (req, res, next) => {

		}
	}

	initialize() {
		this.oauth.initialize()

		/**
		 * App Endpoints
		 */
		this.api.post('/materia/token', this.oauth.token);
		this.api.post('/materia/restart', this.oauth.isAuth, this.appCtrl.restart.bind(this.appCtrl));
		this.api.get('/materia/infos/minimal', this.oauth.isAuth, this.appCtrl.getInfos.bind(this.appCtrl));
		this.api.get('/materia/infos', this.oauth.isAuth, this.appCtrl.getInfos.bind(this.appCtrl));
		this.api.post('/materia/config', this.oauth.isAuth, this.appCtrl.config.bind(this.appCtrl));
		this.api.post('/materia/search', this.oauth.isAuth, this.appCtrl.search.bind(this.appCtrl));

		/**
		 * PackageManager Endpoints
		 */
		this.api.post('/materia/dependencies', this.oauth.isAuth, this.packageManagerCtrl.installAll.bind(this.packageManagerCtrl));
		this.api.post('/materia/dependencies/:dependency', this.oauth.isAuth, this.packageManagerCtrl.install.bind(this.packageManagerCtrl))
		this.api.put('/materia/dependencies/:dependency', this.oauth.isAuth, this.packageManagerCtrl.upgrade.bind(this.packageManagerCtrl))
		this.api.delete('/materia/dependencies/:dependency', this.oauth.isAuth, this.packageManagerCtrl.uninstall.bind(this.packageManagerCtrl))
		this.api.post('/materia/tasks/:task', this.oauth.isAuth, this.packageManagerCtrl.runScript.bind(this.packageManagerCtrl))

		/**
		 * Files Endpoints
		 */
		this.api.get('/materia/is_directory', this.oauth.isAuth, this.filesCtrl.isDirectory.bind(this.filesCtrl));
		this.api.get('/materia/files', this.oauth.isAuth, this.filesCtrl.read.bind(this.filesCtrl));
		this.api.post('/materia/files', this.oauth.isAuth, this.filesCtrl.write.bind(this.filesCtrl));
		this.api.put('/materia/files', this.oauth.isAuth, this.filesCtrl.move.bind(this.filesCtrl));
		this.api.delete('/materia/files', this.oauth.isAuth, this.filesCtrl.remove.bind(this.filesCtrl));

		/**
		 * GIT Endpoints
		 */
		this.api.post('/materia/git/init', this.oauth.isAuth, this.gitCtrl.init.bind(this.gitCtrl));
		this.api.post('/materia/git/fetch', this.oauth.isAuth, this.gitCtrl.fetch.bind(this.gitCtrl));
		this.api.get('/materia/git/statuses', this.oauth.isAuth, this.gitCtrl.getStatuses.bind(this.gitCtrl));
		this.api.get('/materia/git/statuses/:path', this.oauth.isAuth, this.gitCtrl.getStatus.bind(this.gitCtrl));
		this.api.post('/materia/git/statuses', this.oauth.isAuth, this.gitCtrl.stageAll.bind(this.gitCtrl));
		this.api.post('/materia/git/statuses/:path', this.oauth.isAuth, this.gitCtrl.stage.bind(this.gitCtrl));
		this.api.delete('/materia/git/statuses', this.oauth.isAuth, this.gitCtrl.unstageAll.bind(this.gitCtrl));
		this.api.delete('/materia/git/statuses/:path', this.oauth.isAuth, this.gitCtrl.unstage.bind(this.gitCtrl));
		this.api.post('/materia/git/commit', this.oauth.isAuth, this.gitCtrl.commit.bind(this.gitCtrl));
		this.api.post('/materia/git/pull', this.oauth.isAuth, this.gitCtrl.pull.bind(this.gitCtrl));
		this.api.post('/materia/git/push', this.oauth.isAuth, this.gitCtrl.push.bind(this.gitCtrl));
		this.api.post('/materia/git/history', this.oauth.isAuth, this.gitCtrl.getHistory.bind(this.gitCtrl));
		this.api.post('/materia/git/history/:sha', this.oauth.isAuth, this.gitCtrl.getCommit.bind(this.gitCtrl));
		this.api.post('/materia/git/history/:sha/:path', this.oauth.isAuth, this.gitCtrl.getCommitDiff.bind(this.gitCtrl));
		this.api.post('/materia/git/checkout/:branch', this.oauth.isAuth, this.gitCtrl.checkout.bind(this.gitCtrl));
		this.api.post('/materia/git/merge/:branch', this.oauth.isAuth, this.gitCtrl.merge.bind(this.gitCtrl));

		/**
		 * Database & Entities Endpoints
		 */
		this.api.post('/materia/database/try', this.oauth.isAuth, this.databaseCtrl.tryAuth.bind(this.databaseCtrl));
		this.api.post('/materia/entities', this.oauth.isAuth, this.databaseCtrl.createEntity.bind(this.databaseCtrl));
		this.api.delete('/materia/entities/:entity', this.oauth.isAuth, this.databaseCtrl.removeEntity.bind(this.databaseCtrl));
		this.api.put('/materia/entities/:entity', this.oauth.isAuth, this.databaseCtrl.renameEntity.bind(this.databaseCtrl));
		this.api.put('/materia/entities/:entity/position', this.oauth.isAuth, this.databaseCtrl.moveEntity.bind(this.databaseCtrl));
		// Fields
		this.api.post('/materia/entities/:entity/fields', this.oauth.isAuth, this.databaseCtrl.saveField.bind(this.databaseCtrl));
		this.api.delete('/materia/entities/:entities/fields/:field', this.oauth.isAuth, this.databaseCtrl.removeField.bind(this.databaseCtrl));
		// Queries
		this.api.get('/materia/models/:model', this.oauth.isAuth, this.databaseCtrl.loadModel.bind(this.databaseCtrl));
		this.api.post('/materia/entities/:entity/queries', this.oauth.isAuth, this.databaseCtrl.createQuery.bind(this.databaseCtrl));
		this.api.delete('/materia/entities/:entity/queries/:queryId', this.oauth.isAuth, this.databaseCtrl.removeQuery.bind(this.databaseCtrl));
		this.api.post('/materia/entities/:entity/queries/:queryId', this.oauth.isAuth, this.databaseCtrl.runQuery.bind(this.databaseCtrl));
		this.api.post('/materia/sql', this.oauth.isAuth, this.databaseCtrl.runSql.bind(this.databaseCtrl));
		// Relations
		this.api.post('/materia/entities/:entity/relations', this.oauth.isAuth, this.databaseCtrl.createRelation.bind(this.databaseCtrl));
		this.api.delete('/materia/entities/:entity/relations', this.oauth.isAuth, this.databaseCtrl.removeRelation.bind(this.databaseCtrl));

		/**
		 * API Endpoints
		 */
		this.api.get('/materia/controllers/:controllerName', this.oauth.isAuth, this.endpointsCtrl.createCode.bind(this.endpointsCtrl));
		this.api.post('/materia/endpoints/code', this.oauth.isAuth, this.endpointsCtrl.createCode.bind(this.endpointsCtrl));
		this.api.post('/materia/endpoints/query', this.oauth.isAuth, this.endpointsCtrl.createQuery.bind(this.endpointsCtrl));
		this.api.put('/materia/endpoints/code/:method/:endpoint', this.oauth.isAuth, this.endpointsCtrl.updateCode.bind(this.endpointsCtrl));
		this.api.put('/materia/endpoints/query/:method/:endpoint', this.oauth.isAuth, this.endpointsCtrl.updateQuery.bind(this.endpointsCtrl));
		this.api.delete('/materia/endpoints/:method/:endpoint', this.oauth.isAuth, this.endpointsCtrl.remove.bind(this.endpointsCtrl));

		/**
		 * Permissions Endpoints
		 */
		this.api.get('/materia/permissions', this.oauth.isAuth, this.permissionsCtrl.list.bind(this.permissionsCtrl));
		this.api.post('/materia/permissions/new', this.oauth.isAuth, this.permissionsCtrl.initCreate.bind(this.permissionsCtrl));
		this.api.post('/materia/permissions', this.oauth.isAuth, this.permissionsCtrl.save.bind(this.permissionsCtrl));
		this.api.put('/materia/permissions/:permission', this.oauth.isAuth, this.permissionsCtrl.update.bind(this.permissionsCtrl));
		this.api.delete('/materia/permissions/:permission', this.oauth.isAuth, this.permissionsCtrl.remove.bind(this.permissionsCtrl));

		/**
		 * Addon Endpoints
		 */
		this.api.post('/materia/addons/:pkg/setup', this.oauth.isAuth, this.addonsCtrl.setup.bind(this.addonsCtrl));

		/**
		 * Client Endpoints
		 */
		this.api.post('/materia/client/boilerplate/init', this.oauth.isAuth, this.boilerplateCtrl.initMinimal.bind(this.boilerplateCtrl));
		this.api.post('/materia/client/boilerplate/init/angular', this.oauth.isAuth, this.boilerplateCtrl.initAngular.bind(this.addonsCtrl));
		this.api.post('/materia/client/boilerplate/init/react', this.oauth.isAuth, this.boilerplateCtrl.initReact.bind(this.addonsCtrl));
		this.api.post('/materia/client/boilerplate/init/vuejs', this.oauth.isAuth, this.boilerplateCtrl.initVue.bind(this.addonsCtrl));
	}
}

/*
POST /auth

GET /apps                                        materiaServer.initialize()
POST /apps/:id/selected                            materiaServer.selectApp(id)
    => return a socket.io channel
    => automatically load and start

GET /app/selected                                materiaServer.toJson(materiaServer.getSelectedApp())

POST /server/start
POST /server/stop
POST /server/restart                            materiaServer.restartServer()

POST /client/build
    => return a socket.io channel (the same than the watch)
POST /client/watch/start
    => return a socket.io channel
POST /client/watch/stop


-----

POST /database/try                                materiaServer.tryDatabaseConnect(conf)

GET /entities                                    materiaServer.loadEntityJson(app);
POST /entities                                    materiaServer.createEntity(entity: IEntity)
PUT /entities/:name                                materiaServer.renameEntity(name: string, newName: string)
DELETE /entities/:name                            materiaServer.removeEntity(name: string)

PUT /entities/:name/fields                        materiaServer.saveField(name: string, field: IField)
DELETE /entities/:name/fields/:fieldName        materiaServer.removeField(name: string, fieldName: string)

POST /entities/relations                        !! materiaServer.addRelations(payload)
DELETE /entities/relations                        !! materiaServer.removeRelation(payload)

POST /entities/:name/queries/:id/run            query.runQuery(name, id, params)
POST /entities/:name/queries                    query.addQuery(query)
PUT /entities/:name/queries/:id                    !! query.updateQuery(queries, selected)
DELETE /entities/:name/queries/:id                query.deleteQuery(id, name)
POST /playground                                query.runPlaygroundQuery(query)

GET /addons/:pkg/settings                        ?? get settings / path of the addons
POST /addons/:pkg/install                        ## addon.install()
POST /addons/:pkg/setup                            ## addon.setup()
PUT /addons/:pkg/upgrade                        ## addon.upgrade()
DELETE /addons/:pkg/uninstall                    ## addon.uninstall()

POST /entities/:name/generate-endpoint            materiaServer.generateEdnpointsForCurrentApp(entity)

GET /api                                        materiaServer.getEndpoints
GET /api/controllers/:controller                endpoint.loadEndpointCode(controller)
POST /api                                        !! endpoint.addEndpointCode(payload) & endpoint.addEndpointQuery(payload)
DELETE /api/:method/:endpoint                    !! endpoint.deleteEndpoint(payload)
PUT /api/:method/:endpoint                        !! endpoint.updateEndpointCode(payload) & endpoint.updateEndpointQuery(payload)
POST /api/:method/:endpoint/run                    !! endpoint.runEndpoint(payload)

GET /api/models/:name                            materiaServer.getModelCode(name: string)
GET /api/models/:addonPath/:name                materiaServer.getModelCode(name: string, fromAddon.path)

GET /api/permissions                            permission.getPermissions()
POST /api/permissions                            permission.addPermission(perm)
PUT /api/permissions/:name                        !! permission.updatePermission(payload)
DELETE /api/permission/:name                    !! deletePermission(payload)
*/