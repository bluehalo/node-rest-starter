import { Schema } from 'mongoose';

/**
 * Mongoose Getter plugin
 *
 * configures schema to include getters in `toObject` and `toJSON`
 *
 */
export = function getterPlugin(schema: Schema) {
	schema.set('toObject', { getters: true });
	schema.set('toJSON', { getters: true });
};
