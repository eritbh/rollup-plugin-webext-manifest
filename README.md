# rollup-plugin-webext-manifest

A [Rollup][rollup] plugin for processing [web extension manifest files][webext-manifest]. Allows you to write web extensions with ES6 modules and have them bundled for compatibility.

Inspired by [this Firefox bug][firefox-module-content-script].

[rollup]: https://www.rollupjs.org
[webext-manifest]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json
[firefox-module-content-script]: https://bugzilla.mozilla.org/show_bug.cgi?id=1536094

## Installation

```sh
# With Yarn
yarn add --dev rollup-plugin-webext-manifest
# With npm
npm install --save-dev rollup-plutin-webext-manifest
```

## Usage

### Overview

The plugin will look for entry points in the following parts of your `manifest.json`:

- The `js` array of [`content_scripts` objects][manifest-content-scripts]
- The `scripts` option of [the `background` object][manifest-background]

Paths are interpreted relative to the manifest's location. Notably, the plugin will *not* look for entry points in `web_accessible_resources`.

### Configuration

Add a configuration object to your `rollup.config.js` that takes your `manifest.json` as its only input. Include this module as the *first* plugin in your configuration. Set `targetPlatform` to one of `chrome` (Chrome) or `gecko` (Firefox). In output options, use `assetFileNames: '[name].[ext]'` to ensure the emitted manifest is called `manifest.json` (otherwise it won't be recognized).

A minimal example that builds the extension to the `build` directory:

```js
// rollup.config.js
import processManifest from 'rollup-plugin-webext-manifest';
export default {
  input: 'manifest.json',
  plugins: [
    processManifest({
      targetPlatform: 'gecko',
    }),
  ],
  output: {
    dir: 'build',
    assetFileNames: '[name].[ext]',
  },
};
```

The plugin takes a single object argument with the following options:

- **`targetPlatform`** (required)  
  One of `'chrome'` or `'gecko'` (i.e. Firefox).

- **`indent`** (optional)  
  Determines the indentation of the generated manifest. Takes the same form as the third argument to `JSON.stringify` (e.g. `2` for 2 spaces, `\t` for tabs, leave unset for no indentation, etc).

- **`geckoIncognitoSplitSubstitute`** (optional, default `'not_allowed'`)  
  [Firefox does not support the `split` value for the manifest `incognito` option.][gecko-incognito-split] When `targetPlatform` is `'gecko'`, if the `incognito` option is set to `split`, it will be replaced with the value of this option. The default, `'not_allowed'`, prevents the extension from loading at all in private browsing windows.

- **`writeAllBrowserSpecificSettings`** (optional, default `false`)  
  By default, the plugin will rewrite the `browser_specific_settings` manifest option to only include settings for the `targetPlatform`. Set this option to `true` to skip this and include all `browser_specific_settings` for all platforms.

[manifest-content-scripts]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts
[manifest-background]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background
[gecko-incognito-split]: https://bugzilla.mozilla.org/show_bug.cgi?id=1380812

### Plugin compatibility

Because this plugin splits the build process between multiple Rollup processes, more complicated plugins probably won't play nicely with it. Currently, plugins that specify `resolveId` or `load` hooks are run with the first build stage, and plugins that have neither of these hooks will run in the second stage.

If you require another plugin that doesn't work, or if you have a better idea of how to handle this, raise an issue and I'll see what I can do.

## Explanation

When rollup is run, the plugin will first perform a code-splitting build of all entry points. It will then build each emitted chunk, converting `import`/`export` to IIFEs that "import" and "export" code by reading and setting global variables. Finally, it will generate a new manifest file that includes the bundled outputs in the correct order to ensure dependencies are included before the files that depend on them. This strategy

## Contributing

Feel free to discuss your ideas in issues before spending the time to write a patch. Use yarn 1.x, not npm and not yarn 2.

Useful commands:

```sh
# Run eslint
yarn lint
# Run tests
yarn test
# Bundle the project for deployment to npm
yarn build
```
