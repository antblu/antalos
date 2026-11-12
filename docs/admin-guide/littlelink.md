---
title: LittleLink-Server
description: Publish a stateless profile page and verify its public HTTPS route.
---

LittleLink-Server publishes a public profile page with links configured through environment variables. The Argo CD Application discovers the service in `apps/littlelink/`. Set the profile, links, hostname, and image tag in `apps/variables.yaml`. The upstream container registry publishes the `latest` tag, which Kubernetes resolves at container startup. [LittleLink-Server configuration](https://github.com/timothystewart6/littlelink-server)

## Publish and verify

1. Point the hostname at the public HTTPS edge used by the cluster. Cert-manager uses the `letsencrypt-prod` DNS-01 issuer to obtain the certificate consumed by Traefik.
2. Publish the manifests to the branch watched by Argo CD. Confirm the `littlelink` Application is Synced and Healthy, both pods are Ready on different general workers, and the `littlelink-tls` Certificate is Ready.
3. Open the HTTPS hostname from outside the cluster and verify the profile page and its outbound link destinations. The `/healthcheck` endpoint should return HTTP 200.

## Availability

The ClusterIP Service routes to two stateless replicas on separate general workers. A rolling update replaces one replica at a time, and the disruption budget requires one available replica for voluntary evictions. After Kubernetes removes a failed endpoint, new requests can reach the surviving worker through Traefik. A replacement waits for another eligible worker. Public access depends on DNS, the shared edge, Traefik, and valid TLS.

Git holds the configuration needed to reconstruct the workload. The service has no database or persistent volume. Profile images and outbound destinations are fetched by visitors and depend on their own hosts.
