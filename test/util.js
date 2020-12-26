import test from 'ava';
import {cleanManifest, globalExportsVariableName} from '../src/util.js';

test('cleanManifest', t => {
	const cases = [
		[[{}, {}], {}],
	];

	for (const [inputs, output] of cases) {
		t.deepEqual(cleanManifest(...inputs), output);
	}
});

test('globalExportsVariableName', t => {
	const cases = [
		['something_Normal', '__rollupWebextManifest__something_Normal__'],
		['something with spaces', '__rollupWebextManifest__something_with_spaces__'],
		['ĦĔĽĻŎ', '__rollupWebextManifest_________'],
	];
	for (const [input, output] of cases) {
		t.is(globalExportsVariableName(input), output);
		t.regex(output, /^[a-z_$][0-9a-z_$]*$/i);
	}
});

test('globalExportsVariableName collision resolution', t => {
	t.not(globalExportsVariableName('!'), globalExportsVariableName('@'));
	t.is(globalExportsVariableName('!'), globalExportsVariableName('!'));
});
