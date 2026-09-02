import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.antblu.net',
  integrations: [
    starlight({
      title: 'Antalos',
      description: 'Operations and recovery documentation for the Antalos homelab Kubernetes platform.',
      favicon: '/favicon.svg',
      customCss: ['./src/styles/antalos.css'],
      editLink: {
        baseUrl: 'https://github.com/antblu/antalos/edit/main/docs/',
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/antblu/antalos',
        },
      ],
      sidebar: [
        { label: 'Overview', link: '/' },
        {
          label: 'Deployment guide',
          items: [{ autogenerate: { directory: 'deployment-guide' } }],
        },
        {
          label: 'Operations',
          items: [{ autogenerate: { directory: 'operations' } }],
        },
        {
          label: 'Recovery',
          items: [{ autogenerate: { directory: 'recovery' } }],
        },
        {
          label: 'Nextcloud',
          items: [{ autogenerate: { directory: 'nextcloud' } }],
        },
      ],
    }),
  ],
});
