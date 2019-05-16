# [1.0.0-rc.0](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-rc.0) (2019-04-23)

### Bug fixes

* **dependencies**: fix security warning by upgrading mocha + tslint + chokidar ([2ad2dcf](https://github.com/materiahq/materia-server/commit/2ad2dcf))
* **lib/entities**: fix delete_entity operation not working when syncing entities to database ([e569b6a](https://github.com/materiahq/materia-server/commit/e569b6a))

### Features

* **tests/synchronize**: new integration tests for testing syncing database to entities ([e569b6a](https://github.com/materiahq/materia-server/commit/e569b6a)) ([15860cc](https://github.com/materiahq/materia-server/commit/15860cc))

### Breaking changes

* **sequelize**: upgrade from v4 to latest v5.7.0 ([f6cf13f](https://github.com/materiahq/materia-server/commit/f6cf13f)) ([d6dfced](https://github.com/materiahq/materia-server/commit/d6dfced))
* **sequelize**: turn off operatorAliases ([67537e1](https://github.com/materiahq/materia-server/commit/67537e1))
* **typescript**: upgrade to v3.2.4 ([f6cf13f](https://github.com/materiahq/materia-server/commit/f6cf13f))
* **CI/travis**: update typescript version to v3.2.4 ([470ff1e](https://github.com/materiahq/materia-server/commit/470ff1e))

# [1.0.0-beta.16](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.16) (2019-04-09)

### Bug fixes

* **adminAPI/packageManager**: clean logs ([3ebedfd](https://github.com/materiahq/materia-server/commit/3ebedfd))
* **adminAPI/client**: fix installAll when no client config exists ([6f8be08](https://github.com/materiahq/materia-server/commit/6f8be08)) ([1736894](https://github.com/materiahq/materia-server/commit/1736894))
* **lib/entity**: round x/y position with 2 decimals ([d49914c](https://github.com/materiahq/materia-server/commit/d49914c))

### Features

* **adminAPI/git**: new git clone endpoint ([de2c355](https://github.com/materiahq/materia-server/commit/de2c355))

# [1.0.0-beta.15](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.15) (2019-03-25)

### Bug fixes

* **adminAPI/addons**: Fix getConfig() endpoint error when no config exists ([1dcc51f](https://github.com/materiahq/materia-server/commit/1dcc51f))
* **cli**: Fix displaying error when starting an app ([d90a438](https://github.com/materiahq/materia-server/commit/d90a438))
* **lib/app**: don't synchronize database if disabled ([8cb9e8e](https://github.com/materiahq/materia-server/commit/8cb9e8e))
* **lib/api**: allow adding 'query' endpoints to virtual entity even if database is disabled ([dcec5c6](https://github.com/materiahq/materia-server/commit/dcec5c6))
* **lib/npm**: avoid using npm from 'materia-designer' in dev ([972d17f](https://github.com/materiahq/materia-server/commit/972d17f))
* **lib/files**: simplify private _moveItem() method ([5a7d353](https://github.com/materiahq/materia-server/commit/5a7d353))
* **lib/queries/findAll**: Fix error when raw option is not set ([9a1c288](https://github.com/materiahq/materia-server/commit/9a1c288))
* **readme**: Update test badge ([348db5d](https://github.com/materiahq/materia-server/commit/348db5d))
* **tests**: Modify some assertions to pass tests on PostgresSQL ([08cbcea](https://github.com/materiahq/materia-server/commit/08cbcea))
* **CI/travis**: Fix tests template app temp directory ([8c6c836](https://github.com/materiahq/materia-server/commit/8c6c836))
* **CI/travis**: Update node_js version to 10.15 ([e1b0b07](https://github.com/materiahq/materia-server/commit/e1b0b07))
* **CI/travis**: Update typescript version to 2.9.2 ([bb56f8f](https://github.com/materiahq/materia-server/commit/bb56f8f))
* **CI/travis**: Update before_install/install/script to use yarn ([2466fdb](https://github.com/materiahq/materia-server/commit/2466fdb))

### Features

* **adminAPI/client**: new installAll dependencies and install single dependency endpoints ([1d4ffb0](https://github.com/materiahq/materia-server/commit/1d4ffb0)) ([36902bd](https://github.com/materiahq/materia-server/commit/36902bd))
* **lib/packageManager**: new package manager file which uses npm or yarn to manage dependencies ([28efeff](https://github.com/materiahq/materia-server/commit/28efeff)) ([d0e939c](https://github.com/materiahq/materia-server/commit/d0e939c)) ([bb32720](https://github.com/materiahq/materia-server/commit/bb32720)) ([dc899c2](https://github.com/materiahq/materia-server/commit/dc899c2))

### Breaking changes

* **dependencies**: Upgrade mocha to v6.0.2 ([c936c07](https://github.com/materiahq/materia-server/commit/c936c07))

# [1.0.0-beta.14](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.14) (2019-03-07)

### Bug fixes

* **lib/entities**: Fix renaming/deleting virtual entities fails ([32ba096](https://github.com/materiahq/materia-server/commit/32ba096))
* **tslint**: Fix node_modules not correctly excluded in linterOptions ([2d1ce32](https://github.com/materiahq/materia-server/commit/2d1ce32))

### Features

* **lib/app**: Add isDir/relativepath properties to tree file response ([b66f1dc](https://github.com/materiahq/materia-server/commit/b66f1dc))

### Breaking changes

* **adminAPI/files**: Return file or folder as move/add item success response ([d1cf690](https://github.com/materiahq/materia-server/commit/d1cf690))
* **dependencies**: Upgrade @materia/interfaces to v1.0.0-beta.9 ([c9f602f](https://github.com/materiahq/materia-server/commit/c9f602f))

# [1.0.0-beta.13](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.13) (2019-02-22)

### Bug fixes

* **adminAPI/endpoints.ctrl**: Fix watcher not disable when adding custom query ([c93294c](https://github.com/materiahq/materia-server/commit/c93294c))
* **lib/database**: Fix createDatabase() unhandled promise rejection ([f0cd255](https://github.com/materiahq/materia-server/commit/f0cd255))
* **lib/api/permissions**: Fix incorrect permission file path on save ([e32ccd9](https://github.com/materiahq/materia-server/commit/e32ccd9))

### Features

* **lib/api/permissions**: add fromAddon property ([c2fac08](https://github.com/materiahq/materia-server/commit/c2fac08))

### Breaking changes

* **dependencies**: remove unused deps: handlebars, sequelize-cli and ts-node ([4cfcf06](https://github.com/materiahq/materia-server/commit/4cfcf06))
* **dependencies**: upgrade typescript to v2.9.2 ([4cfcf06](https://github.com/materiahq/materia-server/commit/4cfcf06))
* **dependencies**: Upgrade chokidar and @materia/interfaces ([2bc5f1e](https://github.com/materiahq/materia-server/commit/2bc5f1e))
* **lib/watcher**: set explicitly useFsEvents option for macOs + comment unsuported if statement ([6b705ca](https://github.com/materiahq/materia-server/commit/6b705ca))

# [1.0.0-beta.12](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.12) (2019-02-19)

### Bug fixes

* **adminAPI/api/permissions**: Fix watcher not disable on delete/update/create + improve request errors reponses ([81e3694](https://github.com/materiahq/materia-server/commit/81e3694))
* **lib/queries/findAll**: Fix orderBy param checks when request params doesn't exists ([6afaaf7](https://github.com/materiahq/materia-server/commit/6afaaf7))
* **tests**: fix tests with latest changes ([006b3f0](https://github.com/materiahq/materia-server/commit/006b3f0))

# [1.0.0-beta.11](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.11) (2019-02-19)

### Bug fixes

* **adminAPI/client**: Use `chalk` instead of `strip-ansi` for coloring outputs ([bfe55d0](https://github.com/materiahq/materia-server/commit/bfe55d0))
* **adminAPI/database**: fix getRelatedEntities() method + disable watcher on all methods ([448af30](https://github.com/materiahq/materia-server/commit/448af30))
* **adminAPI/database**: send error messages instead of full errors ([e59b13d](https://github.com/materiahq/materia-server/commit/e59b13d))
* **adminAPI/database**: fix runQuery() method after changing url param name + harmonize error responses ([6fcfc60](https://github.com/materiahq/materia-server/commit/6fcfc60))
* **adminAPI/database**: fix runQuery() null response ([bc56e09](https://github.com/materiahq/materia-server/commit/bc56e09))
* **cli**: Fix version color using `chalk` ([5215b4e](https://github.com/materiahq/materia-server/commit/5215b4e))
* **lib/entities**: Load virtual entities even if database is disabled ([aad5a9c](https://github.com/materiahq/materia-server/commit/aad5a9c))
* **lib/entities**: retrieve correct x/y position on creation if already exists in entities-position json file ([2b0d573](https://github.com/materiahq/materia-server/commit/2b0d573))
* **lib/entities**: allow adding belongsTo/hasMany and belongsToMany relationships on table to itself ([548cb93](https://github.com/materiahq/materia-server/commit/548cb93))
* **lib/DBEntity**: Remove hard fix when listing related tables data before adding belongsTo/hasMany relationship ([33a390c](https://github.com/materiahq/materia-server/commit/33a390c))
* **lib/queries/findAll**: Fix incorrect count for findAll query with join + related test ([aee39df](https://github.com/materiahq/materia-server/commit/aee39df))
* **lib/queries/findAll**: Allow running query with join when no PK on joined table ([12b600a](https://github.com/materiahq/materia-server/commit/12b600a))
* **lib/watcher**: Remove unused win32 watcher folder ([0cb1c40](https://github.com/materiahq/materia-server/commit/0cb1c40))
* **tests**: add `materia.json` files in test apps templates to clean warnings ([0be22f1](https://github.com/materiahq/materia-server/commit/0be22f1))
* **tests/relation**: re-add (uncomment) belongsTo failing test ([51c8afc](https://github.com/materiahq/materia-server/commit/51c8afc))
* **typescript/interfaces**: use interface from `@materia/interfaces` + remove duplicated ones ([4c01a3b](https://github.com/materiahq/materia-server/commit/4c01a3b)) ([18f9909](https://github.com/materiahq/materia-server/commit/18f9909)) ([dd56d66](https://github.com/materiahq/materia-server/commit/dd56d66)) ([309933b](https://github.com/materiahq/materia-server/commit/309933b))

### Features

* **global**: add `ts-lint` devDependency + lint all files ([7539028](https://github.com/materiahq/materia-server/commit/7539028)) ([e28fada](https://github.com/materiahq/materia-server/commit/e28fada)) ([1e6d279](https://github.com/materiahq/materia-server/commit/1e6d279)) ([3a06a6d](https://github.com/materiahq/materia-server/commit/3a06a6d))
* **adminAPI/entities**: allow adding virtual entity ([462eab7](https://github.com/materiahq/materia-server/commit/462eab7))
* **lib/entities**: save virtual entity default queries in related model json file ([f697676](https://github.com/materiahq/materia-server/commit/f697676))
* **lib/queries/findAll**: allow passing/overriding orderBy params, even if not set ([190709b](https://github.com/materiahq/materia-server/commit/190709b)) ([55e6cab](https://github.com/materiahq/materia-server/commit/55e6cab))
* **lib/queries/findAll**: set default limit/page/offset if not set ([190709b](https://github.com/materiahq/materia-server/commit/190709b))
* **lib/synchronize**: support 'now()' value for datetime defaultValue ([e53275d](https://github.com/materiahq/materia-server/commit/e53275d))
* **lib/field**: support 'now()' value for datetime defaultValue ([fd6d3d2](https://github.com/materiahq/materia-server/commit/fd6d3d2))
* **lib/addons**: new isInstalled() method returning a boolean value based on a package name ([a689c7](https://github.com/materiahq/materia-server/commit/a689c7))
* **typescript/typings**: remove old types folder in favor of definetly type package `@types/*` ([1a4b210](https://github.com/materiahq/materia-server/commit/1a4b210))
* **tests**: new integrations tests for: database and entities sync, entities without PK, now() default value and relation from table to itself ([998743d](https://github.com/materiahq/materia-server/commit/998743d))

### Breaking changes

* **dependencies**: remove unused packages: request, @types/request, colors, cookie-parser, express-ws, lodash, pretty-error, strip-ansi and winston ([ca12dec](https://github.com/materiahq/materia-server/commit/ca12dec))
* **dependencies**: move @types/express @types/ws and @types/sequelize from devDependencies to dependencies ([ca12dec](https://github.com/materiahq/materia-server/commit/ca12dec))



# [1.0.0-beta.10](https://github.com/materiahq/materia-server/releases/tag/v1.0.0-beta.10) (2019-01-28)

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