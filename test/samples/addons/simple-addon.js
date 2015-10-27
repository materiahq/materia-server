import MateriaAddon from 'materia-addon'

class SimpleAddon extends MateriaAddon {
	constructor(app) {
		super(app, 'Simple Addon')

		this.defineEndpoint('/test', (res, res) => {
			res.status(200).send('Hello World!!')
		});
	}
}
