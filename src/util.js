export function cleanManifest (manifest, {
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

export function globalExportsVariableName (chunkPathThing) {
	return `__rollupWebextManifest__${chunkPathThing.replace(/[^a-z0-9_]/gi, '_')}__`;
}

export function flattenedImportsList (bundle, chunkPathThing) {
	const chunk = bundle[chunkPathThing];
	const nestedImports = chunk.imports.map(importee => flattenedImportsList(bundle, importee));
	return [].concat(...nestedImports, [chunkPathThing]).filter((val, i, arr) => arr.indexOf(val) === i);
}
