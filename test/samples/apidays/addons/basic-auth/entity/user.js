module.exports = {
	name: 'user',
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
			"name": "email",
			"type": "text",
			"required": true,
			"primary": false,
			"unique": true,
			"default": false,
			"autoIncrement": false,
			"read": true,
			"write": true
		},
		{
			"name": "pass",
			"type": "text",
			"required": true,
			"primary": false,
			"unique": false,
			"default": false,
			"autoIncrement": false,
			"read": true,
			"write": true
		}
	],
	relations: [],
	queries: [
		{
			"id": "auth",
			"type": "custom",
			"opts": {
				"file": "addons/basic-auth/query/auth"
			}
		},
		{
			"id": "create",
			"type": "create",
			"opts": {
				"default": true
			}
		},
	]
}
