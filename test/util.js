import test from 'ava';
import {
	flattenedImportsList,
	globalExportsVariableName,
} from '../src/util.js';

test.todo('cleanManifest');

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

test('flattenedImportsList', t => {
	const cases = [
		[
			{
				a: {imports: ['b', 'c']},
				b: {imports: ['c']},
				c: {imports: ['d', 'e']},
				d: {imports: []},
				e: {imports: []},
			},
			'a',
			['d', 'e', 'c', 'b', 'a'],
		],
	];

	for (const [bundle, entry, output] of cases) {
		t.deepEqual(flattenedImportsList(bundle, entry), output);
	}
});
