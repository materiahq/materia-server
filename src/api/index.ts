import { App, AppMode } from '../lib/app';
import { OAuth } from './oauth';

import { Application as ExpressApplication } from 'express';

import { FilesController } from './controllers/files.ctrl';
import { DatabaseController } from './controllers/database.ctrl';
import { AppController } from './controllers/app.ctrl';
import { GitController } from './controllers/git.ctrl';
import { ClientController } from './controllers/client.ctrl';
import { EndpointsController } from './controllers/endpoints.ctrl';
import { PackageManagerController } from './controllers/package-manager.ctrl';
import { AddonsController } from './controllers/addons.ctrl';
import { PermissionsController } from './controllers/permissions.ctrl';
import { BoilerplateController } from './controllers/boilerplate.ctrl';
import { WebsocketServers, WebsocketInstance } from '../lib/websocket';

export class MateriaApi {
	oauth: OAuth;
	websocket: WebsocketInstance | {
		instance: any;
		broadcast: (data) => any;
	};

	databaseCtrl: DatabaseController;
	filesCtrl: FilesController;
	appCtrl: AppController;
	gitCtrl: GitController;
	endpointsCtrl: EndpointsController;
	packageManagerCtrl: PackageManagerController;
	addonsCtrl: AddonsController;
	permissionsCtrl: PermissionsController;
	boilerplateCtrl: BoilerplateController;
	clientCtrl: ClientController;

	get api(): ExpressApplication { return this.app.server.expressApp; }
	get websocketServers(): WebsocketServers { return this.app.server.websocket; }

	constructor(private app: App) {
		this.oauth = new OAuth(this.app);
	}

	initialize() {
		if (this.app.mode === AppMode.PRODUCTION && ! this.app.rootPassword ) {
			this.websocket = {
				broadcast: (data) => {},
				instance: {}
			};
			return false;
		}
		this.websocket = this.websocketServers.register('/materia/websocket', (info, cb) => {
			if ( ! this.app.rootPassword) {
				return cb(true);
			}
			return this.oauth.verifyToken(info.req.url.split('?token=')[1], (err, authorized) => {
				return cb(authorized);
			});
		});

		this.databaseCtrl = new DatabaseController(this.app, this.websocket);
		this.filesCtrl = new FilesController(this.app, this.websocket);
		this.appCtrl = new AppController(this.app, this.websocket);
		this.gitCtrl = new GitController(this.app, this.websocket);
		this.endpointsCtrl = new EndpointsController(this.app, this.websocket);
		this.packageManagerCtrl = new PackageManagerController(this.app, this.websocket);
		this.addonsCtrl = new AddonsController(this.app, this.websocket);
		this.permissionsCtrl = new PermissionsController(this.app, this.websocket);
		this.boilerplateCtrl = new BoilerplateController(this.app, this.websocket);
		this.clientCtrl = new ClientController(this.app, this.websocket);

		this.oauth.initialize();

		/**
		 * App Endpoints
		 */
		this.api.post('/materia/token', this.oauth.token);
		this.api.post('/materia/docker', this.oauth.isAuth, this.appCtrl.createDockerfile.bind(this.appCtrl));

		this.api.post('/materia/restart', this.oauth.isAuth, this.appCtrl.restart.bind(this.appCtrl));
		this.api.get('/materia/infos/minimal', this.oauth.isAuth, this.appCtrl.getInfos.bind(this.appCtrl));
		this.api.get('/materia/infos', this.oauth.isAuth, this.appCtrl.getInfos.bind(this.appCtrl));
		this.api.post('/materia/config', this.oauth.isAuth, this.appCtrl.config.bind(this.appCtrl));
		this.api.delete('/materia/config', this.oauth.isAuth, this.appCtrl.deleteConfig.bind(this.appCtrl));
		this.api.post('/materia/search', this.oauth.isAuth, this.appCtrl.search.bind(this.appCtrl));

		/**
		 * PackageManager Endpoints
		 */
		this.api.post('/materia/dependencies', this.oauth.isAuth, this.packageManagerCtrl.installAll.bind(this.packageManagerCtrl));
		this.api.post('/materia/dependencies/:dependency*', this.oauth.isAuth, this.packageManagerCtrl.install.bind(this.packageManagerCtrl));
		this.api.put('/materia/dependencies/:dependency*', this.oauth.isAuth, this.packageManagerCtrl.upgrade.bind(this.packageManagerCtrl));
		this.api.delete('/materia/dependencies/:dependency*', this.oauth.isAuth, this.packageManagerCtrl.uninstall.bind(this.packageManagerCtrl));

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
		this.api.get('/materia/git/history/:hash/file', this.oauth.isAuth, this.gitCtrl.getHistoryFileDetail.bind(this.gitCtrl));

		this.api.put('/materia/git/branches', this.oauth.isAuth, this.gitCtrl.selectBranch.bind(this.gitCtrl));
		this.api.post('/materia/git/branches', this.oauth.isAuth, this.gitCtrl.newBranch.bind(this.gitCtrl));
		this.api.post('/materia/git/stash', this.oauth.isAuth, this.gitCtrl.stash.bind(this.gitCtrl));
		this.api.post('/materia/git/stash/pop', this.oauth.isAuth, this.gitCtrl.stashPop.bind(this.gitCtrl));
		// this.api.post('/materia/git/history/:sha/:path', this.oauth.isAuth, this.gitCtrl.getCommitDiff.bind(this.gitCtrl));
		// this.api.post('/materia/git/checkout/:branch', this.oauth.isAuth, this.gitCtrl.checkout.bind(this.gitCtrl));
		// this.api.post('/materia/git/merge/:branch', this.oauth.isAuth, this.gitCtrl.merge.bind(this.gitCtrl));

		/**
		 * Database & Entities Endpoints
		 */
		this.api.get('/materia/database/synchronize', this.oauth.isAuth, this.databaseCtrl.getDiffs.bind(this.databaseCtrl));
		this.api.post('/materia/database/synchronize', this.oauth.isAuth, this.databaseCtrl.sync.bind(this.databaseCtrl));
		this.api.post('/materia/database/try', this.oauth.isAuth, this.databaseCtrl.tryAuth.bind(this.databaseCtrl));

		this.api.get('/materia/entities', this.oauth.isAuth, this.databaseCtrl.getEntities.bind(this.databaseCtrl));
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
		this.api.get('/materia/entities/relations', this.oauth.isAuth, this.databaseCtrl.getRelations.bind(this.databaseCtrl));
		this.api.post('/materia/entities/relations', this.oauth.isAuth, this.databaseCtrl.createRelation.bind(this.databaseCtrl));
		this.api.delete(
			'/materia/entities/:entity/relations/:type/:relationFieldOrEntity',
			this.oauth.isAuth,
			this.databaseCtrl.removeRelation.bind(this.databaseCtrl)
		);

		// Actions
		this.api.get('/materia/actions', this.oauth.isAuth, this.databaseCtrl.listActions.bind(this.databaseCtrl));
		this.api.post('/materia/actions', this.oauth.isAuth, this.databaseCtrl.addAction.bind(this.databaseCtrl));
		this.api.put('/materia/actions/:id*', this.oauth.isAuth, this.databaseCtrl.updateAction.bind(this.databaseCtrl));
		this.api.delete('/materia/actions/:id*', this.oauth.isAuth, this.databaseCtrl.removeAction.bind(this.databaseCtrl));


		/**
		 * API Endpoints
		 */
		this.api.get('/materia/endpoints', this.oauth.isAuth, this.endpointsCtrl.getEndpoints.bind(this.endpointsCtrl));
		this.api.post('/materia/endpoints/generate', this.oauth.isAuth, this.endpointsCtrl.generate.bind(this.endpointsCtrl));
		this.api.post('/materia/endpoints', this.oauth.isAuth, this.endpointsCtrl.add.bind(this.endpointsCtrl));
		this.api.put('/materia/endpoints', this.oauth.isAuth, this.endpointsCtrl.update.bind(this.endpointsCtrl));
		// Delete with id: btoa(endpoint.method + endpoint.url)
		this.api.delete('/materia/endpoints/:id', this.oauth.isAuth, this.endpointsCtrl.remove.bind(this.endpointsCtrl));

		/**
		 * Endpoints Controllers
		 */
		this.api.get('/materia/controllers', this.oauth.isAuth, this.endpointsCtrl.getControllers.bind(this.endpointsCtrl));
		this.api.get('/materia/controllers/:name*', this.oauth.isAuth, this.endpointsCtrl.loadController.bind(this.endpointsCtrl));
		/**
		 * Endpoints Permissions
		 */
		this.api.get('/materia/permissions', this.oauth.isAuth, this.permissionsCtrl.list.bind(this.permissionsCtrl));
		this.api.get('/materia/permissions/:permission', this.oauth.isAuth, this.permissionsCtrl.get.bind(this.permissionsCtrl));
		this.api.post('/materia/permissions', this.oauth.isAuth, this.permissionsCtrl.add.bind(this.permissionsCtrl));
		this.api.put('/materia/permissions/:permission', this.oauth.isAuth, this.permissionsCtrl.update.bind(this.permissionsCtrl));
		this.api.delete('/materia/permissions/:permission', this.oauth.isAuth, this.permissionsCtrl.remove.bind(this.permissionsCtrl));

		/**
		 * Addon Endpoints
		 */
		this.api.get('/materia/addons/:pkg*/bundle.js', this.addonsCtrl.bundle.bind(this.addonsCtrl));
		this.api.get('/materia/addons/:pkg*/setup', this.oauth.isAuth, this.addonsCtrl.getConfig.bind(this.addonsCtrl));
		this.api.post('/materia/addons/:pkg*/setup', this.oauth.isAuth, this.addonsCtrl.setup.bind(this.addonsCtrl));
		this.api.post('/materia/addons/:pkg*/enable', this.oauth.isAuth, this.addonsCtrl.enable.bind(this.addonsCtrl));
		this.api.post('/materia/addons/:pkg*/disable', this.oauth.isAuth, this.addonsCtrl.disable.bind(this.addonsCtrl));

		/**
		 * Client Endpoints
		 */
		this.api.post('/materia/client/build', this.oauth.isAuth, this.clientCtrl.build.bind(this.clientCtrl));
		this.api.post('/materia/client/watch/start', this.oauth.isAuth, this.clientCtrl.startWatching.bind(this.clientCtrl));
		this.api.post('/materia/client/watch/stop', this.oauth.isAuth, this.clientCtrl.stopWatching.bind(this.clientCtrl));
		this.api.post('/materia/client/boilerplate/init', this.oauth.isAuth, this.boilerplateCtrl.initMinimal.bind(this.boilerplateCtrl));
		this.api.post(
			'/materia/client/boilerplate/init/:framework',
			this.oauth.isAuth,
			this.boilerplateCtrl.initBoilerplate.bind(this.boilerplateCtrl)
		);

		this.api.all('/materia/*', this.oauth.isAuth, (req, res) => res.status(404).send());
	}
}