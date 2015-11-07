var expect = require('chai').expect
var App = require('../lib/app')
var request = require('request')
var app;

describe('Apidays', () => {
	describe('loading', () => {

		before(() => {
		})

		beforeEach((done) => {
			app = new App('Test', __dirname + '/samples/apidays')
			done()
		})

		it('should load the app', (done) => {
			app.load().then(() => {
				expect(app.entities.findAll().length).to.be.at.least(4)
				let eventEntity = app.entities.get('event');
				expect(eventEntity.getQueries().length).to.equal(5)
				done()
			}).catch(done)
		})
	})

	describe('server', () => {
		before((done) => {
			app = new App('Test', __dirname + '/samples/apidays')
			app.load().then(() => {
				app.database.forceSync().then(() => {
					done()
				}).catch((e) =>  { done(e) })
			}).catch((e) => { done(e) })
		})
		beforeEach((done) => {
			app.start().then(() => {
				done()
			}).catch(done)
		})
		it('should start and stop the app', (done) => {
			app.stop()
			done()
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

			console.log('try create event')
			eventCreate.run({
				slug: 'global-2015',
				title: 'APIdays Global 2015 - Paris',
				date_start: '12-02-2015',
				date_end: '12-03-2015'
			}).then(() => {
				console.log('first event created')
				return eventCreate.run({
					slug: 'london-2015',
					title: 'APIDays london - Banking and fintech',
					date_start: '09-22-2015',
					date_end: '09-23-2015'
				})
			}).then(() => {
				console.log('second event created')
				return speakerCreate.run({
					name: "Thibaud Arnault",
					company: "Webshell / OAuth.io",
					title: "Co-founder",
					linkedin: "https://www.linkedin.com/pub/thibaud-arnault/30/62b/489",
					slug_event: 'global-2015'
				})
			}).then(() => {
				console.log('first speaker created')
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
				console.log(speakers)
				expect(speakers.length).to.equal(2)
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
				console.log(body)
				done()
			})
		})

		it('should have created user entity', (done) => {
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

		it('should insert admin user', (done) => {
			let userCreate = app.entities.get('user').getQuery('create')
			userCreate.run({
				email: 'admin@admin.com',
				pass: 'admadm',
				role: 'admin'
			}).then(() => {
				done()
			}).catch((e) => {
				done(e)
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
				expect(body).to.equal('{"id":1,"email":"admin@admin.com","role":"admin"}');
				done();
			})
		})
	})
})
