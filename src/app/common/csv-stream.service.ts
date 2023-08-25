import { Transform } from 'stream';

import stringify from 'csv-stringify';
import jsonpath from 'jsonpath';
import _ from 'lodash';
import pipe from 'multipipe';
import through2 from 'through2';

import { logger } from '../../dependencies';
import { ExportColumnDef } from '../core/export/export-config.model';

class CsvStreamService {
	/**
	 * Creates a stream that accepts objects as input and returns a serialized CSV file.
	 * The objects in the stream can come directly from Mongo.
	 *
	 * @param columns An array defining the columns to output in the CSV, in order.
	 *   Each object must contain:
	 *     - key: A JSONPath selector to get the value for this column from the object
	 *     - title: The title to use in the CSV header for the column
	 *     - callback: Optionally, a function to do further processing of the value.  It must accept a value
	 *         and return a value.
	 * @returns A stream that can be piped to the HTTP response.
	 */
	streamToCsv(columns: ExportColumnDef[]): Transform {
		// Create a stream to turn Mongo records into CSV rows
		const stream = through2.obj((chunk, enc, callback) => {
			const row = [];

			// Turn Mongo models into actual objects so JSONPath can work with them
			if (null != chunk.toObject) {
				chunk = chunk.toObject();
			}

			columns.forEach((column) => {
				if (_.has(column, 'key')) {
					// Get the value from the object using jsonpath
					let value = jsonpath.value(chunk, `$.${column.key}`);

					// Invoke any callback associated with the column
					if (_.has(column, 'callback')) {
						value = column.callback(value, chunk);
					}

					// Emit a blank column rather than null/undefined
					row.push(value ?? '');
				}
			});

			// Emit the row to the output stream, piped to the CSV stringifier
			callback(null, row);
		});

		// Parse the columns array into a format the CSV stringify module is expecting
		const csvColumns = [];
		columns.forEach((value) => {
			if (_.has(value, 'title')) {
				csvColumns.push(value.title);
			}
		});

		// Assemble the CSV headers and stream the CSV response back to the client
		const csv = stringify({
			header: true,
			columns: csvColumns
		});

		// Create an output stream piping the parsing stream to the CSV stream
		const out = pipe(stream, csv);

		out.on('error', (err) => logger.error(err, 'Failed to create CSV'));

		return out;
	}
}

export = new CsvStreamService();
