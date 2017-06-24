module.exports = class MyTestCtrl {
	constructor(app) {
		this.app = app;
	}

	testPromise(req, res, next) {
		return Promise.resolve({
			x: 42
		})
	}

	testExpress(req, res, next) {
		res.send("ok")
	}

	testParams(req, res, next) {
		return Promise.resolve({
			body: req.body,
			query: req.query,
			params: req.params
		})
	}

	testSessionInit(req, res, next) {
		req.session.test = 'Hello World'
		console.log(`Save session with: ${req.session.test}`)
		return Promise.resolve(req.session.test)
	}

	testSessionFetch(req, res, next) {
		return Promise.resolve(req.session.test)
	}
}