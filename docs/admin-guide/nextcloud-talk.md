---
title: "Nextcloud Talk networking"
description: "Route signaling, TURN, NATS, and external recording correctly for the two-replica Talk backend."
---

Talk uses different paths for signaling and media. HTTPS signaling can be routed through Traefik; TURN allocations must remain attached to the process that created them. Configure and test both paths before inviting users to calls.

## The deployed topology

`apps/nextcloud/talk.yaml` runs two Talk pods containing the AIO signaling, Janus, and TURN components. A three-member NATS Core cluster connects signaling state. NATS is anti-affined across three eligible nodes, including the RTX worker through its `quorum:NoSchedule` toleration; control-plane taints remain respected.

Each TURN Service selects one Talk StatefulSet ordinal. Both Services share `NEXTCLOUD_TALK_LOAD_BALANCER_IP`, but each has a different port. Keep this pinning: balancing one TURN port across two independent processes can send an allocation to the wrong owner.

## 1. Set the network variables

| Variable | Responsibility |
| --- | --- |
| `NEXTCLOUD_TALK_HOST` | Public HTTPS signaling origin routed to Traefik |
| `NEXTCLOUD_TALK_TURN_HOST` | Client-reachable TURN hostname |
| `NEXTCLOUD_TALK_LOAD_BALANCER_IP` | Reserved MetalLB address for both TURN Services |
| `NEXTCLOUD_TALK_TURN_0_PORT` | TCP/UDP listener assigned to Talk ordinal 0 |
| `NEXTCLOUD_TALK_TURN_1_PORT` | TCP/UDP listener assigned to Talk ordinal 1 |
| `NEXTCLOUD_TALK_NATS_*` | Internal NATS endpoints used by the cluster |

Keep the values in `apps/variables.yaml`. Reserve the address in the network and MetalLB pool before exposing the service.

## 2. Configure DNS for both audiences

The signaling hostname must reach the normal HTTPS ingress. For public TURN, point the TURN hostname at the router’s public IPv4 address and forward the designated ports to the Talk LoadBalancer address. TURN is not an HTTP service and must not sit behind an HTTP-only proxy.

Internal clients and pods also need a working path to that same advertised hostname. Use split DNS pointing at the Talk LoadBalancer or a working hairpin-NAT arrangement. Do not publish an IPv6 record unless the corresponding TURN routing and firewall path are actually available.

## 3. Publish the required listeners

| Public listener | Destination | Session owner |
| --- | --- | --- |
| TCP 443 for the signaling hostname | Traefik HTTPS ingress | Healthy signaling replica |
| TCP and UDP `TURN_0_PORT` | Talk LoadBalancer, same port | Talk pod 0 |
| TCP and UDP `TURN_1_PORT` | Talk LoadBalancer, same port | Talk pod 1 |

The repository’s two TURN ports default to 3478 and 3479. Use your actual variable values in firewall and NAT rules. Keep the external and internal port mapping consistent with what Nextcloud advertises. Confirm any additional media requirements against the selected AIO image and your network topology rather than treating an HTTP health check as a media test.

Keep NATS, peer-discovery gRPC, and internal Janus/signaling interfaces private. Permit the pod-to-pod TCP/UDP paths required by the deployed backend and its NetworkPolicies.

## 4. Supply TLS and shared credentials

`apps/nextcloud/certificate.yaml` includes the Talk signaling certificate. Nextcloud keeps TLS verification enabled for that connection. Verify the public hostname and certificate chain instead of disabling verification to work around a mismatch.

The `nextcloud-talk` SealedSecret includes signaling, internal, TURN, NATS, block, and hash keys. Keep each shared value consistent across the components that consume it. Rotate credentials as a coordinated service change; changing only one side breaks authentication.

## 5. Let startup configure the managed settings

The Nextcloud lifecycle hook replaces `spreed` signaling and TURN configuration atomically. It sets the HTTPS signaling URL with verification enabled and advertises both TURN ports with TCP/UDP support.

Do not append duplicate signaling entries manually. UI changes to these managed values will be overwritten on a later pod start; change shared variables or the sealed Secret and reconcile the owning manifests.

## 6. Test the actual call path

Test a call between a LAN client and a client on a separate external network. Exercise audio, camera, and screen sharing, then test a network that requires TURN relay. Confirm both configured TURN endpoints work and that internal clients can resolve and reach the advertised hostname.

```bash title="Inspect Talk and its internal messaging tier"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud get statefulsets nextcloud-talk nextcloud-talk-nats

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud get services nextcloud-talk-turn-0 nextcloud-talk-turn-1
```

A green signaling check does not prove UDP traversal. If calls connect with no media, inspect client connectivity diagnostics, TURN allocation, advertised addresses, and firewall paths.

## Failure behavior

Losing a Talk pod interrupts the sessions or TURN allocations it owns. New connections can use the surviving replica, but existing allocations are not transferred. Three NATS members preserve the intended messaging topology through one eligible-node failure; NATS Core does not need a persistent message store in this configuration.

## External recording

Recording is hosted by the Ansible-managed `debian-arc` VM on `se350-right`. The
playbook deploys the official AIO recording image, preserves failed uploads in a
Docker volume, and registers the internal HTTP endpoint and shared secret in
Talk. The recorder reaches the public Nextcloud URL and the existing HPB directly.

Keep the Ansible-vault recording secret separate from the HPB internal secret.
The internal secret must match the SealedSecret used by the Talk pods. Test
recording start, stop, upload, playback, and retention separately from ordinary
calls. This is one external recorder, so VM or host loss interrupts recording
until `debian-arc` returns.

See the [official Talk administration documentation](https://nextcloud-talk.readthedocs.io/en/latest/) and the [Nextcloud AIO project](https://github.com/nextcloud/all-in-one) for the selected backend’s requirements.
