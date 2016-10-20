import App from './app'


export default class GitVersionning {


    constructor(private app: App) {
    }

    initialize():Promise<any> {
        return Promise.resolve()
    }

}