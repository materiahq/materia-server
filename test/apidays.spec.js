'use strict'

var fs = require('fs')

var expect = require('chai').expect
var request = require('request')

var App = require('../lib/app')

var mockTools = require('./mock/tools')

const appDir = __dirname + '/samples/apidays'

describe('Apidays', () => {
	describe('loading', () => {
		var app;

		before((done) => {
			mockTools.cleanAppDir(appDir, (err) => {
				if (err)
					return done(err)
				app = new App('Test', appDir, {silent:true, logRequests:false})
				done()
			})
		})

		it('should load the app', (done) => {
			app.load().then(() => {
				expect(app.entities.findAll().length).to.be.at.least(4)
				let eventEntity = app.entities.get('event');
				expect(eventEntity.getQueries().length).to.equal(7)
				return app.database.forceSync()
			}).then(() => {
				done()
			}).catch(done)
		})
	})

	describe('server', () => {
		var app;

		before((done) => {
			mockTools.cleanAppDir(appDir, (err) => {
				if (err)
					return done(err)
				app = new App('Test', appDir, {silent:true, logRequests:false, logSql:false})
				app.load().then(() => {
					done()
				}).catch((err) => {
					done(err)
				})
			})
		})

		after(() => {
			app.stop()
		})

		it('should start and stop the app', (done) => {
			app.start().then(() => {
				app.stop()
				return app.start()
			}).then(() => {
				done()
			}).catch((err) => {
				done(err)
			})
		})

		it('should create an event (using CreateQuery)', (done) => {
			app.entities.get('event').getQuery('create').run({
				slug: 'global-2015',
				title: 'APIdays Global 2015 - Paris',
				date_start: '12-02-2015',
				date_end: '12-03-2015'
			}).then(() => {
				done()
			}).catch((e) => {
				done(e)
			})
		})

		it('should find 1 event (FindAllQuery)', (done) => {
			app.entities.get('event').getQuery('list').run().then((data) => {
				expect(data.length).to.equal(1)
				done()
			})
		})

		it('should update the event with slug `global-2015`', (done) => {
			app.entities.get('event').getQuery('update').run({
				title: 'APIDays title updated',
				slug: 'global-2015'
			}).then((data) => {
				expect(data[0]).to.equal(1)
				done()
			}).catch((e) => {
				done(e)
			})
		})

		it('should retrieve "global-2015" event (findOneQuery) and delete it', (done) => {
			let eventEntity = app.entities.get('event')
			eventEntity.getQuery('getBySlug').run({
				slug: 'global-2015'
			}).then((ev) => {
				expect(ev.title).to.equal('APIDays title updated')
				eventEntity.getQuery('delete').run({
					slug: 'global-2015'
				}).then(() => {
					done()
				}).catch((e) => {
					done(e)
				})
			}).catch((e) => {
				done(e)
			})
		})

		it('should insert 2 event and 4 speakers then get all speakers for one event', (done) => {
			let eventCreate = app.entities.get('event').getQuery('create')
			let speakerCreate = app.entities.get('speaker').getQuery('create')

			eventCreate.run({
				slug: 'global-2015',
				title: 'APIdays Global 2015 - Paris',
				date_start: '12-02-2015',
				date_end: '12-03-2015'
			}).then(() => {
				return eventCreate.run({
					slug: 'london-2015',
					title: 'APIDays london - Banking and fintech',
					date_start: '09-22-2015',
					date_end: '09-23-2015'
				})
			}).then(() => {
				return speakerCreate.run({
					name: "Thibaud Arnault",
					company: "Webshell / OAuth.io",
					title: "Co-founder",
					linkedin: "https://www.linkedin.com/pub/thibaud-arnault/30/62b/489",
					slug_event: 'global-2015'
				})
			}).then(() => {
				return speakerCreate.run({
					name: "Mehdi Medjaoui",
					company: "Webshell / OAuth.io",
					title: "Co-founder",
					linkedin: "https://www.linkedin.com/in/mehdimedjaoui",
					slug_event: 'global-2015'
				})
			}).then(() => {
				return speakerCreate.run({
					name: "Toto",
					company: "X Corp",
					title: "CEO",
					linkedin: "https://www.linkedin.com/in/toto",
					slug_event: 'london-2015'
				})
			}).then(() => {
				return speakerCreate.run({
					name: "Toto2",
					company: "X Corp2",
					title: "CEO",
					linkedin: "https://www.linkedin.com/in/toto2",
					slug_event: 'london-2015'
				})
			}).then(() => {
				done()
			}).catch((e) => {
				done(e)
			})
		})

		it('should retrieve speaker from slug \'global-2015\'', (done) => {
			app.entities.get('speaker').getQuery('getByEvent').run({
				slug: 'global-2015'
			}).then((speakers) => {
				expect(speakers.length).to.equal(2)
				done()
			}).catch((e) => {
				done(e)
			})
		})

		it('should retrieve event with speakers from slug \'global-2015\'', (done) => {
			let eventEntity = app.entities.get('event')
			eventEntity.getQuery('getBySlug').run({
				slug: 'global-2015'
			}).then((ev) => {
				expect(ev.speakers && ev.speakers[0] && ev.speakers[0].id).to.equal(1)
				expect(ev.title).to.equal('APIdays Global 2015 - Paris')
				done()
			}).catch((e) => {
				done(e)
			})
		})

		it('should retrieve events via HTTP GET /events', (done) => {
			expect(app.api.endpoints.length).to.at.least(2)
			request.get('http://localhost:8080/api/events', function(error, response, body) {
				expect(error).to.equal(null)
				expect(response.statusCode).to.equal(200)
				done()
			})
		})

		it('should have a user entity', (done) => {
			let userEntity = app.entities.get('user');
			expect(userEntity).to.exist
			done();
		})

		it('should fail authorization to HTTP POST /auth (no credentials)', (done) => {
			request.post('http://localhost:8080/api/auth', function(error, response, body) {
				expect(error).to.equal(null)
				expect(response.statusCode).to.equal(500); // TODO: change to other code ?
				expect(body).to.equal('"Credentials not found"');
				done();
			})
		})

		it('should fail authorization to HTTP POST /auth (bad credentials)', (done) => {
			request.post({
				url: 'http://localhost:8080/api/auth',
				auth: { user: 'aaa', pass: 'bbbb' }
			}, function(error, response, body) {
				expect(error).to.equal(null)
				expect(response.statusCode).to.equal(200); // TODO: change to other code ?
				expect(body).to.equal("null"); // TODO: or something else ?
				done();
			})
		})

		it('should insert new users', (done) => {
			let userCreate = app.entities.get('user').getQuery('create')
			userCreate.run({
				email: 'user@user.com',
				pass: 'usrusr'
			}).then(() => {
				return userCreate.run({
					email: 'admin@admin.com',
					pass: 'admadm'
				})
			}).then(() => {
				done()
			}).catch((e) => {
				done(e)
			})
		})

		it('should give admin rights to new user', (done) => {
			let userPermissionCreate = app.entities.get('user_permission').getQuery('create')
			userPermissionCreate.run({
				id_user: 2,
				role: 'admin'
			}).then(() => {
				done()
			}).catch((e) => {
				done(e)
			})
		})

		it('should fail authorization on HTTP POST /events (no auth)', (done) => {
			request.post({
				url: 'http://localhost:8080/api/events',
				json: {
					slug: 'test-2015',
					title: 'Test confs',
					date_start: '12-05-2015',
					date_end: '12-06-2015'
				}
			}, function(error, response, body) {
				expect(error).to.equal(null)
				expect(response.statusCode).to.equal(500)
				expect(body).to.equal('"Unauthorized"')
				done();
			})
		})

		it('should authorize user with HTTP POST /auth', (done) => {
			request.post({
				url: 'http://localhost:8080/api/auth',
				auth: { user: 'admin@admin.com', pass: 'admadm' },
				jar: true
			}, function(error, response, body) {
				expect(error).to.equal(null)
				expect(response.statusCode).to.equal(200);
				expect(body).to.equal('{"id":2,"email":"admin@admin.com"}');
				done();
			})
		})

		it('should fail authorization on HTTP POST /events (no rights)', (done) => {
			request.post({
				url: 'http://localhost:8080/api/auth',
				auth: { user: 'user@user.com', pass: 'usrusr' },
				jar: true
			}, function(error, response, body) {
				expect(error).to.equal(null)
				expect(response.statusCode).to.equal(200);
				request.post({
					url: 'http://localhost:8080/api/events',
					jar: true,
					json: {
						slug: 'test-2015',
						title: 'Test confs',
						date_start: '12-05-2015',
						date_end: '12-06-2015'
					}
				}, function(error, response, body) {
					expect(error).to.equal(null)
					expect(response.statusCode).to.equal(500)
					expect(body).to.equal('"Unauthorized"')
					done();
				})
			})
		})

		it('should insert a new event via HTTP POST /events', (done) => {
			request.post({
				url: 'http://localhost:8080/api/auth',
				auth: { user: 'admin@admin.com', pass: 'admadm' },
				jar: true
			}, function(error, response, body) {
				expect(error).to.equal(null)
				expect(response.statusCode).to.equal(200);
				request.post({
					url: 'http://localhost:8080/api/events',
					jar: true,
					json: {
						slug: 'test-2015',
						title: 'Test confs',
						date_start: '12-05-2015',
						date_end: '12-06-2015'
					}
				}, function(error, response, body) {
					expect(error).to.equal(null)
					expect(response.statusCode).to.equal(200)
					done();
				})
			})
		})

		it('should use a sql query to find involved companies since 07-02-2015', (done) => {
			app.entities.get('event').getQuery('companiesSince').run({
				date: '07-02-2015'
			}).then((data) => {
				expect(data).to.deep.equal([
					{ "company": "X Corp" },
					{ "company": "X Corp2" },
					{ "company": "Webshell / OAuth.io" }
				])
				app.history.save()
				done()
			}).catch((e) => {
				done(e)
			})
		})

		it('should add a field into entity event', (done) => {
			let eventEntity = app.entities.get('event')
			eventEntity.addField({
				"name": "testField",
				"type": "text",
				"required": false,
				"primary": false,
				"unique": false,
				"default": false,
				"read": true,
				"write": true
			}).then(() => {
				eventEntity.getQuery('update').addParam({
					"name": "testField",
					"type": "text",
					"required": false
				})
				eventEntity.getQuery('update').updateValue('testField', '=')
				eventEntity.getQuery('create').addParam({
					"name": "testField",
					"type": "text",
					"required": false
				})
				eventEntity.getQuery('create').updateValue('testField', '=')
				app.api.get('post', '/events').addData({
					"name": "testField",
					"type": "text",
					"required": false
				})
				return eventEntity.getQuery('update').run({
					testField: 'test field',
					slug: 'global-2015'
				})
			}).then((data) => {
				expect(data[0]).to.equal(1)
				return eventEntity.getQuery('getBySlug').run({
					slug: 'global-2015'
				})
			}).then((ev) => {
				expect(ev.testField).to.equal('test field')
				done()
			}).catch((e) => {
				done(e)
			})
		})

		it('should delete a field from entity event', (done) => {
			let eventEntity = app.entities.get('event')
			eventEntity.removeField('title').then(() => {
				return eventEntity.getQuery('getBySlug').run({
					slug: 'global-2015'
				})
			}).then((ev) => {
				expect(ev.title).to.not.exist
				done()
			}).catch((e) => {
				done(e)
			})
		})

		it('should commit modifications', (done) => {
			app.history.commit('1').then(() => {
				if ( ! fs.existsSync(appDir + '/history/1.json'))
					return done(new Error('Failed to create commit file'))
				let commitobj, commitstr = fs.readFileSync(appDir + '/history/1.json').toString()
				try {
					commitobj = JSON.parse(commitstr)
				}
				catch (e) {
					return done(new Error('Failed to parse commit file: ' + e.message))
				}
				expect(commitobj.length).to.equal(5) // depends on previous tests
				done()
			}).catch((err) => {
				done(err)
			})
		})
	})

	describe('save/load project', () => {
		var app

		before((done) => {
			app = new App('Test', appDir, {silent:true, logRequests:false})
			app.load().then(() => {
				return app.start()
			}).then(() => {
				done()
			}).catch(done)
		})

		after(() => {
			app.stop()
		})

		it('should insert a new event via HTTP POST /events', (done) => {
			request.post({
				url: 'http://localhost:8080/api/auth',
				auth: { user: 'admin@admin.com', pass: 'admadm' },
				jar: true
			}, function(error, response, body) {
				expect(error).to.equal(null)
				expect(response.statusCode).to.equal(200);
				request.post({
					url: 'http://localhost:8080/api/events',
					jar: true,
					json: {
						slug: 'test-2016',
						title: 'Test confs 2016',
						date_start: '12-05-2016',
						date_end: '12-06-2016',
						testField: 'test field 2016'
					}
				}, function(error, response, body) {
					expect(error).to.equal(null)
					expect(response.statusCode).to.equal(200)
					done();
				})
			})
		})
	})

	describe('update project from commit', () => {
		var app

		before((done) => {
			mockTools.cleanEntities(appDir, (err) => {
				if (err)
					return done(err)
				mockTools.cleanApi(appDir, (err) => {
					if (err)
						return done(err)
					app = new App('Test', appDir, {silent:true, logRequests:false, logSql:false})
					app.load().then(() => {
						return app.database.forceSync()
					}).then(() => {
						return app.start()
					}).then(() => {
						done()
					}).catch((err) => {
						done(err)
					})
				})
			})
		})

		after(() => {
			app.stop()
		})

		it('should create a new event (before update)', (done) => {
			let events = app.entities.get('event')
			events.getQuery('create').run({
				slug: 'global-2015',
				title: 'APIdays Global 2015 - Paris',
				date_start: '12-02-2015',
				date_end: '12-03-2015'
			}).then(() => {
				return events.getQuery('getBySlug').run({
					slug: 'global-2015'
				})
			}).then((ev) => {
				expect(ev.title).to.equal("APIdays Global 2015 - Paris")
				expect(ev.testField).to.not.exist
				done()
			}).catch((err) => {
				done(err)
			})
		})

		it('should update the project with the last commit', (done) => {
			app.history.update(1).then(() => {
				let events = app.entities.get('event')
				return events.getQuery('getBySlug').run({
					slug: 'global-2015'
				})
			}).then((ev) => {
				expect(ev.slug).to.equal("global-2015")
				expect(ev.title).to.not.exist
				expect(ev.testField).to.equal(null)
				done()
			}).catch((e) => {
				done(e)
			})
		})
	})
})
