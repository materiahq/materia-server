import { IEndpoint, IParam } from '@materia/interfaces';

export class EndpointsLib {
	static list(app) {
		const endpoints: IEndpoint[] = app.api.findAll().map(api =>
			Object.assign({}, api.toJson(), {
				fromAddon: api.fromAddon
					? {
							name: api.fromAddon.name,
							logo: api.fromAddon.logo,
							package: api.fromAddon.package,
							path: api.fromAddon.path
					}
					: {},
				params: api.getAllParams(),
				data: api.getAllData()
			})
		);
		return endpoints;
	}
	static generate(app, entity, method, id) {
		if (
			entity.endpointsGenerated[id] &&
			entity.endpointsGenerated[id].enabled
		) {
			app.api.add(
				{
					method: method,
					url: entity.endpointsGenerated[id].url,
					query: {
						entity: entity.name,
						id: id
					}
				},
				{
					apply: true,
					save: true
				}
			);
		}
	}

	static cleanParams(params: IParam[]) {
		const cleanedParams = params.map(param => {
			if (param.value) {
				delete param.value;
			}
			if (param.checked) {
				delete param.checked;
			}
			return param;
		});
		return cleanedParams;
	}
}