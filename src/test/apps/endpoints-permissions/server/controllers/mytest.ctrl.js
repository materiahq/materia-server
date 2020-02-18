module.exports = class MyTestCtrl {
	constructor(app) {
		this.app = app;
	}

	testPermissions(req, res, next) {
		return Promise.resolve(req.body);
	}
}