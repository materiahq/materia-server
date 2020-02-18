module.exports = class Permission1 {
	constructor(app) {
		this.app = app;
	}
	check(req, res, next) {
		if (req.body) {
			req.body.message = 'Hello';
		}
		next();
	}
};
