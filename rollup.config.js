export default {
	external: [
		// node
		'fs',
		'path',
		'util',
		// npm
		'rollup',
	],
	input: 'src/index.js',
	output: {
		file: 'dist/index.js',
		format: 'cjs',
		exports: 'default',
	},
};
