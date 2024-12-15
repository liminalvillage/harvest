import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	optimizeDeps: {
		include: ['svelte'],
		exclude: ['@sveltejs/kit']
	},
	resolve: {
		dedupe: ['svelte']
	},
	server: {
		fs: {
			strict: false
		}
	}
});
