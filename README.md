# antalos

antalos is the configuration repository for a self-hosted platform: Talos Kubernetes on Proxmox, Debian application VMs, and a public/private edge network. OpenTofu provisions machines, Argo CD reconciles Kubernetes applications, and Ansible configures the declared Debian workloads.

**Start with the [antalos handbook](https://docs.antblu.net).** It separates everyday service use, infrastructure explanations, and deployment/operating procedures.

| You want to… | Read |
| --- | --- |
| Use an application | [User guides](https://docs.antblu.net/user-guide/) |
| Find a service and its official documentation | [Service directory](https://docs.antblu.net/user-guide/services/) |
| Understand configuration ownership | [Repository map](https://docs.antblu.net/infrastructure/repository/) |
| Understand machines, networking, and data | [Architecture guide](https://docs.antblu.net/infrastructure/) |
| Deploy your own installation | [Administrator guide](https://docs.antblu.net/admin-guide/) |
| Diagnose an incident | [Troubleshooting](https://docs.antblu.net/admin-guide/troubleshooting/) |
| Recover infrastructure or application data | [Disaster recovery](https://docs.antblu.net/admin-guide/disaster-recovery/) |

## Repository layout

```text
apps/
  variables.yaml             Shared Kubernetes application inputs
  <service>/                 Application and all its supporting manifests
infrastructure/
  opentofu/
    talostofu/               Talos VMs and cluster bootstrap
    argotofu/                Argo CD bootstrap and renderer configuration
    haproxy/                 Home edge VM pair
    lefttofu/                Debian left VM
    rtxtofu/                 Debian RTX VM
    arctofu/                 Debian Arc VM
  argocd/                    Root application and project
  ansible/
    leftansible/             Debian base-host configuration
    rtxansible/              RTX runtime, llama-swap, and Speaches
    arcansible/              Arc runtime and media/document workloads
  azure/                     Edge cloud-init and separate input files
docs/                        Markdown content for the handbook
site/                        Astro/Starlight, navigation, CSS, and container
.github/workflows/           Documentation image build and publication
```

`kubeconfig` and `talosconfig` are local credential files at the repository root. OpenTofu state, private key backups, VM secret inputs, and rendered user data must remain protected outside the public source and documentation image.

## Configuration rules

Kubernetes application hostnames, addresses, node names, chart versions, image tags, and volume sizes belong in `apps/variables.yaml`. Application manifests reference them with `${VARIABLE_NAME}` and use the `yaml-envsubst` plugin. Helm `values.yaml` files are excluded from that substitution; pass their shared inputs through an already rendered Application.

Keep each service's database, storage, certificates, and sealed credentials in its one `apps/<service>/` directory. VM and Azure settings belong to their own infrastructure projects. The [repository map](https://docs.antblu.net/infrastructure/repository/) explains these boundaries and the two renderer modes.

## Deploying a fork

This repository contains environment-specific defaults, not a universal one-command installer. Replace source URLs, topology, network addresses, storage endpoints, application inputs, and credentials for your installation. Existing SealedSecrets require the original sealing identity or newly generated and sealed credentials.

Follow [prerequisites](https://docs.antblu.net/admin-guide/prerequisites/), [bootstrap](https://docs.antblu.net/admin-guide/bootstrap/), and the [application workflow](https://docs.antblu.net/admin-guide/deploy-an-application/), then complete each selected service's administrator guide. Debian VMs and Azure edge use their own deployment paths. External NFS, Garage, public DNS, and application account setup are separate prerequisites.

## Availability and recovery

Availability varies by service. Replicas can protect a serving process or database, while shared storage, the configured Kubernetes API endpoint, single-instance services, and VM backends have separate failure limits. Read the [availability guide](https://docs.antblu.net/infrastructure/availability/) before planning maintenance or claiming host-loss tolerance.

Git reconstructs configuration. Recovering an application also requires its databases, files or objects, original credentials, and independent backups.

## Working on the handbook

Edit content under `docs/`. The content loader in `site/src/content.config.ts` reads those files directly. Shared navigation lives in `site/astro.config.mjs`, and `site/src/navigation.mjs` groups service links across the three guide perspectives.

Follow [site authoring](https://docs.antblu.net/admin-guide/site-authoring/) for content conventions, official-documentation links, local development, and the container publishing path. The GitHub workflow builds the image; `apps/docs/` defines its deployment. A local edit is not automatically a published release.

Follow `AGENTS.md` for repository-specific access, approval, formatting, validation, and commit rules.
