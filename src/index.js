import fs from 'fs';
import {resolve} from 'path';
import util from 'util';
import {rollup} from 'rollup';
const readFile = util.promisify(fs.readFile);

import {
	cleanManifest,
	flattenedImportsList,
	globalExportsVariableName,
} from './util';
import stageTwoPlugin from './pluginInternal';

/**
 * @param {object} options
 * @param {'gecko' | 'chrome'} options.targetPlatform
 * The target platform.
 * @param {number | string} [options.indent]
 * Passed to `JSON.stringify()` to set how the output is indented.
 * @param {string | false} [options.geckoIncognitoSplitSubstitute = 'not_allowed']
 * If target platform is Firefox and the manifest specifies the `split`
 * incognito mode, replace it with this value. Defaults to `not_allowed` to
 * avoid conflicts where content scripts assume background page state won't be
 * shared between browsing contexts. Set to `false` to disable this behavior.
 * @param {boolean} [options.writeAllBrowserSpecificSettings = false]
 * If true, all keys of `browser_specific_settings` will be included in the
 * output, not just those for the target platform.
 * @returns {object}
 */
export default function webextManifest ({
	targetPlatform,
	indent = undefined,
	geckoIncognitoSplitSubstitute = 'not_allowed',
	writeAllBrowserSpecificSettings = false,
}) {
	if (!targetPlatform) {
		throw new Error('targetPlatform option is required for plugin webext-manifest.');
	}

	// The plugin yeets the user's configuration (except for some plugins used
	// for module resolution), and instead loads entry points from the manifest,
	// processing them in code-splitting mode and outputting modules. Then, for
	// every entry point, it runs an additional rollup process using the user's
	// existing configuration (except without the module resolution plugins that
	// already ran) to convert modules to IIFE-based code. Entirely custom
	// module resolution is used to load dependencies from global variables.
	// Finally, the manifest is rewritten to include the code-split chunks and
	// ensure that files are ordered after their dependencies in the manifest.

	let manifestLocation;
	let manifestContent;

	// We store the options passed to the initial Rollup process, completely
	// replace them with our own, then process
	let originalOptions;

	// A list of manifest chunk IDs so we only process the things we care about
	const manifestEntryIDs = [];

	return {
		name: 'webext-manifest',

		async options (originals) {
			// Store the original set of options
			originalOptions = originals;

			// Get the manifest location from the input option
			if (typeof originalOptions.input === 'string') {
				manifestLocation = resolve(process.cwd(), originalOptions.input);
			} else {
				throw new Error('Manifest should be the only entry point');
			}

			// Load the manifest
			try {
				manifestContent = JSON.parse(await readFile(manifestLocation));
			} catch (error) {
				throw new Error('Failed to load manifest');
			}

			// Get the manifest's directory; relative paths always start here
			const rootSearchPath = resolve(manifestLocation, '..');

			// Gather all entry points specified in the manifest
			(manifestContent.content_scripts || []).forEach(({js}) => {
				js.forEach(filename => {
					const id = resolve(rootSearchPath, filename);
					manifestEntryIDs.push(id);
				});
				// TODO: also do CSS and stuff
			});
			(manifestContent.background?.scripts || []).forEach(filename => {
				const id = resolve(rootSearchPath, filename);
				manifestEntryIDs.push(id);
			});

			// Overwrite the options for the current build
			return {
				// All entry points get processed so code splitting can happen
				input: manifestEntryIDs,
				// If plugins specify resolve or load hooks, they need to be run
				// with the first build; other plugins aren't applied until the
				// final step
				plugins: originalOptions.plugins.filter(p => p.resolveId || p.load),
				// The first build just does code splitting and outputs with
				// `format: 'es'`; other output options are held for the end
				output: {
					format: 'es',
				},
			};
		},

		load (id) {
			// Code references to the manifest are resolved at runtime
			if (id === manifestLocation) {
				return 'export default (browser || chrome).runtime.getManifest();';
			}
			// Other modules are loaded normally
			return null;
		},

		async generateBundle (options, generateFromBundle) {
			// For every emitted chunk, run rollup again with a different
			// configuration to convert module import/export to global variable
			// references and IIFE code
			await Promise.all(Object.entries(generateFromBundle).map(async ([chunkPathThing, chunk]) => {
				// Generate a new bundle for this entry
				const newBundle = await rollup({
					// TODO: actually pass original input options
					plugins: [
						// This plugin is responsible for actually performing
						// the transformations we need
						stageTwoPlugin(generateFromBundle, chunkPathThing, chunk),
						// All other plugins specified in config (other than
						// module resolution ones) are also applied in this step
						...originalOptions.plugins.filter(p => !p.resolveId && !p.load),
					],
				});

				// Get the output of the bundle
				const {output} = await newBundle.generate({
					// TODO: actually pass original output options
					format: 'iife',
					name: globalExportsVariableName(chunkPathThing),
				});

				// Overwrite emitted code for this chunk
				if (output.length > 1) {
					throw new Error('Weird multiple outputs, this is bad');
				} else {
					generateFromBundle[chunkPathThing].code = output[0].code;
					// TODO: sourcemap support
					generateFromBundle[chunkPathThing].map = null;
				}
			}));

			// Rewrite manifest paths to include chunk dependencies
			for (const script of manifestContent.content_scripts || []) {
				let newScriptFiles = [];
				for (const file of script.js) {
					const flattened = flattenedImportsList(generateFromBundle, file);
					newScriptFiles = newScriptFiles.concat(flattened);
				}
				script.js = newScriptFiles.filter((val, i, arr) => arr.indexOf(val) === i);
			}
			if (manifestContent.background?.scripts) {
				let newScriptFiles = [];
				for (const file of manifestContent.background.scripts) {
					const flattened = flattenedImportsList(generateFromBundle, file);
					newScriptFiles = newScriptFiles.concat(flattened);
				}
				manifestContent.background.scripts = newScriptFiles;
			}

			// Emit the manifest as an asset
			this.emitFile({
				type: 'asset',
				name: 'manifest.json',
				source: JSON.stringify(cleanManifest(manifestContent, {
					targetPlatform,
					writeAllBrowserSpecificSettings,
					geckoIncognitoSplitSubstitute,
				}), null, indent),
			});
		},
	};
}
