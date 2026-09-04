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
        ThemeSelect: './src/components/ThemeToggle.astro',
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
          items: [
            { label: 'Workstation prerequisites', link: '/deployment-guide/prerequisites/' },
            { label: 'CLI variables', link: '/deployment-guide/cli-variables/' },
            { label: 'Deployment order', link: '/deployment-guide/deployment-order/' },
            { label: 'Kubernetes secrets bootstrap', link: '/deployment-guide/k8s-secrets-bootstrap/' },
          ],
        },
        {
          label: 'Operations',
          items: [
            { label: 'Routine cluster operations', link: '/operations/routine-operations/' },
          ],
        },
        {
          label: 'Recovery',
          items: [
            { label: 'Disaster recovery', link: '/recovery/disaster-recovery/' },
          ],
        },
        {
          label: 'Site guide',
          items: [
            { label: 'Build and customize this site', link: '/site/build-and-customize/' },
          ],
        },
        {
          label: 'Nextcloud',
          items: [
            { label: 'Storage architecture', link: '/nextcloud/nc-storage/' },
            { label: 'Updating Nextcloud', link: '/nextcloud/updating-nextcloud/' },
            { label: 'Talk backend', link: '/nextcloud/talk-backend/' },
          ],
        },
      ],
    }),
  ],
});
