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
      components: {
        Header: './src/components/Header.astro',
      },
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
          label: 'Site guide',
          items: [{ autogenerate: { directory: 'site' } }],
        },
        {
          label: 'Nextcloud',
          items: [{ autogenerate: { directory: 'nextcloud' } }],
        },
      ],
    }),
  ],
});
