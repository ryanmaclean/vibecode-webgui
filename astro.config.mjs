import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  // Agent 4: Configuration for GitHub Pages
  site: 'https://vibecode.github.io', // Placeholder: Update if custom domain known
  base: '/vibecode-webgui',           // Placeholder: Update based on repo name
  
  integrations: [
    starlight({
      title: 'VibeCode Documentation',
      social: {
        github: 'https://github.com/vibecode/vibecode-webgui',
      },
      sidebar: [
        {
          label: 'Guides',
          items: [
            // Auto-generate would be nice, but explicit is safer for now
            { label: 'Introduction', link: '/intro' },
          ],
        },
      ],
    }),
  ],
});
