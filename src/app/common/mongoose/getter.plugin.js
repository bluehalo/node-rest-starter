/**
 * Mongoose Getter plugin
 *
 * configures schema to include getters in `toObject` and `toJSON`
 *
 * @param schema
 */
function getterPlugin(schema) {
	schema.set('toObject', { getters: true });
	schema.set('toJSON', { getters: true });
}

module.exports = getterPlugin;
