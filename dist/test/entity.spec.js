'use strict';
var expect = require('chai').expect;
var path = require('path');
var DBEntity = require('../lib/entities/db-entity');
var Entity = require('../lib/entities/entity');
var History = require('../lib/history');
var mockTools = require('./mock/tools');
const appDir = path.join(__dirname, 'samples', 'todo-app');
describe('Entity', () => {
});
describe('DBEntity', () => {
    let mock_app;
    before((done) => {
        mockTools.cleanAppDir(appDir, (err) => {
            if (err)
                return done(err);
            mock_app = {
                name: 'app',
                path: appDir
            };
            mock_app.history = new History(mock_app);
            done();
        });
    });
    describe('Constructor', () => {
        let entity1;
        let entity2;
        before((done) => {
            entity1 = new DBEntity(mock_app);
            entity2 = new DBEntity(mock_app);
            entity1.create({
                name: 'entity1'
            }).then(() => {
                return entity2.create({
                    name: 'entity2',
                    fields: [
                        {
                            name: 'id',
                            primary: true,
                            unique: true,
                            type: 'number',
                            autoIncrement: true
                        },
                        {
                            name: 'field2'
                        }
                    ]
                });
            }).then(() => {
                done();
            }, (err) => {
                done(err);
            });
        });
        it('should have a name and default value', () => {
            expect(entity1).to.have.property('name');
            expect(entity1.name).to.equal('entity1');
            expect(entity2.name).to.equal('entity2');
            expect(entity2.fields[0].type).to.equal('number');
            //need to test PK / Unique / required / autoincrement and defaultValue
        });
        it('should have fields initialized', () => {
            expect(entity2.fields).to.be.instanceof(Array);
            expect(entity2.fields.length).to.equal(2);
            expect(entity1.fields).to.be.instanceof(Array);
            expect(entity1.fields.length).to.equal(0);
        });
    });
    describe('addField()', () => {
        let entity;
        beforeEach((done) => {
            entity = new DBEntity(mock_app);
            entity.create({ name: 'entity1' }).then(() => {
                done();
            }).catch((e) => {
                done(e);
            });
        });
        it('should add a field', (done) => {
            expect(entity.fields.length).to.equal(0);
            entity.addField({ name: 'testField' }, { db: false }).then(() => {
                expect(entity.fields.length).to.equal(1);
                expect(entity.getField('testField')).to.be.instanceof(Object);
                expect(entity.getField('testField').name).to.equal('testField');
                done();
            }, (err) => {
                done(err);
            });
        });
    });
    describe('addFieldFirst()', () => {
        let entity;
        beforeEach((done) => {
            entity = new DBEntity(mock_app);
            entity.create({ name: 'entity1' }).then(() => {
                done();
            }).catch((e) => {
                done(e);
            });
        });
        it('should add a field in first position', (done) => {
            expect(entity.fields.length).to.equal(0);
            entity.addField({ name: 'testField' }, { db: false }).then(() => {
                return entity.addFieldFirst({ name: 'testField2' }, { db: false });
            }).then(() => {
                expect(entity.fields.length).to.equal(2);
                expect(entity.fields[0].name).to.equal('testField2');
                done();
            }, (err) => {
                done(err);
            });
        });
    });
});
//# sourceMappingURL=entity.spec.js.map