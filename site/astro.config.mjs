import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { serviceNavigation } from './src/navigation.mjs';

export default defineConfig({
  site: 'https://docs.antblu.net',
  redirects: {
    "/architecture/infrastructure/": "/infrastructure/platform/",
    "/architecture/service-availability/": "/infrastructure/availability/",
    "/deployment-guide/prerequisites/": "/admin-guide/prerequisites/",
    "/deployment-guide/deployment-order/": "/admin-guide/bootstrap/",
    "/deployment-guide/cli-variables/": "/admin-guide/cli/",
    "/deployment-guide/k8s-secrets-bootstrap/": "/admin-guide/secrets/",
    "/operations/routine-operations/": "/admin-guide/operations/",
    "/operations/litellm/": "/admin-guide/litellm/",
    "/operations/rustdesk/": "/admin-guide/rustdesk/",
    "/recovery/disaster-recovery/": "/admin-guide/disaster-recovery/",
    "/site/build-and-customize/": "/admin-guide/site-authoring/",
    "/nextcloud/nc-storage/": "/infrastructure/nextcloud/",
    "/nextcloud/updating-nextcloud/": "/admin-guide/nextcloud-upgrades/",
    "/nextcloud/talk-backend/": "/admin-guide/nextcloud-talk/",
    "/gitlab/deployment/": "/admin-guide/gitlab/"
  },
  integrations: [
    starlight({
      title: 'antalos',
      description: 'The antalos handbook: applications, Proxmox and Talos, Debian workloads, edge routing, and daily operations.',
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
        { label: 'Handbook', link: '/' },
        { label: 'Service directory', link: '/user-guide/services/' },
        {
          label: 'Use the services',
          items: [
            { label: 'Choose a workflow', link: '/user-guide/' },
            { label: 'Accounts and access', link: '/user-guide/accounts/' },
            ...serviceNavigation('user-guide'),
          ],
        },
        {
          label: 'Understand the infrastructure',
          items: [
            { label: 'Architecture guide', link: '/infrastructure/' },
            { label: 'Repository and ownership', link: '/infrastructure/repository/' },
            { label: 'Hosts and Talos', link: '/infrastructure/platform/' },
            { label: 'Traffic, DNS, and TLS', link: '/infrastructure/networking/' },
            { label: 'Storage and data', link: '/infrastructure/storage/' },
            { label: 'Debian application VMs', link: '/infrastructure/virtual-machines/' },
            { label: 'Rack and switch connections', link: '/infrastructure/homelable-physical/' },
            { label: 'Availability and failure domains', link: '/infrastructure/availability/' },
            ...serviceNavigation('infrastructure'),
          ],
        },
        {
          label: 'Deploy and operate',
          items: [
            { label: 'Choose a runbook', link: '/admin-guide/' },
            {
              label: 'Build and change',
              collapsed: true,
              items: [
                { label: 'Workstation prerequisites', link: '/admin-guide/prerequisites/' },
                { label: 'CLI and access', link: '/admin-guide/cli/' },
                { label: 'Bootstrap the platform', link: '/admin-guide/bootstrap/' },
                { label: 'Application workflow', link: '/admin-guide/deploy-an-application/' },
                { label: 'Sealed credentials', link: '/admin-guide/secrets/' },
                { label: 'SSO and integrations', link: '/admin-guide/single-sign-on/' },
                { label: 'Debian VM lifecycle', link: '/admin-guide/virtual-machines/' },
                { label: 'Azure edge and home proxies', link: '/admin-guide/azure-edge/' },
              ],
            },
            {
              label: 'Maintain and recover',
              collapsed: true,
              items: [
                { label: 'Routine operations', link: '/admin-guide/operations/' },
                { label: 'Find the failing layer', link: '/admin-guide/troubleshooting/' },
                { label: 'Disaster recovery', link: '/admin-guide/disaster-recovery/' },
                { label: 'Write and publish documentation', link: '/admin-guide/site-authoring/' },
              ],
            },
            ...serviceNavigation('admin-guide'),
            { label: 'Invoice Ninja', link: '/admin-guide/invoiceninja/' },
            {
              label: 'Integration runbooks',
              collapsed: true,
              items: [
                { label: 'Cal.diy deployment and checks', link: '/admin-guide/cal-diy/' },
                { label: 'Nextcloud integrations', link: '/admin-guide/nextcloud-integrations/' },
                { label: 'Nextcloud upgrades', link: '/admin-guide/nextcloud-upgrades/' },
                { label: 'Nextcloud Talk', link: '/admin-guide/nextcloud-talk/' },
                { label: 'RustDesk networking', link: '/admin-guide/rustdesk-network/' },
              ],
            },
          ],
        },
      ],
    }),
  ],
});
