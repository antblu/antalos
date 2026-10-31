---
title: "Nextcloud Talk networking"
description: "Route signaling, TURN, NATS, and external recording for the recoverable singleton Talk backend."
---

Talk uses different paths for signaling and media. HTTPS signaling can be routed through Traefik; TURN allocations must remain attached to the process that created them. Configure and test both paths before inviting users to calls.

## The declared topology

`apps/nextcloud/talk.yaml` runs one Recreate Deployment pod containing the AIO signaling, Janus, and TURN components. A separate three-member NATS Core cluster connects signaling state. NATS is anti-affined across three eligible nodes, including the RTX worker through its `quorum:NoSchedule` toleration; control-plane taints remain respected.

The `nextcloud-talk-turn-0` Service selects the singleton Deployment by application label and follows its replacement pod. It uses `NEXTCLOUD_TALK_LOAD_BALANCER_IP` and `NEXTCLOUD_TALK_TURN_0_PORT`. Do not add competing TURN processes behind that allocation path.

## 1. Set the network variables

| Variable | Responsibility |
| --- | --- |
| `NEXTCLOUD_TALK_HOST` | Public HTTPS signaling origin routed to Traefik |
| `NEXTCLOUD_TALK_TURN_HOST` | Client-reachable TURN hostname |
| `NEXTCLOUD_TALK_LOAD_BALANCER_IP` | Reserved MetalLB address for the TURN Service |
| `NEXTCLOUD_TALK_TURN_0_PORT` | TCP/UDP listener used by the singleton Talk backend |
| `NEXTCLOUD_TALK_NATS_*` | Internal NATS endpoints used by the cluster |

Keep the values in `apps/variables.yaml`. Reserve the address in the network and MetalLB pool before exposing the service.

## 2. Configure DNS for both audiences

The signaling hostname must reach the normal HTTPS ingress. For public TURN, point the TURN hostname at the router’s public IPv4 address and forward the designated ports to the Talk LoadBalancer address. TURN is not an HTTP service and must not sit behind an HTTP-only proxy.

Internal clients and pods also need a working path to that same advertised hostname. Use split DNS pointing at the Talk LoadBalancer or a working hairpin-NAT arrangement. Do not publish an IPv6 record unless the corresponding TURN routing and firewall path are actually available.

## 3. Publish the required listeners

| Public listener | Destination | Session owner |
| --- | --- | --- |
| TCP 443 for the signaling hostname | Traefik HTTPS ingress | Ready signaling process |
| TCP and UDP `TURN_0_PORT` | Talk LoadBalancer, same port | Current singleton Talk pod |

Use the actual `NEXTCLOUD_TALK_TURN_0_PORT` value in firewall and NAT rules. Keep the external and internal port mapping consistent with what Nextcloud advertises. Confirm any additional media requirements against the selected AIO image and your network topology rather than treating an HTTP health check as a media test.

Keep NATS, peer-discovery gRPC, and internal Janus/signaling interfaces private. Permit the pod-to-pod TCP/UDP paths required by the deployed backend and its NetworkPolicies.

## 4. Supply TLS and shared credentials

`apps/nextcloud/certificate.yaml` includes the Talk signaling certificate. Nextcloud keeps TLS verification enabled for that connection. Verify the public hostname and certificate chain instead of disabling verification to work around a mismatch.

The `nextcloud-talk` SealedSecret includes signaling, internal, TURN, NATS, block, and hash keys. Keep each shared value consistent across the components that consume it. Rotate credentials as a coordinated service change; changing only one side breaks authentication.

## 5. Let startup configure the managed settings

The Nextcloud lifecycle hook replaces `spreed` signaling and TURN configuration atomically. It sets the HTTPS signaling URL with verification enabled and advertises the singleton TURN endpoint with TCP/UDP support.

Do not append duplicate signaling entries manually. UI changes to these managed values will be overwritten on a later pod start; change shared variables or the sealed Secret and reconcile the owning manifests.

## 6. Test the actual call path

Test a call between a LAN client and a client on a separate external network. Exercise audio, camera, and screen sharing, then test a network that requires TURN relay. Confirm the TURN endpoint works and that internal clients can resolve and reach the advertised hostname.

```bash title="Inspect Talk and its internal messaging tier"
/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud get deployment nextcloud-talk

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud get statefulset nextcloud-talk-nats

/home/linuxbrew/.linuxbrew/bin/kubectl --kubeconfig kubeconfig \
  -n nextcloud get service nextcloud-talk-turn-0
```

A green signaling check does not prove UDP traversal. If calls connect with no media, inspect client connectivity diagnostics, TURN allocation, advertised addresses, and firewall paths.

## Failure behavior

Losing the Talk pod interrupts signaling, media sessions and TURN allocations until its replacement starts on an eligible surviving worker. Its NotReady/unreachable tolerations are 60 seconds; detection, scheduling and startup add further recovery time. Existing allocations are not transferred. The singleton PDB blocks ordinary voluntary eviction; it does not prevent node failure. Three independent NATS members leave two coordination processes after one eligible-node failure, but surviving NATS cannot serve the missing signaling/Janus/TURN process. Verify NATS connectivity during the separately authorized node-loss drill. NATS Core does not need a persistent message store in this configuration.

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
