'use strict';
var path = require('path');
var expect = require('chai').expect;
var App = require('../lib/app');
var mockTools = require('./mock/tools');
const appDir = path.join(__dirname, 'samples', 'todo-app');
describe('App', () => {
    describe('#load()', () => {
        var app;
        before((done) => {
            mockTools.cleanAppDir(appDir, (err) => {
                if (err)
                    return done(err);
                app = new App(appDir, { silent: true });
                app.load().then(() => {
                    done();
                }).catch((err) => {
                    done(err);
                });
            });
        });
        it('should load the app, load the db configuration and connect the DB', () => {
            expect(app.name).to.equal('todo-app');
        });
    });
});
//# sourceMappingURL=app.spec.js.map