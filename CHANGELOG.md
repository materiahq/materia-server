# [1.0.0-beta.10](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.8) (2019-01-28)

### Bug fixes

* **files.ctrl**: Fix win32 path separator `\` in live mode on Unix server ([c741f17](https://github.com/materiahq/materia-server/commit/c741f17)) ([48bd2d9](https://github.com/materiahq/materia-server/commit/48bd2d9)) ([da2d17e](https://github.com/materiahq/materia-server/commit/da2d17e))

### Features

* **lib/self-migration**: Update client config migration ([532e089](https://github.com/materiahq/materia-server/commit/532e089))
* **addons.ctrl**: Use async readFile() method when retrieving bundle file ([56c175c](https://github.com/materiahq/materia-server/commit/56c175c))

# [1.0.0-beta.9](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.8) (2019-01-20)

### Bug fixes

* **database.ctrl**: Fix AdminAPI `DatabaseLib.loadEntitiesJSon()` method fail if DB disabled ([ec1d889](https://github.com/materiahq/materia-server/commit/ec1d889))
* **endpoints.ctrl**: Fix addon custom endpoints cannot be added through the Admin API ([1173114](https://github.com/materiahq/materia-server/commit/1173114))
* **hooks**: Fix req.query modified in `afterEndpoint` hook ([03554a9](https://github.com/materiahq/materia-server/commit/03554a9))
* **websocket**: Fix closing other sockets on connect ([10c86a8](https://github.com/materiahq/materia-server/commit/10c86a8))

### Features

* **lib/app**: Reset App's API Rest on reload ([df6c469](https://github.com/materiahq/materia-server/commit/df6c469))
* **lib/api**: Handle `websocket` endpoints in api.json ([b642adf](https://github.com/materiahq/materia-server/commit/b642adf))
* **lib/api**: new removeAll() method ([c2e19b2](https://github.com/materiahq/materia-server/commit/c2e19b2))
* **dependencies/ws**: Upgrade from `v5.1.1` to `v6.1.2` ([2133f6d](https://github.com/materiahq/materia-server/commit/2133f6d))


# [1.0.0-beta.8](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.8) (2019-01-11)

### Bug fixes

* **boirlerplates**: Emit complete error object on boilerplate generation failure instead of `error.data` ([7f54544](https://github.com/materiahq/materia-server/commit/7f54544))
* **boirlerplates**: Reject an error if `output` or `projectName` folders already exists to prevent unexpected failure or unwanted overwrite ([ba24c49](https://github.com/materiahq/materia-server/commit/ba24c49))
* **boirlerplates**: Fix client package.json path `undefined` after boilerplate project generation ([2697d2](https://github.com/materiahq/materia-server/commit/2697d2))
* **git**: Fix `unstage` file not working in newly created repo without `HEAD` ([a51854f](https://github.com/materiahq/materia-server/commit/a51854f))
* **git**: Fix Admin API `POST '/materia/git/pull'` endpoint error response ([77af2ac](https://github.com/materiahq/materia-server/commit/77af2ac))
* **package-manager**: Fix Admin API endpoints broken after url param name change ([f48cb00](https://github.com/materiahq/materia-server/commit/f48cb00))
* **permissions**: Handle invalid permissions with missing files ([7ec092e](https://github.com/materiahq/materia-server/commit/7ec092e)) ([0946a28](https://github.com/materiahq/materia-server/commit/0946a28))
* **permissions**: Fix Admin API permissions endpoints empty error responses, send `error.message` instead of full error ([2e7240d](https://github.com/materiahq/materia-server/commit/2e7240d))
* **sequelize**: Fix `Sequelize.Op` import error when packaged in Materia Designer ([ea973ac](https://github.com/materiahq/materia-server/commit/ea973ac))

### Enhancements

* **boilerplates**: Admin API single url for boilerplates generation `POST '/materia/boilerplates/:framework'` ([411c5c1](https://github.com/materiahq/materia-server/commit/411c5c1))
* **boirlerplates**: Admin API endpoint `POST '/materia/boilerplates/:framework'` don't need a body anymore. Default value are used when no `output`/`projectName` value found. ([ba24c49](https://github.com/materiahq/materia-server/commit/ba24c49))
* **boilerplates/React**: Root `package.json` scripts not modified anymore when generating a React project ([7c03ba1](https://github.com/materiahq/materia-server/commit/7c03ba1))
* **boilerplates/Vue**: Node_modules and lock files are not deleted anymore before Vue monopackage project generation ([9d2a1d9](https://github.com/materiahq/materia-server/commit/9d2a1d9))
* **dependencies**: Upgrade to @materia/interfaces v1.0.0-beta.3
* **dependencies**: Upgrade fs-extra and related @types/fs-extra to v4
([72f7284](https://github.com/materiahq/materia-server/commit/72f7284))
* **dependencies**: Admin API dependencies endpoints, `owner` and `pkg` params are now managed in a single url param `dependency` (remove duplicated endpoints url)
([d415aa0](https://github.com/materiahq/materia-server/commit/d415aa0))
* **documentation**: Add missing doc for Admin API endpoint `GET '/materia/addons/:pkg/setup'`
([db29a58](https://github.com/materiahq/materia-server/commit/db29a58))
* **documentation**: Swagger json file lint enhancement
([578d4aa](https://github.com/materiahq/materia-server/commit/578d4aa))
* **documentation**: Update permissions Admin API swagger docs
([578d4aa](https://github.com/materiahq/materia-server/commit/578d4aa))
* **documentation**: New `CHANGELOG.md` file ([eeafe94](https://github.com/materiahq/materia-server/commit/eeafe94))
* **permissions**: Add/update method comments and enhance typings ([f593509](https://github.com/materiahq/materia-server/commit/f593509)) ([b38e180](https://github.com/materiahq/materia-server/commit/b38e180))

### Features

* **permissions**: New Admin API endpoint `GET /materia/permissions/:permission` that allow to retrieve a single permission by his name ([2a4912e](https://github.com/materiahq/materia-server/commit/2a4912e))
* **permissions**: When a permission's name is updated with the Admin API endpoint `PUT '/materia/permissions/:permission'`, all related endpoints using this permission are automatically updated with the new permission name ([8528da4](https://github.com/materiahq/materia-server/commit/8528da4))

### Breaking changes

* **lib/App**: `app.start()` method now returns `Promise<number>` corresponding to the launched server port ([1a3f8d4](https://github.com/materiahq/materia-server/commit/1a3f8d4))
* **permissions**: Use interface `IPermission` from `@materia/interfaces@1.0.0-beta.3` (delete duplicated `IPermission` from `@materia/server`) ([0946a28](https://github.com/materiahq/materia-server/commit/0946a28))
* **permissions**: Single admin API endpoint `POST '/materia/permissions'` used to add a permission with his related code file. The admin API endpoint `POST '/materia/permissions/new'` doesn't exists anymore ([91f43d9](https://github.com/materiahq/materia-server/commit/91f43d9))
* **permissions**: Admin API endpoint `PUT 'materia/permissions/permission'` can now be used to either modify the permission informations or the permission's file content ([91f43d9](https://github.com/materiahq/materia-server/commit/91f43d9))

# [1.0.0-beta.7](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.7) (2018-12-06)


### Bug Fixes

* **actions/hooks:** Fix Admin API endpoint `GET '/materia/actions'` incorrect url ([64dbfe44](https://github.com/materiahq/materia-server/commit/64dbfe44))
* **actions/hooks:** Support actions with ids containing '/' char in AdminAPI endpoints `PUT '/materia/actions/:id'` and `DELETE /materia/actions/:id` ([64dbfe44](https://github.com/materiahq/materia-server/commit/64dbfe44))
* **actions/hooks:** Fix req.query modified on `beforeEnpoint` and `afterEndpoint` hooks ([e9f1fee](https://github.com/materiahq/materia-server/commit/e9f1fee))
* **database:** Fix Admin API database controller error responses for sync and remove app methods [424f089](https://github.com/materiahq/materia-server/commit/424f089))
* **dependencies**: Fix npm security warnings ([6d4319b](https://github.com/materiahq/materia-server/commit/6d4319b))
* **queries**: Reject an error if a required param is not found when launching custom query ([bda2446](https://github.com/materiahq/materia-server/commit/bda2446))
* **queries**: Prevent findAll query result count to be `NaN` ([9e1bdaa](https://github.com/materiahq/materia-server/commit/9e1bdaa))
* **sequelize:** Fix string based operator warning ([632561a](https://github.com/materiahq/materia-server/commit/632561a))
* **sequelize:** Add missing operators aliases: `$or`, `$and` and `$not` ([9ed472b](https://github.com/materiahq/materia-server/commit/9ed472b))
* **server:** Fix getBaseUrl() method when mode is undefined ([621d49f](https://github.com/materiahq/materia-server/commit/621d49f))
* **tests**: Fix integration tests ([0484678](https://github.com/materiahq/materia-server/commit/0484678))

### Features
* **addons**: New Admin API endpoint `GET /materia/addons/:pkg/setup` ([6abdfd8](https://github.com/materiahq/materia-server/commit/6abdfd8))
* **documentation**: New swagger-ui documentation for the Admin API ([4abbf53](https://github.com/materiahq/materia-server/commit/4abbf53)) ([e22e8f9](https://github.com/materiahq/materia-server/commit/e22e8f9))
* **queries:**
For queries that use a condition with `LIKE / NOT LIKE` operators, if the parameter value ​​do not contain at least one `%` character, the `%` character is automatically added to the beginning and end of the value.
***For example, if the value of the parameter is 'test', the value that will be passed in the query is '% test%'. On the other hand, if the value passed is '% test', the value will be unchanged.*** ([6f06fa1](https://github.com/materiahq/materia-server/commit/6f06fa1))

# [1.0.0-beta.6](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.6) (2018-11-12)

### Bug fixes

* **cli**: Fix end of line cli scripts when publishing from a windows machine, add a `prebulishOnly` and a `postpublish`script ([3f55a72](https://github.com/materiahq/materia-server/commit/3f55a72)) ([cf7a277](https://github.com/materiahq/materia-server/commit/cf7a277))


### Features

* **docker**: New admin API endpoint `POST '/materia/dockerfile'` to generate a docker file with the current launched app settings ([7c957af](https://github.com/materiahq/materia-server/commit/7c957af))

# [1.0.0-beta.5](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.5) (2018-11-12)

### Broken release

# [1.0.0-beta.4](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.4) (2018-10-29)

### Bug fixes

* **lib/npx**: Use `which` package to discover `npx` global path ([d1bf49f](https://github.com/materiahq/materia-server/commit/d1bf49f))
* **lib/angular-cli**: Fix exec() `cwd` undefined if not provided ([ae178d2](https://github.com/materiahq/materia-server/commit/ae178d2))

### Enhancements

* **package.json**: update `homepage`, `bugs` and `repository` urls to point to new materiahq github organization ([0ad39f4](https://github.com/materiahq/materia-server/commit/0ad39f4))
* **readme**: Update install command ([d811e5c](https://github.com/materiahq/materia-server/commit/d811e5c))

# [1.0.0-beta.3](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.3) (2018-10-28)

### Bug fixes

* **client**: Fix client settings `packageJsonPath` value and delete config if `www` doesn't exists when saving app setings using the Admin API endpoint `POST '/materia/config'` ([c67d97a](https://github.com/materiahq/materia-server/commit/c67d97a))
* **client**: Fix client settings not saved when initializing a new simple static directory ([ed1a45a](https://github.com/materiahq/materia-server/commit/ed1a45a))
* **database/postgres**: Fix change column type from `text` to `integer` fail ([dce4729](https://github.com/materiahq/materia-server/commit/dce4729))
* **database**: Fix `tryDatabase()` static method error not rejected when the database provided doesn't exists ([e85c193](https://github.com/materiahq/materia-server/commit/e85c193))

### Breaking changes

* **dependencies**: Upgrade to `@materia/interfaces@1.0.0-beta.2` dependency ([9bc0870](https://github.com/materiahq/materia-server/commit/9bc0870)) ([797acf2](https://github.com/materiahq/materia-server/commit/797acf2)) ([1820698](https://github.com/materiahq/materia-server/commit/1820698)) ([94969f4](https://github.com/materiahq/materia-server/commit/94969f4)) ([252e3cf](https://github.com/materiahq/materia-server/commit/252e3cf)) ([b3abbd7](https://github.com/materiahq/materia-server/commit/b3abbd7)) ([772e250](https://github.com/materiahq/materia-server/commit/772e250))

# [1.0.0-beta.2](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.2) (2018-10-28)

### Bug fixes

* **boilerplates/angular**: Delete generated .git folder when creating a two-packages structure angular project (Nested git repository not managed in Materia Designer) ([65b467b](https://github.com/materiahq/materia-server/commit/65b467b))
* **boilerplates/angular**: Prevent generated .git folder to overwrite root .git repository folder when creating a mono-package angular project ([87ab361](https://github.com/materiahq/materia-server/commit/87ab361))
* **boilerplates/angular**: Prevent initial root `start` script to be overwritten when generating a mono-package Angular project ([b44ed69](https://github.com/materiahq/materia-server/commit/b44ed69))
* **boilerplates/angular**: Delete generated `readme.md`when generating a mono-package structure Angular project ([b283dc9](https://github.com/materiahq/materia-server/commit/b283dc9))
* **boilerplates/angular**: Add `prod` and `watch` scripts to the client package.json when generating a two-packages structure Angular project ([266f4c8](https://github.com/materiahq/materia-server/commit/266f4c8))
* **boilerplates/vue**: Preserve intial .gitignore file when generating a monopackage Vue project ([6e6db92](https://github.com/materiahq/materia-server/commit/6e6db92))
* **cli/help.js**: fix `package.json` relative path ([786f70e](https://github.com/materiahq/materia-server/commit/786f70e))
* **client**: Emit an error if client config script not found when using the Admin API endpoint `POST '/materia/client/build'` ([623e928](https://github.com/materiahq/materia-server/commit/623e928))
* **client**: Fix Admin API client controller `startWatching()` method ([902d6fe](https://github.com/materiahq/materia-server/commit/902d6fe))
* **database**: Fix `createDatabase()` static method for `mysql` dialect ([2e40299](https://github.com/materiahq/materia-server/commit/2e40299))
* **files**: Fix Admin API endpoint `GET '/materia/files'` response warning. Use `res.status(status).send(..)` instead of depreacted `res.send(status, ..)` ([b521cd0](https://github.com/materiahq/materia-server/commit/b521cd0))
* **git**: Fix select `status` and `history` file containing spaces in name and fix `getHistoryDetail()` method ([e470374](https://github.com/materiahq/materia-server/commit/e470374))
* **git**: Fix select `stage` and `unstage` files containing spaces in name ([c8c170c](https://github.com/materiahq/materia-server/commit/c8c170c))
* **git**: Clean redundant code with new `private _fixGitPath()` method ([4fc2db8](https://github.com/materiahq/materia-server/commit/4fc2db8))
* **package.json**: Set license field to a valid SPDX value ([002f950](https://github.com/materiahq/materia-server/commit/002f950))
* **server**: Fix `getBaseUrl()` method to return live url in production mode ([d1cd0b8](https://github.com/materiahq/materia-server/commit/d1cd0b8))

### Enhancements

* **client**: Admin API endpoint `POST '/materia/client/build'` launch the `prod` script only if `req.body.prod = true` and the `prod` script exists in the client config, otherwise it will launch the `build` script ([07e373e](https://github.com/materiahq/materia-server/commit/07e373e))
* **boilerplates/angular**: Fix angular prject mono-package structure `angular.json` config file `root` value + preserve root `.gitignore` file from overwrite during project generation + move generated `tsconfig.json`/`tslint.json`/`.gitignore` files to client folder ([7182c1f](https://github.com/materiahq/materia-server/commit/7182c1f))
* **dependencies**: Remove deprecated `whereis` dependency ([2cdcb57](https://github.com/materiahq/materia-server/commit/2cdcb57))
* **dependencies**: Remove deprecated `tedious` dependency ([0e128e1](https://github.com/materiahq/materia-server/commit/0e128e1))
* **dependencies**: Remove `package-lock.json` file in favor `yarn.lock` ([111daf8](https://github.com/materiahq/materia-server/commit/111daf8))
* **server**: Define the express static folder on `start` instead of `load`. This change allow an addon modify the default materia server behavior before start ([3352a14](https://github.com/materiahq/materia-server/commit/3352a14))

### Features

* **dependencies**: Add new `@materia/interfaces` dependency ([9bc0870](https://github.com/materiahq/materia-server/commit/9bc0870))
* **dependencies**: Add `execa` dependency ([3cb3f03](https://github.com/materiahq/materia-server/commit/3cb3f03))
* **dependencies**: Upgrade `sequelize`, `mysql2` and `sqlite3` dependencies ([80460d1](https://github.com/materiahq/materia-server/commit/80460d1))

### Breaking changes

* **controllers**: The Admin API endpoint `GET '/materia/controllers'` used to retrieve a controller code content become `GET '/materia/controllers/:name'` ([658b1f3](https://github.com/materiahq/materia-server/commit/658b1f3))
* **dependencies**: Upgrade to `@materia/interfaces@1.0.0-beta.2` dependency ([9bc0870](https://github.com/materiahq/materia-server/commit/9bc0870))
* **lib/angular-cli**: Merge `execInFolder()` method in `exec()` method ([8d9658b](https://github.com/materiahq/materia-server/commit/8d9658b))
* **lib/vue-cli**: Merge `execInFolder()` method in `exec()` method ([811d405](https://github.com/materiahq/materia-server/commit/811d405))
* **lib**: Clean/harmonize `exec()` method with `folder` argument ([faa369](https://github.com/materiahq/materia-server/commit/faa369))
* **lib/npm**: merge `npm.execInFolderBackground()` method with `npm.execInBackground()` and merger `npm.execInFolder()` method with `npm.execInFolder()` ([faa369](https://github.com/materiahq/materia-server/commit/faa369))

# [1.0.0-beta.1](https://github.com/materiahq/materia-server/releases/tag/1.0.0-beta.1) (2018-10-10)

### Bug fixes

* **database**: Fix `createDatabase()` method for databases containing `-` character in their names ([4ff1c22](https://github.com/materiahq/materia-server/commit/4ff1c22))
* **lib/api**: Change `getMethodColor()` method from private to public ([4cb5961](https://github.com/materiahq/materia-server/commit/4cb5961))
* **server**: Fix server not starting if `materia.json` empty ([584c183](https://github.com/materiahq/materia-server/commit/584c183))
* **server**: Disable files watcher in production mode ([873a650](https://github.com/materiahq/materia-server/commit/873a650))

### Enhancements

* **permissions**: Return `401` status instead of `500` when unauthorized ([d9d53f2](https://github.com/materiahq/materia-server/commit/d9d53f2))

### Features

* **actions/hooks**: Add the ability to setup hooks when running `queries` or `endpoints`. Hooks are used to launch a specific query before or after the related request has been processed (`beforeQuery`/`afterQuery` and `beforeEndpoint`/`afterEndpoint`) ([da45ccf](https://github.com/materiahq/materia-server/commit/da45ccf))
* **admin API**: New Admin API Rest allowing to use and interact with a @materia/server instance through http ([6551981](https://github.com/materiahq/materia-server/commit/6551981))
* **boilerplates**: You can now generate a front-end project, through the admin API, in your materia application that uses your favorite framework: Angular (angular-cli), Vue (vue-cli) or React (npx create-react-app)
* **cli**: New `relink` command ([22f9f15](https://github.com/materiahq/materia-server/commit/22f9f15))
* **cli**: use `chalk` package to colorize outputs ([1ea992c](https://github.com/materiahq/materia-server/commit/1ea992c))
* **cli**: Colorize endpoint calls ([4d9d2cf](https://github.com/materiahq/materia-server/commit/4d9d2cf))
* **database/postgres**: Support for PostGIS fields ([431fb6e](https://github.com/materiahq/materia-server/commit/431fb6e))
* **entities**: New type of entity called `virtual`, which representing a remote ressource instead of a database table ([5ee48cb](https://github.com/materiahq/materia-server/commit/5ee48cb))
* **passport**: Expose `passport` in `app.server` as `app.server.passport` (can now be used in addons) ([561f9b2](https://github.com/materiahq/materia-server/commit/561f9b2))
* **permissions**: Add `app` object on `req` as `req.app` to allow running database queries ([d9d53f2](https://github.com/materiahq/materia-server/commit/d9d53f2))
* **permissions**: Permission file `class` support and ES6 import support ([dc03785](https://github.com/materiahq/materia-server/commit/dc03785))
* **server**: Allow Authorization header in CORS API call ([1fb03aa](https://github.com/materiahq/materia-server/commit/1fb03aa))
* **server**: Allow express static folder to be change dynamically at runtime ([58b1140](https://github.com/materiahq/materia-server/commit/58b1140))
* **websocket**: Add websocket capability with `express-ws` package ([dc03785](https://github.com/materiahq/materia-server/commit/dc03785))

### Breaking changes

* **config files**: The server, database and addons settings are now centralized in a single json file `materia.json` (`materia.prod.json` to change specific properties in production)
* **addons**: New addon system works only with new Angular v2+ structure ([569e7d3](https://github.com/materiahq/materia-server/commit/569e7d3))
* **npm**: Global `npm` is used, and npm is not bundled anymore in @materia/server
* **package.json**: package name is now `@materia/server` instead of `materia-server` ([1dcaa5b](https://github.com/materiahq/materia-server/commit/1dcaa5b))
* **watchers**: Watch only .json files in root ([384e211](https://github.com/materiahq/materia-server/commit/384e211))

### Security

* **server**: Disable Admin API in production if root password is undefined

# [0.8.0](https://github.com/materiahq/materia-server/releases/tag/0.8.0) (2017-07-14)

# [0.7.5](https://github.com/materiahq/materia-server/releases/tag/0.7.5) (2017-05-20)

# [0.7.4](https://github.com/materiahq/materia-server/releases/tag/0.7.4) (2017-05-20)

# [0.7.3](https://github.com/materiahq/materia-server/releases/tag/0.7.3) (2017-05-17)

# [0.7.2](https://github.com/materiahq/materia-server/releases/tag/0.7.2) (2017-04-18)

# [0.7.1](https://github.com/materiahq/materia-server/releases/tag/0.7.1) (2017-04-11)

# [0.7.0](https://github.com/materiahq/materia-server/releases/tag/0.7.0) (2017-04-10)

# [0.6.1](https://github.com/materiahq/materia-server/releases/tag/0.6.1) (2017-03-01)

# [0.6.0](https://github.com/materiahq/materia-server/releases/tag/0.6.0) (2017-01-17)

# [0.5.3](https://github.com/materiahq/materia-server/releases/tag/0.5.3) (2016-12-12)

# [0.5.2](https://github.com/materiahq/materia-server/releases/tag/0.5.2) (2016-12-11)

# [0.5.1](https://github.com/materiahq/materia-server/releases/tag/0.5.1) (2016-12-09)

# [0.5.0](https://github.com/materiahq/materia-server/releases/tag/0.5.0) (2016-12-08)

# [0.4.1](https://github.com/materiahq/materia-server/releases/tag/0.4.1) (2016-11-14)

# [0.4.0](https://github.com/materiahq/materia-server/releases/tag/0.4.0) (2016-11-08)

# [0.3.1](https://github.com/materiahq/materia-server/releases/tag/0.3.1) (2016-10-11)

# [0.3.0](https://github.com/materiahq/materia-server/releases/tag/0.3.0) (2016-10-06)

# [0.2.2](https://github.com/materiahq/materia-server/releases/tag/0.2.2) (2016-09-06)

# [0.2.1](https://github.com/materiahq/materia-server/releases/tag/0.2.1) (2016-09-03)

# [0.2.0](https://github.com/materiahq/materia-server/releases/tag/0.2.0) (2016-09-02)

# [0.1.4](https://github.com/materiahq/materia-server/releases/tag/0.1.4) (2016-09-02)

# [0.1.3](https://github.com/materiahq/materia-server/releases/tag/0.1.3) (2016-08-03)

# [0.1.2](https://github.com/materiahq/materia-server/releases/tag/0.1.2) (2016-08-02)

# [0.1.1](https://github.com/materiahq/materia-server/releases/tag/0.1.1) (2016-07-25)

# Pagination

You can now paginate all your `findAll` queries and endpoints: https://github.com/webshell/materia-designer/issues/14

Query configuration interface changed a bit :

`page` is now supported
`page`, `limit` and `offset` support parameters format with `=` sign.

e.g.

```
{
    "id": "getDoneTodos",
    "type": "findAll",
    "params": [
        {
            "name": "page",
            "type": "number",
            "required": false
        }
    ],
    "opts": {
        "conditions": [
            {
                "name": "done",
                "operator": "=",
                "value": "true"
            }
        ],
        "limit": "10",
        "page": "=page"
    }
}
```

# Bug fixes
- Fix findAll / findOne queries with no createdAt or updatedAt
- Fix updateField with required / no default value, and rows with null values
- Check naming collision when adding a relation

# [0.1.0](https://github.com/materiahq/materia-server/releases/tag/0.1.0) (2016-07-25)

Documentation: [getmateria.com/docs](https://getmateria.com/docs)

You are welcome to join us on our [Slack channels](https://www.hamsterpad.com/chat/materiahq) to talk with us / ask your questions about the project !

Enjoy ! Thanks for beta-testing :)