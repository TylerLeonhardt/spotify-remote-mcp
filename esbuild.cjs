const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * This plugin hooks into the build process to print errors in a format that the problem matcher in
 * Visual Studio Code can understand.
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};


async function main() {
	const ctx = await esbuild.context({
		bundle: true,
		define: { 'process.env.NODE_ENV': '"production"' },
		entryPoints: ['src/index.ts'],
		external: [],
		format: 'cjs',
		logLevel: 'silent',
		minify: production,
		outfile: 'dist/index.js',
		platform: 'node',
		plugins: [ esbuildProblemMatcherPlugin ],
		sourcemap: !production,
		sourcesContent: false,
		target: 'node20',
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
