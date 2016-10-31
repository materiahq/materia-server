const Git = require('simple-git/src/git');

   /**
    * Stash the local repo
    *
    * @param {Object|Array} [options]
    * @param {Function} [then]
    */
   Git.prototype.stash = function (options, then) {
      var handler = Git.trailingFunctionArgument(arguments);
      var opt = (handler === then ? options : null) || {};

      var command = ["stash"];
      if (Array.isArray(opt)) {
         command = command.concat(opt);
      }

      return this._run(command, function (err, data) {
         handler && handler(err, !err && data);
      });
   };