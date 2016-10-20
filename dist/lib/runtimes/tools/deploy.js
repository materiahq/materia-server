'use strict';
let fs = require('fs');
let os = require('os');
let path = require('path');
let Handlebars = require('handlebars');
let _whereis = require('whereis');
var cp = require('child_process');
const filesNeeded = {
    'dockerfile': [
        'Dockerfile.hbs',
        'docker-compose.yml.hbs'
    ],
    'heroku': [
        'app.json.hbs',
        'docker-compose.yml.hbs',
        'Dockerfile.hbs',
        'Procfile',
        'package.json.hbs',
        'README.md.hbs'
    ],
    'aws': [
        'Dockerfile.hbs',
        'docker-compose.yml.hbs',
        'deploy-aws.sh.hbs'
    ]
};
function whereis(filename) {
    return new Promise((accept, reject) => {
        _whereis(filename, (err, path) => {
            if (err)
                return reject(err);
            accept(path);
        });
    });
}
class Deploy {
    constructor(app) {
        this.app = app;
        this.deploys = [];
        this._templates_dir = path.join(this.app.materia_path, "..", "templates", "deploy");
        this._binPath = {};
    }
    _generateFile(file, infos) {
        let content = fs.readFileSync(path.join(this._templates_dir, file)).toString();
        let matches = /^(.+)\.hbs$/.exec(file);
        let use_hbs = false;
        let filename;
        if (!matches) {
            filename = file;
        }
        else {
            filename = matches[1];
            use_hbs = true;
        }
        if (use_hbs) {
            let tmpl = Handlebars.compile(content);
            content = tmpl(infos);
        }
        fs.writeFileSync(path.join(this.app.path, filename), content);
        console.log("Wrote file", filename);
    }
    findAll() {
        return this.deploys;
    }
    generate(provider, _options) {
        let options = {};
        for (let i in _options) {
            options[i] = _options[i];
        }
        options.mode = options.mode || "prod";
        return this.checkProviderSetup(provider, options).then(() => {
            let infos = {
                instance: {
                    image_base: 'node:5.6',
                    use_runnable: true,
                    port: this.app.server.getConfig(options.mode).port,
                },
                app: this.app.infos,
                env_vars: options.env_vars
            };
            if (provider == 'heroku') {
                // TODO: fork and manage our own heroku-nodejs base image
                infos.instance.image_base = "binarytales/heroku-nodejs:5.6.0";
                infos.instance.use_runnable = false;
                infos.instance.build = ".";
            }
            if (provider == 'aws') {
                infos.instance.aws_region = options['aws-region'] || '""';
                infos.instance.aws_cluster = options['aws-cluster'] || this.app.name + "-cluster";
                infos.instance.aws_size = options['aws-size'] || 1;
                infos.instance.aws_ecr = options['aws-ecr'];
                infos.instance.aws_keypair = options['aws-keypair'];
                infos.instance.aws_image = options['aws-image'] || this.app.name + "-image";
                infos.instance.aws_instance_type = options['aws-instance-type'] || "t2.micro";
                infos.instance.build_image = infos.instance.aws_ecr + "/" + infos.instance.aws_image;
            }
            let files = filesNeeded[provider];
            if (!files)
                return Promise.reject(new Error("unknown deploy provider: " + provider));
            for (let file of files)
                this._generateFile(file, infos);
            return Promise.resolve({});
        });
    }
    spawnRelease(provider, options) {
        if (provider == 'dockerfile') {
            return null;
        }
        else if (provider == 'heroku') {
            let args = ['container:release']; //['docker:release']
            if (options['heroku-app'])
                args.push('--app=' + options['heroku-app']);
            return cp.spawn(this._binPath['heroku'], args, { cwd: this.app.path });
        }
        else if (provider == 'aws') {
            fs.chmodSync(path.join(this.app.path, '/deploy-aws.sh'), '755');
            return cp.spawn('/bin/bash', ['-c', './deploy-aws.sh'], { cwd: this.app.path });
        }
    }
    checkProviderSetup(provider, options) {
        if (provider == 'dockerfile')
            return Promise.resolve({});
        else if (provider == 'heroku') {
            return whereis('docker').then((path) => {
                this._binPath['docker'] = path;
                return whereis('heroku');
            }).then((path) => {
                this._binPath['heroku'] = path;
                return new Promise((accept, reject) => {
                    cp.exec(this._binPath['heroku'] + ' plugins', (error, stdout, stderr) => {
                        let stdoutstr = stdout.toString();
                        if (error || stderr || stdoutstr == '')
                            return reject(error);
                        if (!stdoutstr.match(/\sheroku-container-tools@/))
                            return reject(new Error("heroku-container-tools plugin not installed"));
                        accept();
                    });
                });
            }).then(() => {
                let homedir = os.homedir();
                return new Promise((accept, reject) => {
                    fs.readFile(path.join(homedir, '.netrc'), (err, data) => {
                        const errmsg = 'You must run "heroku login" before deploying your app';
                        if (err)
                            return reject(new Error(errmsg));
                        let datastr = data.toString();
                        if (!datastr.match(/machine api.heroku.com/))
                            return reject(new Error(errmsg));
                        if (!datastr.match(/machine git.heroku.com/))
                            return reject(new Error(errmsg));
                        accept();
                    });
                });
            }).then(() => {
                if (options['heroku-app'])
                    return Promise.resolve({});
                return new Promise((accept, reject) => {
                    fs.readFile(path.join(this.app.path, '.git', 'config'), (err, data) => {
                        const errmsg = 'No heroku app specified. Use the --heroku-app=APP option or from an heroku app folder';
                        if (err)
                            return reject(new Error(errmsg));
                        let datastr = data.toString();
                        if (!datastr.match(/\s[remote "heroku"]/))
                            return reject(new Error(errmsg));
                        accept();
                    });
                });
            });
        }
        else if (provider == 'aws') {
            return whereis('docker').then((path) => {
                this._binPath['docker'] = path;
                return whereis('aws');
            }).then((path) => {
                this._binPath['aws'] = path;
                return whereis('ecs-cli');
            }).then((path) => {
                this._binPath['ecs-cli'] = path;
                return Promise.resolve({});
            });
        }
    }
}
module.exports = Deploy;
//# sourceMappingURL=deploy.js.map