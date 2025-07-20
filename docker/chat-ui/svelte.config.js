import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-node for production builds
		adapter: adapter({
			out: 'build',
			precompress: false,
			envPrefix: ''
		}),
		
		// Configure trusted origins for VibeCode platform
		csrf: {
			checkOrigin: process.env.NODE_ENV === 'production'
		},

		// Environment variable handling
		env: {
			publicPrefix: 'PUBLIC_',
			privatePrefix: ''
		}
	}
};

export default config;