
import { existsSync, promises as fs } from 'fs';
import { fileURLToPath, URL } from 'url';
import babel from '@babel/core';

const EXTN = /\.\w+(?=\?|$)/;
const isTS = /\.[mc]?tsx?(?=\?|$)/;

function check(fileurl) {
	let tmp = fileURLToPath(fileurl);
	if (existsSync(tmp)) return fileurl;
}

/**
 * extension aliases; runs after checking for extn on disk
 * @example `import('./foo.mjs')` but only `foo.mts` exists
 */
const MAPs = {
	'.js': ['.ts', '.tsx', '.jsx'],
	'.jsx': ['.tsx'],
	'.mjs': ['.mts'],
	'.cjs': ['.cts'],
};

const root = new URL('file://' + process.cwd() + '/');
const pkgName = '@native-router/react';
export async function resolve(ident, context, fallback) {
  if (ident.startsWith('@/')) console.log('----')

	// ignore "prefix:" and non-relative identifiers
	if (/^\w+\:?/.test(ident)) return fallback(ident, context, fallback);

  const target = new URL(ident, context.parentURL || root);

	let ext, path, arr;
	let match, i=0, base;

	// source ident includes extension
	if (match = EXTN.exec(target.href)) {
		ext = match[0];
		if (!context.parentURL || isTS.test(ext)) {
			return { url: target.href, shortCircuit: true };
		}

		// target ident exists
		if (path = check(target.href)) {
			return { url: path, shortCircuit: true };
		}

		// target is virtual alias
		if (arr = MAPs[ext]) {
			base = target.href.substring(0, match.index);
			for (; i < arr.length; i++) {
				if (path = check(base + arr[i])) {
					i = match.index + ext.length;
					return {
						shortCircuit: true,
						url: i > target.href.length
							// handle target `?args` trailer
							? base + target.href.substring(i)
							: path
					};
				}
			}
		}

		// return original behavior, let it error
		return fallback(ident, context, fallback);
	}

	for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
		path = check(target.href + ext);
		if (path) return { url: path, shortCircuit: true };
	}

	return fallback(ident, context, fallback);
}

export const load = async function (uri, context, fallback) {
	if (!/\.tsx?$/.test(uri)) return fallback(uri, context);
	let format = 'module';

	// TODO: decode SAB/U8 correctly
	let path = fileURLToPath(uri);
	let source = await fs.readFile(path, 'utf8');

	// note: inline `transformSource`
	let result = await babel.transformAsync(source, {filename: path, sourceMaps: 'inline'});

	return { format, source: result.code, shortCircuit: true };
}
