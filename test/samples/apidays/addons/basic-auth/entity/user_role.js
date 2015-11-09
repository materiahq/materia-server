module.exports = {
	name: 'user_role',
	fields: [
		{
			"name": "id",
			"type": "number",
			"required": true,
			"primary": true,
			"unique": true,
			"default": false,
			"autoIncrement": true,
			"read": true,
			"write": false
		},
		{
			"name": "id_user",
			"type": "number",
			"required": true,
			"primary": false,
			"unique": false,
			"default": false,
			"autoIncrement": false,
			"read": true,
			"write": true
		},
		{
			"name": "role",
			"type": "text",
			"required": false,
			"primary": false,
			"unique": false,
			"default": true,
			"autoIncrement": false,
			"read": true,
			"write": true,
			"defaultValue": "user"
		}
	],
	relations: [
		{
			"field": "id_user",
			"reference": {
				"entity": "user",
				"field": "id"
			}
		}
	],
	queries: [
		{
			"id": "create",
			"type": "create",
			"opts": {
				"default": true
			}
		},
		{
			"id": "getUserRoles",
			"type": "findAll",
			"params": [
				{
					"name": "id_user",
					"type": "text",
					"required": true
				}
			],
			"opts": {
				"conditions": [
					{
						"name": "id_user",
						"operator": "=",
						"value": "="
					}
				]
			}
		}
	]
}
