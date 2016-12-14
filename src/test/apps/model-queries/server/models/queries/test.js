module.exports = class TestModel {
	constructor(app, entity) {
		this.app = app
		this.entity = entity
		this.testObject = {
			param_number: 42,
			param_text: "foo",
			param_float: 0.5,
			param_date: new Date(10),
			bool_false: false,
			bool_true: true
		}
	}

	testRaw(params) {
		return this.testObject
	}

	testPromise(params) {
		return Promise.resolve(this.testObject)
	}

	testParam(params) {
		return params
	}

	testConstructor(params) {
		return {
			app_name: this.app.name,
			entity_name: this.entity.name
		}
	}
}