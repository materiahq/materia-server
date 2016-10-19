import App from './app'

import * as git from 'nodegit'

export interface ICommit {

}

export interface IChange {

}

export default class Versionning {
    repository: git.Repository

    constructor(private app: App) {
    }

    initialize() {
        return git.Repository.open(this.app.path).then(repo => {
            this.repository = repo
            return this.repository.getCurrentBranch()
        })
    }

    changeBranch(branch: string) {
        this.repository.createBranch
    }

    getStatus(): Promise<any> {
        return Promise.resolve()
    }

    getLatestCommits(): Promise<any> {
        return Promise.resolve()
    }

    stageFiles(files: any[]): Promise<any> {
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