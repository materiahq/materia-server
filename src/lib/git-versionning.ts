import App from './app'

import * as git from 'nodegit'

export interface ICommit {

}

export interface IChange {

}

export default class GitVersionning {
    repository: git.Repository
    branchRef: git.Reference

    constructor(private app: App) {
    }

    initialize():Promise<any> {
        return git.Repository.open(this.app.path).then(repo => {
            this.repository = repo
            return this.repository.getCurrentBranch()
        }).then(ref => {
            this.branchRef = ref
            return Promise.resolve(ref)
        })
    }

    changeBranch(branch: string):Promise<any> {
        return this.repository.checkoutBranch( branch, git.Checkout.STRATEGY.FORCE )
    }

    listBranches():Promise<string[]> {
        return this.repository.getReferenceNames(git.Reference.TYPE.LISTALL)
    }

    getStatus(): Promise<any[]> {
        return this.repository.getStatus(null)
    }

    getLatestCommits(): Promise<any> {
        return this.repository.getBranchCommit(this.branchRef).then(commit => {
            let hist = commit.history()
            let p = new Promise((resolve, reject) => {
                hist.on('end', resolve)
                hist.on('error', reject)
            })
            hist.start();
            return p;
        })
    }

    stageFiles(files: any[]): Promise<any> {
        return Promise.resolve()
    }

    stageAllFiles(): Promise<any> {
        return Promise.resolve()
    }

    stageFile(file: any): Promise<any> {
        return this.stageFiles([file])
    }

    commit(message, description): Promise<any> {
        return Promise.resolve()
    }

    pull(): Promise<any> {
        return Promise.resolve()
    }

    push(): Promise<any> {
        return Promise.resolve()
    }

    sync(): Promise<any> {
        return this.pull().then(() => {
            return this.push()
        })
    }
}