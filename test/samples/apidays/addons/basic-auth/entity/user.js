module.exports = {
	fields: [
		{
			name: "id",
			type: "number",
			autoIncrement: true,
			unique: true,
			primary: true,
			required: false
		},
		{
			name: "email",
			type: "text",
			required: true
		},
		{
			name: "pass",
			type: "text",
			required: true
		},
		{
			name: "role",
			type: "text",
			required: false,
			default: true,
			defaultValue: 'user'
		}
	],
	relations: []
}
