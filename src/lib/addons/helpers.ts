import { App } from '../app';

export interface AddonSetupField {
	name: string,
	description: string,
	type: string
}

export interface MateriaAddon {
	displayName: string;
	logo: string;
	constructor(app: App, config: any): void;

	getModule(): any;
	getViewComponent(): any;
	getInstallComponent?(): any;
	getInstallConfig?(): AddonSetupField[];

	load?(): Promise<void>;

	start?(): Promise<void>;
	uninstall?(): Promise<void>;
}

export interface AddonEntitiesHook {
	afterLoadEntities(): Promise<void>
}

export interface AddonQueriesHook {
	afterLoadQueries(): Promise<void>
}

export interface AddonAPIHook {
	afterLoadAPI(): Promise<void>
}