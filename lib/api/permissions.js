'use strict';

class Permissions {
	constructor(app) {
		this.app = app;
		this.filters = []
	}

	check(permissions) {
		var perms = this
		return function checkPermissions(req, res, next) {
			var promises = []
			for (var filter of perms.filters) {
				promises.push(filter(permissions, req, res));
			}
			Promise.all(promises).then(
				function() { next(); },
				function(e) { res.status(500).json(JSON.stringify(e.message)); }
			);
		}
	}

	addFilter(filter) {
		this.filters.push(filter);
	}
}

module.exports = Permissions