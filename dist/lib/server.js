'use strict';
const fs = require('fs');
const path = require('path');
const app_1 = require('./app');
const express = require('express');
//var compression = require('compression')
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const bodyParser = require('body-parser');
const errorHandler = require('errorhandler');
const session = require('express-session');
var enableDestroy = require('server-destroy');
(function (ConfigType) {
    ConfigType[ConfigType["WEB"] = "web"] = "WEB";
    ConfigType[ConfigType["DATABASE"] = "database"] = "DATABASE";
})(exports.ConfigType || (exports.ConfigType = {}));
var ConfigType = exports.ConfigType;
/**
 * @class Server
 * @classdesc
 * Represent the server
 */
class Server {
    constructor(app) {
        this.app = app;
        this.started = false;
        this.disabled = false;
    }
    load() {
        this.expressApp = express();
        this.expressApp.use(bodyParser.urlencoded({ extended: false }));
        this.expressApp.use(bodyParser.json());
        this.expressApp.use(methodOverride());
        this.expressApp.use(cookieParser());
        this.expressApp.use(session({
            secret: 'keyboard cat',
            cookie: { maxAge: 60000 },
            resave: false,
            saveUninitialized: false
        }));
        this.expressApp.use(express.static(path.join(this.app.path, 'web')));
        if ((this.app.mode == app_1.AppMode.DEVELOPMENT || this.app.options.logRequests) && this.app.options.logRequests != false) {
            this.expressApp.use(morgan('dev'));
        }
        //TODO: Option to enable / disable CORS API call
        this.expressApp.use(function (req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });
        this.expressApp.use(errorHandler());
        this.server = require('http').createServer(this.expressApp);
        enableDestroy(this.server);
    }
    /**
    Get the base url for endpoints
    @returns {string}
    */
    getBaseUrl(path, mode, options) {
        path = path || '/api';
        let conf = this.getConfig(mode, ConfigType.WEB, options);
        if (!conf) {
            return "";
        }
        let url = 'http://' + conf.host;
        if (conf.port != 80) {
            url += ':' + conf.port;
        }
        url += path;
        return url;
    }
    /**
    Return true if the server is started
    @returns {boolean}
    */
    isStarted() { return this.started; }
    checkMigrateConf(config) {
        config = config || {};
        if (config.dev && config.dev.web) {
            return config;
        }
        let database;
        try {
            let content = fs.readFileSync(path.join(this.app.path, 'database.json')).toString();
            database = JSON.parse(content);
        }
        catch (e) {
            if (e.code != 'ENOENT') {
                throw e;
            }
            database = {};
        }
        if (!Object.keys(config).length) {
            config = {
                host: 'localhost',
                port: 8080
            };
        }
        //flatten confs
        config = {
            dev: config.dev || config,
            prod: config.prod
        };
        delete config.dev.prod;
        database = {
            dev: this.app.database._confToJson(database.dev || database),
            prod: this.app.database._confToJson(database.prod)
        };
        this.config = {
            dev: {
                web: config.dev,
                database: database.dev
            }
        };
        if (config.prod || database.prod) {
            this.config.prod = {
                web: config.prod,
                database: database.prod
            };
        }
        fs.writeFileSync(path.join(this.app.path, 'server.json'), JSON.stringify(this.toJson(), null, '\t'));
        if (fs.existsSync(path.join(this.app.path, 'database.json'))) {
            fs.unlinkSync(path.join(this.app.path, 'database.json'));
        }
    }
    reloadConfig() {
        this.config = {};
        try {
            let content = fs.readFileSync(path.join(this.app.path, 'server.json')).toString();
            this.config = JSON.parse(content);
        }
        catch (e) {
            if (e.code != 'ENOENT') {
                throw e;
            }
        }
        this.checkMigrateConf(this.config);
    }
    /**
    Get the server configuration
    @param {string} - The environment mode. ConfigType.DEVELOPMENT or ConfigType.PRODUCTION.
    @returns {object}
    */
    getConfig(mode, type, options) {
        type = type || ConfigType.WEB;
        options = options || { live: this.app.live };
        if (!this.config) {
            this.reloadConfig();
        }
        if (!mode) {
            mode = this.app.mode;
        }
        if (!this.config[mode]) {
            return null;
        }
        let result = this.config[mode][type];
        if (options.live && result && result.live) {
            result = result.live;
        }
        return result;
    }
    /**
    Set the web configuration
    @param {object} - The configuration object
    @param {string} - The environment mode. `development` or `production`.
    */
    setConfig(config, mode, type, options, opts) {
        options = options || {};
        if (type == ConfigType.WEB && (!config.host || !config.port)) {
            if (mode == app_1.AppMode.DEVELOPMENT) {
                throw new Error('Missing host/port');
            }
            else {
                config = undefined;
            }
        }
        if (!this.config) {
            this.reloadConfig();
        }
        if (!this.config[mode]) {
            this.config[mode] = {};
        }
        let conf;
        if (type == ConfigType.WEB) {
            conf = config && {
                host: config.host,
                port: config.port
            };
        }
        else if (type == ConfigType.DATABASE) {
            conf = this.app.database._confToJson(config);
        }
        if (options.live) {
            if (!this.config[mode][type]) {
                this.config[mode][type] = {};
            }
            this.config[mode][type].live = conf;
        }
        else {
            let live = this.config[mode][type] && this.config[mode][type].live;
            this.config[mode][type] = conf;
            if (this.config[mode][type] && live) {
                this.config[mode][type].live = live;
            }
        }
        if (opts && opts.beforeSave) {
            opts.beforeSave('server.json');
        }
        fs.writeFileSync(path.join(this.app.path, 'server.json'), JSON.stringify(this.toJson(), null, '\t'));
        if (opts && opts.afterSave) {
            opts.afterSave();
        }
    }
    /**
    Return true if the server has a static page
    @returns {boolean}
    */
    hasStatic() {
        return fs.existsSync(path.join(this.app.path, 'web', 'index.html'));
    }
    /**
    Return the server's configuration
    @returns {object}
    */
    toJson() { return this.config; }
    /**
    Starts the server and listen on its endpoints.
    @returns {Promise}
    */
    start() {
        return this.stop().then(() => {
            this.app.api.registerEndpoints();
            this.expressApp.all('/api/*', (req, res) => {
                res.status(404).send({
                    error: true,
                    message: 'API endpoint not found'
                });
            });
            this.expressApp.all('/*', (req, res) => {
                if (fs.existsSync(path.join(this.app.path, 'web', '404.html'))) {
                    res.sendFile(path.join(this.app.path, 'web', '404.html'));
                }
                else if (this.hasStatic()) {
                    res.sendFile(path.join(this.app.path, 'web', 'index.html'));
                }
                else {
                    res.status(404).send({
                        error: true,
                        message: 'API endpoint not found'
                    });
                }
            });
            this.expressApp.use((err, req, res, next) => {
                res.status(500).send({
                    error: true,
                    message: (err && err.message) || "Unexpected error"
                });
                return this.expressApp;
            });
            if (this.disabled) {
                this.app.logger.log('INFO: The server is disabled on this machine.');
                return Promise.resolve();
            }
            let config = this.getConfig();
            return new Promise((resolve, reject) => {
                let errListener = (e) => {
                    let err;
                    if (e.code == 'EADDRINUSE') {
                        err = new Error('Error while starting the server: The port is already used by another server.');
                    }
                    else {
                        err = new Error('Error while starting the server: ' + e.message);
                    }
                    err.originalError = e;
                    this.app.logger.error(err);
                    return reject(err);
                };
                let port = this.app.options.port || config.port;
                let args = [port, config.host, () => {
                        this.started = true;
                        this.app.logger.log(`Server listening on ${config.host}:${port}`);
                        this.server.removeListener('error', errListener);
                        return resolve();
                    }];
                if (config.host == '0.0.0.0') {
                    args[1] = args.pop();
                }
                this.server.listen.apply(this.server, args).on('error', errListener);
            });
        });
    }
    /**
    Stops the server.
    */
    stop(options) {
        if (!this.server || !this.started) {
            return Promise.resolve();
        }
        return new Promise((accept, reject) => {
            let method = (options && options.force) ? 'destroy' : 'close';
            this.server[method](() => {
                this.app.logger.log('Server closed');
                this.started = false;
                accept();
            });
        });
    }
}
exports.Server = Server;
//# sourceMappingURL=server.js.map