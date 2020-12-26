# rollup-plugin-webext-manifest

Theoretically a [Rollup][rollup] plugin for processing [web extension manifest files][webext-manifest].

[rollup]: https://www.rollupjs.org
[webext-manifest]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json

## Installation

```sh
# With Yarn
yarn add --dev rollup-plugin-webext-manifest
# With npm
npm install --save-dev rollup-plutin-webext-manifest
```

## Usage

> you dont lol

Add a configuration object to your `rollup.config.js` that takes your `manifest.json` as its input and includes this plugin:

```js
// rollup.config.js
import processManifest from 'rollup-plugin-webext-manifest';
export default [
  {
    input: 'manifest.json',
    plugins: [
      processManifest({
        targetPlatform: 'gecko',
      }),
    ],
	output: {
		file: 'build/manifest.json'
	}
  },
];
```
