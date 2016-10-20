var auth = require('basic-auth');
module.exports = (model, params, app) => {
    return new Promise(function (accept, reject) {
        var credentials = auth({ headers: params.headers });
        if (!credentials)
            reject(new Error("Credentials not found"));
        model.findOne({ attributes: ['id', 'email'], where: {
                email: credentials.name,
                pass: credentials.pass
            } }).then(function (user) {
            if (user)
                params.session.auth = user;
            accept(user);
        }, function (e) { console.error(e); reject(e); });
    });
};
//# sourceMappingURL=auth.js.map