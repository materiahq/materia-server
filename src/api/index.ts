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
import { WebsocketServers } from "../lib/websocket";

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
	get websocketServers(): WebsocketServers { return this.app.server.websocket; }

	constructor(private app: App) {
		this.oauth = new OAuth(this.app);
	}

	initialize() {
		const websocket = this.websocketServers.register('/materia/websocket', (info, cb) =>
			this.oauth.verifyToken(info.req.headers.access_token, cb)
		)

		this.databaseCtrl = new DatabaseController(this.app, websocket);
		this.filesCtrl = new FilesController(this.app, websocket);
		this.appCtrl = new AppController(this.app, websocket);
		this.gitCtrl = new GitController(this.app, websocket);
		this.endpointsCtrl = new EndpointsController(this.app, websocket);
		this.packageManagerCtrl = new PackageManagerController(this.app, websocket);
		this.addonsCtrl = new AddonsController(this.app, websocket);
		this.permissionsCtrl = new PermissionsController(this.app, websocket);
		this.boilerplateCtrl = new BoilerplateController(this.app, websocket);

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
		this.api.post('/materia/dependencies', this.oauth.isAuth, this.packageManagerCtrl.installAllcp.bind(this.packageManagerCtrl));
		this.api.post('/materia/dependencies/:dependency', this.oauth.isAuth, this.packageManagerCtrl.installcp.bind(this.packageManagerCtrl))
		this.api.post('/materia/dependencies/:owner/:dependency', this.oauth.isAuth, this.packageManagerCtrl.installcp.bind(this.packageManagerCtrl))
		this.api.put('/materia/dependencies/:dependency', this.oauth.isAuth, this.packageManagerCtrl.upgradecp.bind(this.packageManagerCtrl))
		this.api.put('/materia/dependencies/:owner/:dependency', this.oauth.isAuth, this.packageManagerCtrl.upgradecp.bind(this.packageManagerCtrl))
		this.api.delete('/materia/dependencies/:dependency', this.oauth.isAuth, this.packageManagerCtrl.uninstallcp.bind(this.packageManagerCtrl))
		this.api.delete('/materia/dependencies/:owner/:dependency', this.oauth.isAuth, this.packageManagerCtrl.uninstallcp.bind(this.packageManagerCtrl))
		this.api.post('/materia/tasks/:task', this.oauth.isAuth, this.packageManagerCtrl.runScript.bind(this.packageManagerCtrl))

		/**
		 * Files Endpoints
		 */
		this.api.get('/materia/is_directory/:path(.*)', this.oauth.isAuth, this.filesCtrl.isDirectory.bind(this.filesCtrl));
		this.api.get('/materia/files', this.oauth.isAuth, this.filesCtrl.read.bind(this.filesCtrl));
		// this.api.get('/materia/files/:path(.*)', this.oauth.isAuth, this.filesCtrl.read.bind(this.filesCtrl));
		this.api.post('/materia/files', this.oauth.isAuth, this.filesCtrl.write.bind(this.filesCtrl));
		this.api.put('/materia/files', this.oauth.isAuth, this.filesCtrl.move.bind(this.filesCtrl));
		this.api.delete('/materia/files', this.oauth.isAuth, this.filesCtrl.remove.bind(this.filesCtrl));

		/**
		 * GIT Endpoints
		 */
		this.api.get('/materia/git', this.oauth.isAuth, this.gitCtrl.load.bind(this.gitCtrl));
		this.api.post('/materia/git/init', this.oauth.isAuth, this.gitCtrl.init.bind(this.gitCtrl));
		this.api.post('/materia/git/fetch', this.oauth.isAuth, this.gitCtrl.fetch.bind(this.gitCtrl));
		// this.api.get('/materia/git/statuses', this.oauth.isAuth, this.gitCtrl..bind(this.gitCtrl));
		this.api.get('/materia/git/statuses', this.oauth.isAuth, this.gitCtrl.getStatus.bind(this.gitCtrl));
		this.api.post('/materia/git/stage', this.oauth.isAuth, this.gitCtrl.stage.bind(this.gitCtrl));
		this.api.delete('/materia/git/unstage', this.oauth.isAuth, this.gitCtrl.unstage.bind(this.gitCtrl));
		this.api.post('/materia/git/stage_all', this.oauth.isAuth, this.gitCtrl.stage.bind(this.gitCtrl));
		this.api.delete('/materia/git/unstage_all', this.oauth.isAuth, this.gitCtrl.unstage.bind(this.gitCtrl));
		this.api.post('/materia/git/commit', this.oauth.isAuth, this.gitCtrl.commit.bind(this.gitCtrl));
		this.api.post('/materia/git/pull', this.oauth.isAuth, this.gitCtrl.pull.bind(this.gitCtrl));
		this.api.post('/materia/git/push', this.oauth.isAuth, this.gitCtrl.push.bind(this.gitCtrl));
		this.api.get('/materia/git/history', this.oauth.isAuth, this.gitCtrl.getHistory.bind(this.gitCtrl));
		this.api.get('/materia/git/history/:hash', this.oauth.isAuth, this.gitCtrl.getCommit.bind(this.gitCtrl));
		// this.api.post('/materia/git/history/:sha/:path', this.oauth.isAuth, this.gitCtrl.getCommitDiff.bind(this.gitCtrl));
		// this.api.post('/materia/git/checkout/:branch', this.oauth.isAuth, this.gitCtrl.checkout.bind(this.gitCtrl));
		// this.api.post('/materia/git/merge/:branch', this.oauth.isAuth, this.gitCtrl.merge.bind(this.gitCtrl));

		/**
		 * Database & Entities Endpoints
		 */
		this.api.get('/materia/database/synchronize', this.oauth.isAuth, this.databaseCtrl.getDiffs.bind(this.databaseCtrl));
		this.api.post('/materia/database/synchronize', this.oauth.isAuth, this.databaseCtrl.sync.bind(this.databaseCtrl));
		this.api.post('/materia/database/try', this.oauth.isAuth, this.databaseCtrl.tryAuth.bind(this.databaseCtrl));
		this.api.post('/materia/entities', this.oauth.isAuth, this.databaseCtrl.createEntity.bind(this.databaseCtrl));
		this.api.delete('/materia/entities/:entity', this.oauth.isAuth, this.databaseCtrl.removeEntity.bind(this.databaseCtrl));
		this.api.put('/materia/entities/:entity', this.oauth.isAuth, this.databaseCtrl.renameEntity.bind(this.databaseCtrl));
		this.api.put('/materia/entities/:entity/position', this.oauth.isAuth, this.databaseCtrl.moveEntity.bind(this.databaseCtrl));
		// Fields
		this.api.post('/materia/entities/:entity/fields', this.oauth.isAuth, this.databaseCtrl.saveField.bind(this.databaseCtrl));
		this.api.delete('/materia/entities/:entity/fields/:field', this.oauth.isAuth, this.databaseCtrl.removeField.bind(this.databaseCtrl));
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
		this.api.get('/materia/controllers', this.oauth.isAuth, this.endpointsCtrl.getControllers.bind(this.endpointsCtrl));
		this.api.get('/materia/endpoints', this.oauth.isAuth, this.endpointsCtrl.getEndpoints.bind(this.endpointsCtrl));
		this.api.get('/materia/controllers/:name', this.oauth.isAuth, this.endpointsCtrl.loadController.bind(this.endpointsCtrl));
		this.api.post('/materia/endpoints/generate', this.oauth.isAuth, this.endpointsCtrl.generate.bind(this.endpointsCtrl));
		this.api.post('/materia/endpoints/code', this.oauth.isAuth, this.endpointsCtrl.createCode.bind(this.endpointsCtrl));
		this.api.post('/materia/endpoints/query', this.oauth.isAuth, this.endpointsCtrl.createQuery.bind(this.endpointsCtrl));
		this.api.put('/materia/endpoints/code', this.oauth.isAuth, this.endpointsCtrl.updateCode.bind(this.endpointsCtrl));
		this.api.put('/materia/endpoints/query', this.oauth.isAuth, this.endpointsCtrl.updateQuery.bind(this.endpointsCtrl));
		// Delete with id: btoa(endpoint.method + endpoint.url)
		this.api.delete('/materia/endpoints/:id', this.oauth.isAuth, this.endpointsCtrl.remove.bind(this.endpointsCtrl));

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
		this.api.post('/materia/addons/:owner/:pkg/setup', this.oauth.isAuth, this.addonsCtrl.setup.bind(this.addonsCtrl));

		this.api.post('/materia/addons/:pkg/enable', this.oauth.isAuth, this.addonsCtrl.enable.bind(this.addonsCtrl));
		this.api.post('/materia/addons/:owner/:pkg/enable', this.oauth.isAuth, this.addonsCtrl.enable.bind(this.addonsCtrl));

		this.api.post('/materia/addons/:pkg/disable', this.oauth.isAuth, this.addonsCtrl.disable.bind(this.addonsCtrl));
		this.api.post('/materia/addons/:owner/:pkg/disable', this.oauth.isAuth, this.addonsCtrl.disable.bind(this.addonsCtrl));

		/**
		 * Client Endpoints
		 */
		this.api.post('/materia/client/boilerplate/init', this.oauth.isAuth, this.boilerplateCtrl.initMinimal.bind(this.boilerplateCtrl));
		this.api.post('/materia/client/boilerplate/init/angular', this.oauth.isAuth, this.boilerplateCtrl.initAngular.bind(this.boilerplateCtrl));
		this.api.post('/materia/client/boilerplate/init/react', this.oauth.isAuth, this.boilerplateCtrl.initReact.bind(this.boilerplateCtrl));
		this.api.post('/materia/client/boilerplate/init/vuejs', this.oauth.isAuth, this.boilerplateCtrl.initVue.bind(this.boilerplateCtrl));

		this.api.all('/materia/*', this.oauth.isAuth, (req, res) => res.status(404).send());
	}
}