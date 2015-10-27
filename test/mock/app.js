var mockApp = {
	on: function(eventName, callback) {
		if ( ! this.listeners ) {
			this.listeners = {}
		}
		if ( ! this.listeners[eventName]) {
			this.listeners[eventName] = []
		}
		this.listeners[eventName].push(callback)
	},

	emit: function(eventName, data) {
		if (this.listeners && this.listeners[eventName]) {
			this.listeners[eventName].forEach((listener) => {
				listener(data)
			})
		}
	},
	path: __dirname + '/../samples/error-app',
	mode: 'dev',
	entities: {
		sync: () => {

		}
	}
}

module.exports = mockApp
