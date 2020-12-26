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

const varNameCache = new Map();
export function globalExportsVariableName (chunkPathThing) {
	const existing = varNameCache.get(chunkPathThing);
	if (existing != null) {
		return existing;
	}
	let name = `__rollupWebextManifest__${chunkPathThing.replace(/[^a-z0-9_]/gi, '_')}__`;
	// eslint-disable-next-line no-loop-func
	while ([...varNameCache.values()].some(val => val === name)) {
		name += '_';
	}
	varNameCache.set(chunkPathThing, name);
	return name;
}

export function flattenedImportsList (bundle, chunkPathThing) {
	const chunk = bundle[chunkPathThing];
	const nestedImports = chunk.imports.map(importee => flattenedImportsList(bundle, importee));
	return [].concat(...nestedImports, [chunkPathThing]).filter((val, i, arr) => arr.indexOf(val) === i);
}
