var expect = require('chai').expect
var Conditions = require('../lib/entities/db-entity/query/utils/conditions')
var Condition = require('../lib/entities/db-entity/query/utils/condition')

var conditions;
var condition;
describe('Conditions', () => {
	describe('Initialize', () => {
		it('should create an empty condition', (done) => {
			conditions = new Conditions()
			expect(conditions.conditions.length).to.equal(0)
			done()
		})
		it('should create a simple condition', (done) => {
			conditions = new Conditions([
				{
					"name": "slug",
					"operator": "=",
					"value": "="
				}
			])
			expect(conditions.conditions.length).to.equal(1)
			//expect(conditions.conditions[0].name).to.equal('slug')
			expect(conditions.toJson()).to.deep.equal([
				{
					"name": "slug",
					"operator": "=",
					"value": "="
				}
			])
			let toSeq = conditions.toSequelize({
				slug: 'test'
			})
			expect(toSeq.length).to.equal(2)
			expect(toSeq[0]).to.not.be.empty
			done()
		})

		it('should throw an error if it miss a required parameters', (done) => {
			try {
				conditions = new Conditions([
					{
						"name": "slug",
						"optaeerator": "=",
						"value": "="
					}
				])
				return done('no error has been thrown (operator passed is null)')
			}
			catch (e) {
			}
			try {
				conditions = new Conditions([
					{
						"name": "slug",
						"operator": "=",
						"value2": "="
					}
				])
				return done('no error has been thrown (value passed is null)')
			}
			catch (e) {
			}
			try {
				conditions = new Conditions([
					{
						"name2": "slug",
						"operator": "=",
						"value": "="
					}
				])
				return done('no error has been thrown (name passed is null)')
			}
			catch (e) {
			}
			done()
		})

		//TODO: test complex condition with operand and priority

		after(() => {
		})
	})
})
