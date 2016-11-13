import App from '../app'

export interface IPermission {
	name: string,
	description: string,
	middleware: (req:any, res:any, next:any) => any
}

/**
 * @class Permissions
 * @classdesc
 * This class is used to set filters to the endpoints.
 */
export class Permissions {
	permissions: IPermission[];

	constructor(private app: App) {
		this.app = app
		this.clear()
	}

	isAuthorized(permission) {

	}

	check(permissionsName:Array<string>) {
		return (req, res, next) => {
			let chain = (req, res, next) => { next() }

			let rev_permissions = permissionsName.reverse()

			rev_permissions.every(permissionName => {
				let permission = this.permissions.find(permission => permission.name == permissionName)

				if ( ! permission) {
					next(new Error('Could not find permission "' + permissionName + '"'))
					return false
				}

				let nextchain = chain
				chain = (req, res, next) => {
					let _next = (e) => {
						if (e) {
							return res.status(500).json(JSON.stringify(e.message));
						}
						nextchain(req, res, next)
					}
					permission.middleware(req, res, _next)
				}
				return true
			})
			chain(req,res,next)
		}
	}

	/**
	Remove all permissions
	*/
	clear():void {
		this.permissions = []
		this.add('Anyone', 'Anyone can access without restriction endpoints which have the "Anyone" permission', (req,res,next) => { return next() })
	}

	/**
	Get all the registered permissions
	@returns {Array<IPermission>}
	*/
	findAll():Array<IPermission> {
		return this.permissions
	}

	/**
	Get a permission's object
	@param {string} - The filter name
	@returns {function}
	*/
	get(name) {
		return this.permissions.find(permission => {
			return permission.name == name
		})
	}

	/**
	Add a permission.
	@param {string} - The filter name
	@param {function} - The function to execute when an endpoint uses this filter
	*/
	add(name, desc, middlewareFn):Promise<void> {
		if (this.permissions.find(permission => {
			return permission.name == name
		})) {
			return Promise.reject(new Error(`The permission ${name} already exists`))
		}
		this.permissions.push({
			name: name,
			description: desc,
			middleware: middlewareFn
		})
		return Promise.resolve();
	}

	/**
	Remove a filter
	@param {string} - The filter name
	*/
	remove(name):void {
		let index = this.permissions.indexOf(
			this.permissions.find(permission => {
				return permission.name == name
			})
		)
		if (index != -1) {
			this.permissions.splice(index, 1)
		}
	}
}