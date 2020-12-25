import fs from 'fs';
import {resolve} from 'path';
import util from 'util';
const readFile = util.promisify(fs.readFile);

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

	return {
		name: 'webextension-manifest',
		async options (options) {
			if (typeof options.input === 'string') {
				manifestLocation = resolve(__dirname, options.input);
			} else {
				throw new Error('shrug');
			}
			try {
				manifestContent = JSON.parse(await readFile(manifestLocation));
			} catch (error) {
				throw new Error('Failed to load manifest');
			}
			const rootSearchPath = resolve(manifestLocation, '..');

			options.input = [];
			(manifestContent.content_scripts || []).forEach(({js}) => {
				js.forEach(filename => {
					// options.input.push(resolve(rootSearchPath, filename));
					options.input = resolve(rootSearchPath, filename);
				});
			});

			return options;
		},
		load (id) {
			if (id !== manifestLocation) {
				return null;
			}
			return 'export default (browser || chrome).runtime.getManifest();';
		},
		buildEnd () {
			// Only include `browser_specific_settings` for current platform
			if (!writeAllBrowserSpecificSettings && manifestContent.browser_specific_settings) {
				if (manifestContent.browser_specific_settings[targetPlatform]) {
					manifestContent.browser_specific_settings = {
						[targetPlatform]: manifestContent.browser_specific_settings[targetPlatform],
					};
				} else {
					delete manifestContent.browser_specific_settings;
				}
			}

			// Replace incognito: split for Firefox
			// https://bugzilla.mozilla.org/show_bug.cgi?id=1380812
			// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/incognito
			if (geckoIncognitoSplitSubstitute && manifestContent.incognito === 'split' && targetPlatform === 'gecko') {
				manifestContent.incognito = geckoIncognitoSplitSubstitute;
			}

			// Emit the manifest as an asset
			this.emitFile({
				type: 'asset',
				name: 'manifest.json',
				source: JSON.stringify(manifestContent, null, indent),
			});
		},
	};
}
