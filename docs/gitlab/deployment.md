---
title: GitLab HA deployment
description: GitLab topology, storage, credentials, and verification.
---

GitLab is served at https://gitlab.antblu.net, with the container registry at
https://registry.antblu.net and the agent endpoint at https://kas.antblu.net.
Git over SSH uses port 22 on the shared ingress address.

## Topology

The official GitLab chart and application versions are pinned in
`apps/variables.yaml`. Webservice, Sidekiq, Shell, KAS, registry, and toolbox use
two replicas on separate main workers. PostgreSQL uses two separate CNPG clusters
(GitLab and Praefect), each with two instances and synchronous replication that
prefers durability but allows progress when a replica is unavailable.

Gitaly and Praefect each use three replicas for repository transaction quorum.
Required anti-affinity places one on each worker; the RTX worker is eligible via
the `quorum:NoSchedule` toleration. The third Gitaly stores a full repository copy,
not just a vote. Redis has two data replicas with persistent Sentinels and a
third persistent Sentinel on RTX. Redis restart discovers the elected primary.

Gitaly Cluster on Kubernetes remains **beta** upstream. Failover can interrupt
in-flight operations, which clients must retry. Garage is an external storage
dependency: Kubernetes replication does not provide HA for that S3 endpoint.

## Object storage and backups

The existing Garage bucket is `gitlabs`, accessed through the shared Garage
endpoint and region variables. Rails object types use separate prefixes;
the registry uses `/registry`. Credentials and all application-generated keys
are committed only as SealedSecrets in `apps/gitlab/secrets.yaml`.

**Do not run the stock Helm backup/restore procedure with this single-bucket
layout.** GitLab requires separate buckets for Helm backup restoration. Backup
scheduling is disabled. Before enabling backups, provision separate buckets and
change the configuration, then test a restore into an isolated instance.
Never point a restore operation at the production shared bucket.

## Capacity

Nextcloud office requests were reduced from 2 CPU / 4 GiB to 500m / 2 GiB per
replica. Context-chat requests were reduced from 500m / 2 GiB to 100m / 1 GiB per
replica. Observed working sets were about 1.3 GiB for office and 0.6–0.9 GiB for
context-chat. Limits remain unchanged. These observations are a deployment-time
sample; monitor sustained peaks and adjust requests if usage grows.

## Access and verification

The initial administrator is `root`; its generated password is in the
`gitlab-gitlab-initial-root-password` Secret in namespace `gitlab`. Retrieve it
privately through your normal secret-management workflow. Do not paste it into
logs or commit it. Runner registration and outbound email are not configured.

Check the Argo CD `gitlab` application, both CNPG clusters, all pod readiness,
TLS, authenticated project creation, Git push/clone, and object uploads. Test
Redis and PostgreSQL controlled failover separately before relying on recovery.
A successful initial health check alone does not prove full node-loss behavior.

## References

- [GitLab chart](https://docs.gitlab.com/charts/)
- [External PostgreSQL](https://docs.gitlab.com/charts/advanced/external-db/)
- [Gitaly Cluster configuration](https://docs.gitlab.com/administration/gitaly/praefect/configure/)
- [Gitaly on Kubernetes](https://docs.gitlab.com/administration/gitaly/kubernetes/)
- [Object storage and bucket limitations](https://docs.gitlab.com/administration/object_storage/#use-separate-buckets)
