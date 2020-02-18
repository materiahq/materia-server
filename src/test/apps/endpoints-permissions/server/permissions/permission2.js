module.exports = class Permission2 {
	constructor(app) {
		this.app = app;
	}
	check(req, res, next) {
		if (req.body && req.body.message) {
			req.body.message = req.body.message + ' World!';
		}
		next();
	}
};
