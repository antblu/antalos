// Service slugs match docs/<perspective>/<slug>.md and apps/<slug>/.
// Keep the same functional groups in all three documentation perspectives.
export const serviceGroups = [
  {
    "label": "Files, notes, and communication",
    "services": [
      {
        "slug": "nextcloud",
        "label": "Nextcloud"
      },
      {
        "slug": "obsidian",
        "label": "Obsidian LiveSync"
      },
      {
        "slug": "stalwart",
        "label": "Stalwart Mail"
      }
    ]
  },
  {
    "label": "Work and automation",
    "services": [
      {
        "slug": "activepieces",
        "label": "Activepieces"
      },
      {
        "slug": "gitlab",
        "label": "GitLab"
      },
      {
        "slug": "suitecrm",
        "label": "SuiteCRM"
      },
      {
        "slug": "zammad",
        "label": "Zammad"
      },
      {
        "slug": "bentopdf",
        "label": "BentoPDF"
      }
    ]
  },
  {
    "label": "Identity, access, and protection",
    "services": [
      {
        "slug": "authentik",
        "label": "Authentik"
      },
      {
        "slug": "vaultwarden",
        "label": "Vaultwarden"
      },
      {
        "slug": "headscale",
        "label": "Headscale and Headplane"
      },
      {
        "slug": "rustdesk",
        "label": "RustDesk"
      },
      {
        "slug": "crowdsec",
        "label": "CrowdSec"
      }
    ]
  },
  {
    "label": "AI services",
    "services": [
      {
        "slug": "open-webui",
        "label": "Open WebUI"
      },
      {
        "slug": "litellm",
        "label": "LiteLLM"
      }
    ]
  },
  {
    "label": "Delivery, monitoring, and backup",
    "services": [
      {
        "slug": "argocd",
        "label": "Argo CD"
      },
      {
        "slug": "rancher",
        "label": "Rancher"
      },
      {
        "slug": "victoriametrics",
        "label": "Grafana, metrics, and logs"
      },
      {
        "slug": "uptime-kuma",
        "label": "Uptime Kuma"
      },
      {
        "slug": "urbackup",
        "label": "UrBackup"
      },
      {
        "slug": "docs",
        "label": "Documentation site"
      }
    ]
  },
  {
    "label": "Cluster foundations",
    "services": [
      {
        "slug": "traefik",
        "label": "Traefik"
      },
      {
        "slug": "metallb",
        "label": "MetalLB"
      },
      {
        "slug": "cert-manager",
        "label": "cert-manager"
      },
      {
        "slug": "sealed-secrets",
        "label": "Sealed Secrets"
      },
      {
        "slug": "openebs",
        "label": "OpenEBS"
      },
      {
        "slug": "nfs-driver",
        "label": "NFS CSI driver"
      },
      {
        "slug": "cnpg-operator",
        "label": "CloudNativePG"
      },
      {
        "slug": "mariadb-operator",
        "label": "MariaDB operator"
      },
      {
        "slug": "metrics-server",
        "label": "Metrics Server"
      }
    ]
  }
];

export function serviceNavigation(section) {
  return serviceGroups.map(({ label, services }) => ({
    label,
    collapsed: true,
    items: services.map(({ slug, label }) => ({
      label,
      link: `/${section}/${slug}/`,
    })),
  }));
}
