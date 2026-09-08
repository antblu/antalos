import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

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
      title: 'Antalos',
      description: 'User guides, infrastructure explanations, and deployment runbooks for the Antalos platform.',
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
        {
          "label": "Overview and User Guide",
          "items": [
            {
              "label": "Start here",
              "link": "/user-guide/"
            },
            {
              "label": "Accounts and access",
              "link": "/user-guide/accounts/"
            },
            {
              "label": "Applications",
              "collapsed": true,
              "items": [
                {
                  "label": "Authentik",
                  "link": "/user-guide/authentik/"
                },
                {
                  "label": "BentoPDF",
                  "link": "/user-guide/bentopdf/"
                },
                {
                  "label": "Antalos documentation",
                  "link": "/user-guide/docs/"
                },
                {
                  "label": "GitLab",
                  "link": "/user-guide/gitlab/"
                },
                {
                  "label": "Headscale and Headplane",
                  "link": "/user-guide/headscale/"
                },
                {
                  "label": "LiteLLM",
                  "link": "/user-guide/litellm/"
                },
                {
                  "label": "Nextcloud",
                  "link": "/user-guide/nextcloud/"
                },
                {
                  "label": "Open WebUI",
                  "link": "/user-guide/open-webui/"
                },
                {
                  "label": "Rancher",
                  "link": "/user-guide/rancher/"
                },
                {
                  "label": "RustDesk",
                  "link": "/user-guide/rustdesk/"
                },
                {
                  "label": "Stalwart Mail",
                  "link": "/user-guide/stalwart/"
                },
                {
                  "label": "SuiteCRM",
                  "link": "/user-guide/suitecrm/"
                },
                {
                  "label": "UrBackup",
                  "link": "/user-guide/urbackup/"
                },
                {
                  "label": "Vaultwarden",
                  "link": "/user-guide/vaultwarden/"
                },
                {
                  "label": "Grafana and VictoriaMetrics",
                  "link": "/user-guide/victoriametrics/"
                },
                {
                  "label": "Zammad",
                  "link": "/user-guide/zammad/"
                }
              ]
            },
            {
              "label": "Platform services",
              "collapsed": true,
              "items": [
                {
                  "label": "Argo CD",
                  "link": "/user-guide/argocd/"
                },
                {
                  "label": "cert-manager",
                  "link": "/user-guide/cert-manager/"
                },
                {
                  "label": "CloudNativePG",
                  "link": "/user-guide/cnpg-operator/"
                },
                {
                  "label": "MariaDB operator",
                  "link": "/user-guide/mariadb-operator/"
                },
                {
                  "label": "MetalLB",
                  "link": "/user-guide/metallb/"
                },
                {
                  "label": "Metrics Server",
                  "link": "/user-guide/metrics-server/"
                },
                {
                  "label": "NFS CSI driver",
                  "link": "/user-guide/nfs-driver/"
                },
                {
                  "label": "OpenEBS",
                  "link": "/user-guide/openebs/"
                },
                {
                  "label": "Sealed Secrets",
                  "link": "/user-guide/sealed-secrets/"
                },
                {
                  "label": "Traefik",
                  "link": "/user-guide/traefik/"
                }
              ]
            }
          ]
        },
        {
          "label": "Infrastructure Explanation",
          "items": [
            {
              "label": "Start here",
              "link": "/infrastructure/"
            },
            {
              "label": "Platform topology",
              "link": "/infrastructure/platform/"
            },
            {
              "label": "Service availability",
              "link": "/infrastructure/availability/"
            },
            {
              "label": "Applications",
              "collapsed": true,
              "items": [
                {
                  "label": "Authentik",
                  "link": "/infrastructure/authentik/"
                },
                {
                  "label": "BentoPDF",
                  "link": "/infrastructure/bentopdf/"
                },
                {
                  "label": "Antalos documentation",
                  "link": "/infrastructure/docs/"
                },
                {
                  "label": "GitLab",
                  "link": "/infrastructure/gitlab/"
                },
                {
                  "label": "Headscale and Headplane",
                  "link": "/infrastructure/headscale/"
                },
                {
                  "label": "LiteLLM",
                  "link": "/infrastructure/litellm/"
                },
                {
                  "label": "Nextcloud",
                  "link": "/infrastructure/nextcloud/"
                },
                {
                  "label": "Open WebUI",
                  "link": "/infrastructure/open-webui/"
                },
                {
                  "label": "Rancher",
                  "link": "/infrastructure/rancher/"
                },
                {
                  "label": "RustDesk",
                  "link": "/infrastructure/rustdesk/"
                },
                {
                  "label": "Stalwart Mail",
                  "link": "/infrastructure/stalwart/"
                },
                {
                  "label": "SuiteCRM",
                  "link": "/infrastructure/suitecrm/"
                },
                {
                  "label": "UrBackup",
                  "link": "/infrastructure/urbackup/"
                },
                {
                  "label": "Vaultwarden",
                  "link": "/infrastructure/vaultwarden/"
                },
                {
                  "label": "Grafana and VictoriaMetrics",
                  "link": "/infrastructure/victoriametrics/"
                },
                {
                  "label": "Zammad",
                  "link": "/infrastructure/zammad/"
                }
              ]
            },
            {
              "label": "Platform services",
              "collapsed": true,
              "items": [
                {
                  "label": "Argo CD",
                  "link": "/infrastructure/argocd/"
                },
                {
                  "label": "cert-manager",
                  "link": "/infrastructure/cert-manager/"
                },
                {
                  "label": "CloudNativePG",
                  "link": "/infrastructure/cnpg-operator/"
                },
                {
                  "label": "MariaDB operator",
                  "link": "/infrastructure/mariadb-operator/"
                },
                {
                  "label": "MetalLB",
                  "link": "/infrastructure/metallb/"
                },
                {
                  "label": "Metrics Server",
                  "link": "/infrastructure/metrics-server/"
                },
                {
                  "label": "NFS CSI driver",
                  "link": "/infrastructure/nfs-driver/"
                },
                {
                  "label": "OpenEBS",
                  "link": "/infrastructure/openebs/"
                },
                {
                  "label": "Sealed Secrets",
                  "link": "/infrastructure/sealed-secrets/"
                },
                {
                  "label": "Traefik",
                  "link": "/infrastructure/traefik/"
                }
              ]
            }
          ]
        },
        {
          "label": "Deployment and Admin Guide",
          "items": [
            {
              "label": "Start here",
              "link": "/admin-guide/"
            },
            {
              "label": "Workstation prerequisites",
              "link": "/admin-guide/prerequisites/"
            },
            {
              "label": "Bootstrap the cluster",
              "link": "/admin-guide/bootstrap/"
            },
            {
              "label": "CLI configuration",
              "link": "/admin-guide/cli/"
            },
            {
              "label": "Deploy an application",
              "link": "/admin-guide/deploy-an-application/"
            },
            {
              "label": "Sealed credentials",
              "link": "/admin-guide/secrets/"
            },
            {
              "label": "SSO and integrations",
              "link": "/admin-guide/single-sign-on/"
            },
            {
              "label": "Routine operations",
              "link": "/admin-guide/operations/"
            },
            {
              "label": "Disaster recovery",
              "link": "/admin-guide/disaster-recovery/"
            },
            {
              "label": "Author this site",
              "link": "/admin-guide/site-authoring/"
            },
            {
              "label": "Applications",
              "collapsed": true,
              "items": [
                {
                  "label": "Authentik",
                  "link": "/admin-guide/authentik/"
                },
                {
                  "label": "BentoPDF",
                  "link": "/admin-guide/bentopdf/"
                },
                {
                  "label": "Antalos documentation",
                  "link": "/admin-guide/docs/"
                },
                {
                  "label": "GitLab",
                  "link": "/admin-guide/gitlab/"
                },
                {
                  "label": "Headscale and Headplane",
                  "link": "/admin-guide/headscale/"
                },
                {
                  "label": "LiteLLM",
                  "link": "/admin-guide/litellm/"
                },
                {
                  "label": "Nextcloud",
                  "link": "/admin-guide/nextcloud/"
                },
                {
                  "label": "Open WebUI",
                  "link": "/admin-guide/open-webui/"
                },
                {
                  "label": "Rancher",
                  "link": "/admin-guide/rancher/"
                },
                {
                  "label": "RustDesk",
                  "link": "/admin-guide/rustdesk/"
                },
                {
                  "label": "Stalwart Mail",
                  "link": "/admin-guide/stalwart/"
                },
                {
                  "label": "SuiteCRM",
                  "link": "/admin-guide/suitecrm/"
                },
                {
                  "label": "UrBackup",
                  "link": "/admin-guide/urbackup/"
                },
                {
                  "label": "Vaultwarden",
                  "link": "/admin-guide/vaultwarden/"
                },
                {
                  "label": "Grafana and VictoriaMetrics",
                  "link": "/admin-guide/victoriametrics/"
                },
                {
                  "label": "Zammad",
                  "link": "/admin-guide/zammad/"
                }
              ]
            },
            {
              "label": "Platform services",
              "collapsed": true,
              "items": [
                {
                  "label": "Argo CD",
                  "link": "/admin-guide/argocd/"
                },
                {
                  "label": "cert-manager",
                  "link": "/admin-guide/cert-manager/"
                },
                {
                  "label": "CloudNativePG",
                  "link": "/admin-guide/cnpg-operator/"
                },
                {
                  "label": "MariaDB operator",
                  "link": "/admin-guide/mariadb-operator/"
                },
                {
                  "label": "MetalLB",
                  "link": "/admin-guide/metallb/"
                },
                {
                  "label": "Metrics Server",
                  "link": "/admin-guide/metrics-server/"
                },
                {
                  "label": "NFS CSI driver",
                  "link": "/admin-guide/nfs-driver/"
                },
                {
                  "label": "OpenEBS",
                  "link": "/admin-guide/openebs/"
                },
                {
                  "label": "Sealed Secrets",
                  "link": "/admin-guide/sealed-secrets/"
                },
                {
                  "label": "Traefik",
                  "link": "/admin-guide/traefik/"
                }
              ]
            },
            {
              "label": "Detailed runbooks",
              "collapsed": true,
              "items": [
                {
                  "label": "Nextcloud integrations",
                  "link": "/admin-guide/nextcloud-integrations/"
                },
                {
                  "label": "Nextcloud upgrades",
                  "link": "/admin-guide/nextcloud-upgrades/"
                },
                {
                  "label": "Nextcloud Talk networking",
                  "link": "/admin-guide/nextcloud-talk/"
                },
                {
                  "label": "RustDesk networking and recovery",
                  "link": "/admin-guide/rustdesk-network/"
                }
              ]
            }
          ]
        }
      ],
    }),
  ],
});
