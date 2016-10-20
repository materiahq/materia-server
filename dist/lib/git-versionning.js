"use strict";
const git = require('nodegit');
class GitVersionning {
    constructor(app) {
        this.app = app;
    }
    initialize() {
        return git.Repository.open(this.app.path).then(repo => {
            this.repository = repo;
            return this.repository.getCurrentBranch();
        }).then(ref => {
            this.branchRef = ref;
            return Promise.resolve(ref);
        });
    }
    changeBranch(branch) {
        return this.repository.checkoutBranch(branch, git.Checkout.STRATEGY.FORCE);
    }
    listBranches() {
        return this.repository.getReferenceNames(git.Reference.TYPE.LISTALL);
    }
    getStatus() {
        return this.repository.getStatus(null);
    }
    getLatestCommits() {
        return this.repository.getBranchCommit(this.branchRef).then(commit => {
            let hist = commit.history();
            let p = new Promise((resolve, reject) => {
                hist.on('end', resolve);
                hist.on('error', reject);
            });
            hist.start();
            return p;
        });
    }
    stageFiles(files) {
        return Promise.resolve();
    }
    stageAllFiles() {
        return Promise.resolve();
    }
    stageFile(file) {
        return this.stageFiles([file]);
    }
    commit(message, description) {
        return Promise.resolve();
    }
    pull() {
        return Promise.resolve();
    }
    push() {
        return Promise.resolve();
    }
    sync() {
        return this.pull().then(() => {
            return this.push();
        });
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = GitVersionning;
//# sourceMappingURL=git-versionning.js.map