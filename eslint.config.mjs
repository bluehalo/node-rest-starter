import eslint from '@eslint/js';
import eslintPluginImport from 'eslint-plugin-import';
import eslintPluginNode from 'eslint-plugin-n';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: [
			'src/migrations/sample-migration.ts',
			// Ignore artifacts
			'.nyc_output/',
			'build/',
			'coverage/',
			'dist/',
			'node_modules/',
			// IDE/Editor config
			'.vscode/'
		]
	},
	eslint.configs.recommended,
	tseslint.configs.recommended,
	eslintPluginPrettierRecommended,
	eslintPluginImport.flatConfigs.recommended,
	eslintPluginImport.flatConfigs.typescript,
	eslintPluginNode.configs['flat/recommended'],
	eslintPluginUnicorn.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.builtin,
				...globals.node,
				...globals.mocha
			},
			ecmaVersion: 2020,
			sourceType: 'module'
		},
		rules: {
			// eslint
			eqeqeq: ['error', 'smart'],
			'guard-for-in': ['error'],
			'no-await-in-loop': ['error'],
			'no-console': ['warn'],
			'no-else-return': ['error'],
			'no-new-wrappers': ['error'],
			'no-path-concat': ['warn'],
			'no-template-curly-in-string': ['error'],
			'no-throw-literal': ['error'],
			'no-unused-vars': ['off'], // Disabling in favor of typescript-eslint version
			'no-var': ['error'],
			'prefer-const': ['error'],
			'prefer-destructuring': [
				'error',
				{
					object: false,
					array: true
				}
			],
			'prefer-numeric-literals': ['error'],
			'prefer-promise-reject-errors': ['error'],
			'prefer-rest-params': ['error'],
			'prefer-spread': ['error'],
			'prefer-template': ['error'],
			'require-await': ['error'],
			'prettier/prettier': ['error'],
			// eslint-plugin-import
			'import/order': [
				'error',
				{
					groups: [
						['builtin'],
						['external'],
						['internal', 'parent', 'sibling']
					],
					'newlines-between': 'always',
					alphabetize: {
						order: 'asc',
						caseInsensitive: true
					}
				}
			],
			'import/no-unresolved': ['off'],
			// eslint-plugin-n
			'n/callback-return': ['warn'],
			'n/no-missing-import': ['off'],
			'n/no-new-require': ['warn'],
			'n/no-path-concat': ['warn'],
			'n/no-process-exit': ['off'],
			// @typescript-eslint
			'@typescript-eslint/no-empty-function': ['error'],
			'@typescript-eslint/no-unused-vars': ['error'],
			// eslint-plugin-unicorn
			'unicorn/custom-error-definition': ['error'],
			'unicorn/filename-case': ['off'],
			'unicorn/no-anonymous-default-export': ['off'],
			'unicorn/no-array-callback-reference': ['off'],
			'unicorn/no-null': ['off'],
			'unicorn/no-process-exit': ['off'],
			'unicorn/no-this-assignment': ['off'],
			'unicorn/no-useless-promise-resolve-reject': ['off'],
			'unicorn/no-useless-undefined': ['off'],
			'unicorn/prefer-event-target': ['off'],
			'unicorn/prefer-export-from': ['off'],
			'unicorn/prefer-module': ['off'],
			'unicorn/prefer-number-properties': ['off'],
			'unicorn/prefer-ternary': ['off'],
			'unicorn/prefer-top-level-await': ['off'],
			'unicorn/prevent-abbreviations': ['off']
		}
	},
	{
		files: ['src/dependencies.ts'],
		linterOptions: {
			reportUnusedDisableDirectives: 'off'
		},
		rules: {
			'unicorn/no-abusive-eslint-disable': ['off']
		}
	},
	{
		files: ['src/migrations/**/*'],
		rules: {
			'n/no-extraneous-import': ['off']
		}
	},
	{
		files: ['src/cli/**/*'],
		rules: {
			'n/hashbang': ['off'],
			'n/no-extraneous-require': ['off'],
			'@typescript-eslint/no-require-imports': ['off']
		}
	}
);
