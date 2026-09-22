---
title: Repository and configuration ownership
description: Know which files control Kubernetes, virtual machines, the edge, and the documentation site.
---

Choose the owner of the resource before editing it. The repository contains both continuously reconciled Kubernetes configuration and infrastructure projects that run only when an administrator invokes them.

## Repository map

```text title="Configuration by responsibility"
antalos/
├── apps/
│   ├── variables.yaml          Kubernetes application inputs
│   └── <service>/              Application, database, storage, TLS, secrets
├── infrastructure/
│   ├── opentofu/
│   │   ├── talostofu/          Talos VMs and Kubernetes bootstrap
│   │   ├── argotofu/           Argo CD bootstrap and renderer configuration
│   │   ├── haproxy/            Home edge VM pair
│   │   ├── lefttofu/           Debian left VM
│   │   ├── rtxtofu/            Debian RTX VM and GPU mapping
│   │   └── arctofu/            Debian Arc VM and GPU mapping
│   ├── argocd/                Root application and project
│   ├── ansible/
│   │   ├── leftansible/        Debian base-system configuration
│   │   ├── rtxansible/         RTX runtime and Compose deployment
│   │   └── arcansible/         Arc runtime and Compose deployment
│   └── azure/                 Edge cloud-init and its own variables
├── docs/                      Handbook content
├── site/                      Astro, navigation, styles, Docker, NGINX
└── .github/workflows/         Documentation image pipeline
```

`kubeconfig` and `talosconfig` at the repository root are local credential files, not directories. OpenTofu state, private key backups, rendered cloud-init, and decrypted secret files are recovery material, not website content.

## Which tool owns what?

| Change | Authoritative source | How it takes effect |
| --- | --- | --- |
| Talos VM topology and machine configuration | `infrastructure/opentofu/talostofu/` | Reviewed OpenTofu plan and apply |
| Initial Argo CD installation | `infrastructure/opentofu/argotofu/` | Bootstrap stack; steady-state configuration passes to Argo CD |
| Kubernetes application and supporting services | `apps/<service>/` | Root discovers the Application; the child reconciles its sources |
| Kubernetes hostnames, addresses, versions, and volume sizes | `apps/variables.yaml` | `yaml-envsubst` renders declared placeholders |
| Debian VM shape and GPU passthrough | The matching `*tofu/` project | OpenTofu manages the VM definition |
| Debian workloads and host packages | The matching `*ansible/` project | Ansible configures the guest and, where declared, copies Compose |
| Home HAProxy guests | `infrastructure/opentofu/haproxy/` | VM provisioning and cloud-init; existing guests need an explicit update procedure |
| Azure edge | `infrastructure/azure/` | Rendered cloud-init supplied at VM provisioning |
| Documentation | `docs/` and `site/` | Container build, image publication, and the `apps/docs/` rollout |

Ansible VM settings do not belong in `apps/variables.yaml`. Azure uses its own flat `variables.yaml`. Application values live below the `variables:` key in `apps/variables.yaml`. Similar filenames do not mean the files are interchangeable.

## How Kubernetes rendering works

The `apps` Application in `infrastructure/argocd/app-of-apps.yaml` points at the application tree and sets `RENDER_MODE=applications`. In that mode the renderer discovers `app.yaml` files. Each child Application then selects its chart and/or support manifests.

In normal manifest mode, `yaml-envsubst` reads YAML recursively while excluding `app.yaml`, `values.yaml`, and `variables.yaml`. It replaces only placeholders declared in the shared variables file, preserving runtime shell variables and Argo's `$values` reference. The renderer implementation lives in `infrastructure/opentofu/argotofu/argocd-values.yaml`.

A Helm `values.yaml` file is excluded from substitution. Pass shared chart inputs through Helm parameters or values in an already rendered Application. A child that uses an Argo `directory` source instead of the plugin does not get a second substitution pass.

## Keep one directory per service

An application's PostgreSQL cluster, Redis members, migrations, certificates, and sealed credentials belong beside that application's `app.yaml`. Operators such as CloudNativePG have their own service directories because they manage databases for multiple applications. The database for a particular application stays with its consumer.

Use `certificate.yaml` for services that need a certificate, with `letsencrypt-prod` as the cluster issuer. Store new Kubernetes credentials as SealedSecrets inside the service directory. Follow [the application workflow](/admin-guide/deploy-an-application/) for a concrete change path.

## What a fork must replace

Review repository URLs and tracked branches, Proxmox and VM inputs, hostnames, public/private network addresses, storage exports and buckets, image sources, and identity settings. Existing ciphertext is tied to the original sealing keys and is not a starter credential set. External application registrations and stored settings may require their own migration.

The [bootstrap guide](/admin-guide/bootstrap/) explains the order. The [service directory](/user-guide/services/) identifies what each consumer needs.
