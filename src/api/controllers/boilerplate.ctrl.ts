import { App } from '../../lib';
import { Npm } from '../lib/npm';
import { Npx } from '../lib/npx';
import { getPackageJson } from '../lib/getPackageJson';

export class BoilerplateController {
	npm: Npm;
	npx: Npx;

	constructor(private app: App) {
		this.npm = new Npm(this.app);
		this.npx = new Npx(this.app);
	}

	initMinimal(req, res) {
		this.app.initializeStaticDirectory();
		res.status(200).json({ init: true });
	}

	initAngular(req, res) {
		const name = '@angular/cli';
		console.log('INSTALL @angular/cli');
		this.npm.call('install', [name]).then(data => {
			console.log('INSTALL SUCCESS');
			const pkg = this.app.config.packageJson
			if (!pkg['devDependencies']) {
				pkg['devDependencies'] = {};
			}
			if (!pkg['scripts']) {
				pkg['scripts'] = {};
			}
			getPackageJson(this.app, name).then(tmp => {
				pkg['devDependencies'][name] = `~${tmp['version']}`;
				pkg['scripts']['ng'] = 'ng';
				console.log('GENERATE NEW CLI PROJECT IN CLIENT');
				const proc: any = this.npm.spawn([
					'run',
					'ng',
					'new',
					'myProject',
					'--',
					'--directory',
					'client'
				]);
				proc.on('exit', (code, signal) => {
					console.log('GENERATE SUCCESS');
					console.log('BUILD ANGULAR APP');
					const buildProc: any = this.npm.spawn(
						['run', 'build'],
						{
							cwd: this.app.path + '/client'
						}
					);
					buildProc.stdout.on('data', data2 => {
						console.log(`child stdout:\n${data2}`);
					});
					buildProc.stderr.on('data', data2 => {
						console.log(`child stderr:\n${data2}`);
					});
					buildProc.on('exit', (code2, signal2) => {
						console.log('BUILD SUCCESS');
						console.log('SET NEW CLIENT APP');
						// this.app.client.set(
						// 	'client',
						// 	'client/dist',
						// 	{
						// 		build: 'build',
						// 		watch: 'build',
						// 		prod: 'build'
						// 	},
						// 	false
						// );
						// const client = {
						// 	enabled: true,
						// 	build: {
						// 		src: 'client',
						// 		buildFolder: 'client/dist',
						// 		enabled: true
						// 	}
						// };
					});
				});
			});
		});
	}

	initReact(req, res) {
		console.log('Create React App');
		const proc: any = this.npx.call([
			'create-react-app',
			'my-react-project'
		]);
		proc.stdout.on('data', data2 => {
			console.log(`child stdout:\n${data2}`);
		});
		proc.stderr.on('data', data2 => {
			console.error(`child stderr:\n${data2}`);
		});
		proc.on('exit', (code, signal) => {
			console.log('React app created');
			console.log('BUILD REACT APP');
			const buildProc: any = this.npm.spawn(['run', 'build'], {
				cwd: this.app.path + '/my-react-project'
			});
			buildProc.stdout.on('data', data2 => {
				console.log(`child stdout:\n${data2}`);
			});
			buildProc.stderr.on('data', data2 => {
				console.log(`child stderr:\n${data2}`);
			});
			buildProc.on('exit', (code2, signal2) => {
				console.log('BUILD SUCCESS');
				console.log('SET NEW CLIENT APP');
				// app.client.set(
				// 	'my-react-project',
				// 	'my-react-project/build',
				// 	{ build: 'build', watch: 'build', prod: 'build' },
				// 	false
				// );
				// const client = {
				// 	enabled: true,
				// 	build: {
				// 		src: 'my-react-project',
				// 		dist: 'my-react-project/build',
				// 		enabled: true
				// 	}
				// };
				// resolve(client);
			});
		});
	}

	initVue(req, res) {

	}
}