import fs from 'fs';
import {resolve} from 'path';
import util from 'util';
import {rollup} from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
const readFile = util.promisify(fs.readFile);

const PLUGIN_NAME = 'webext-manifest';

function cleanManifest (manifest, {
	targetPlatform,
	writeAllBrowserSpecificSettings,
	geckoIncognitoSplitSubstitute,
}) {
	// Only include `browser_specific_settings` for current platform
	if (!writeAllBrowserSpecificSettings && manifest.browser_specific_settings) {
		if (manifest.browser_specific_settings[targetPlatform]) {
			manifest.browser_specific_settings = {
				[targetPlatform]: manifest.browser_specific_settings[targetPlatform],
			};
		} else {
			delete manifest.browser_specific_settings;
		}
	}

	// Replace incognito: split for Firefox
	// https://bugzilla.mozilla.org/show_bug.cgi?id=1380812
	// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/incognito
	if (geckoIncognitoSplitSubstitute && manifest.incognito === 'split' && targetPlatform === 'gecko') {
		manifest.incognito = geckoIncognitoSplitSubstitute;
	}
	return manifest;
}

function globalExportsVariableName (chunkPathThing) {
	return `__rollupWebextManifest__${chunkPathThing.replace(/[^a-z0-9_]/gi, '_')}__`;
}

function flattenedImportsList (bundle, chunkPathThing) {
	const chunk = bundle[chunkPathThing];
	const nestedImports = chunk.imports.map(importee => flattenedImportsList(bundle, importee));
	return [].concat(...nestedImports, [chunkPathThing]).filter((val, i, arr) => arr.indexOf(val) === i);
}

console.group('flattening test');
const bundle = {
	a: {imports: ['b', 'c']},
	b: {imports: ['c', 'd']},
	c: {imports: ['e']},
	d: {imports: []},
	e: {imports: []},
};
console.log(flattenedImportsList(bundle, 'a'));
console.groupEnd();
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
export default function webextensionManifest ({
	targetPlatform,
	indent = undefined,
	geckoIncognitoSplitSubstitute = 'not_allowed',
	writeAllBrowserSpecificSettings = false,
}) {
	if (!targetPlatform) {
		throw new Error('targetPlatform option is required for webextension-manifest.');
	}

	// We get this at the options step but don't emit it until the end of the build
	let manifestLocation;
	let manifestContent;
	// We store the options passed to the initial Rollup process, completely
	// replace them with our own, then reuse them for the later Rollup processes
	let originalOptions;
	// A list of manifest chunk IDs so we only process the things we care about
	const manifestScriptIDs = [];

	// Code references to the manifest are resolved at runtime
	function load (id) {
		if (id !== manifestLocation) {
			return null;
		}
		return 'export default (browser || chrome).runtime.getManifest();';
	}

	return {
		name: PLUGIN_NAME,
		async options (originals) {
			originalOptions = originals;
			if (typeof originalOptions.input === 'string') {
				manifestLocation = resolve(__dirname, originalOptions.input);
			} else {
				throw new Error('shrug');
			}
			try {
				manifestContent = JSON.parse(await readFile(manifestLocation));
			} catch (error) {
				throw new Error('Failed to load manifest');
			}
			// The directory the manifest file is in
			const rootSearchPath = resolve(manifestLocation, '..');

			const options = {
				input: [],
				plugins: originalOptions.plugins,
				output: {
					format: 'es',
				},
			};

			(manifestContent.content_scripts || []).forEach(({js}) => {
				js.forEach(filename => {
					const id = resolve(rootSearchPath, filename);
					manifestScriptIDs.push(id);
					options.input.push(id);
				});
				// TODO: also do CSS
			});

			return options;
		},

		// Code references to the manifest are resolved at runtime
		load,

		async generateBundle (options, bundle) {
			console.log();
			console.log(bundle);
			for (const [chunkPathThing, chunk] of Object.entries(bundle)) {
				console.log();
				console.group(chunkPathThing);
				console.log(chunk);
				// eslint-disable-next-line no-await-in-loop
				const newBundle = await rollup({
					plugins: [
						// a plugin whose only job is to emit the file we're processing
						{
							name: 'inject',
							buildStart () {
								this.emitFile({
									type: 'chunk',
									id: chunkPathThing,
									name: chunk.name,
								});
								console.log('test');
							},

							resolveId (id) {
								// TODO
								const result = id.replace('./', '');
								console.log('resolving', id, 'to', result);
								return result;
							},
							// Code references to the manifest are resolved at runtime
							load (id) {
								console.log('loading', id);
								if (id === chunkPathThing) {
									console.log('Requested file is entry point, returning itself');
									return bundle[id].code;
								}
								console.log('Shimming', bundle[id].exports);
								return `
									const {${bundle[id].exports.join(', ')}} = window.${globalExportsVariableName(id)};
									export {${bundle[id].exports.join(', ')}};
								`;
							},
						},
						nodeResolve(),
					],
				});
				// eslint-disable-next-line no-await-in-loop
				const {output} = await newBundle.generate({
					format: 'iife',
					name: globalExportsVariableName(chunkPathThing),
				});
				console.group('OUTPUT');
				console.log(output.map(o => o.code).join('\n\n---[NEW OUTPUT]---\n\n'));
				if (output.length > 1) {
					console.log('Weird multiple outputs, this is bad');
				} else {
					bundle[chunkPathThing].code = output[0].code;
				}
				console.groupEnd();
				console.groupEnd();
			}

			// Update paths in manifest
			console.group('Updating manifest paths');
			for (const script of manifestContent.content_scripts) {
				let newScriptFiles = [];
				for (const file of script.js) {
					const flattened = flattenedImportsList(bundle, file);
					console.log(file, 'becomes', flattened);
					newScriptFiles = newScriptFiles.concat(flattened);
				}
				script.js = newScriptFiles.filter((val, i, arr) => arr.indexOf(val) === i);
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
