import {globalExportsVariableName} from './util';

export default function webextManifestSecondStagePlugin (bundle, chunkId, chunk) {
	return {
		name: 'webext-manifest-internal',
		buildStart () {
			this.emitFile({
				type: 'chunk',
				id: chunkId,
				name: chunk.name,
			});
		},

		resolveId (id) {
			// TODO
			const result = id.replace('./', '');
			return result;
		},
		load (id) {
			// The entry point is loaded from the output of the initial bundle
			if (id === chunkId) {
				return bundle[id].code;
			}

			// Dependencies aren't explicitly imported from this file, but included before it in the
			// manifest. Their values will be read from global variables.
			// TODO: default exports
			return `
				const {${bundle[id].exports.join(', ')}} = ${globalExportsVariableName(id)};
				export {${bundle[id].exports.join(', ')}};
			`;
		},
	};
}
