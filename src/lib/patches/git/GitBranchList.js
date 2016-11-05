const BranchSummary = require('simple-git/src/responses/BranchSummary');

BranchSummary.detachedRegex = /^(\*?\s+)\((?:HEAD )?detached (?:from|at) (\S+)\)\s+([a-z0-9]+)\s(.*)$/;