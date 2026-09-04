---
title: Nextcloud Talk deployment configuration
description: Configure networking, TLS, secrets, and Nextcloud for the Talk high-performance backend.
sidebar:
  order: 3
---

The Nextcloud Talk high-performance backend requires several network, DNS, certificate, and Nextcloud configuration steps in addition to deploying the Kubernetes manifests.

## 1. Reserve the Talk LoadBalancer IP

Reserve a dedicated address from the MetalLB pool for:

```text
NEXTCLOUD_TALK_LOAD_BALANCER_IP
```

Both TURN Services use this same IP, but each TURN port is routed to a specific Talk StatefulSet pod.

Do not load-balance one TURN port across multiple independent TURN servers. TURN allocations are stateful and must continue reaching the server that created them.

---

## 2. Configure DNS

Create two DNS records.

### Signaling hostname

```text
NEXTCLOUD_TALK_HOST
```

Create an `A` record pointing this hostname to the existing Traefik/HTTPS ingress address.

Example:

```text
talk.antblu.net → 10.30.0.200
```

The hostname is used for the HTTPS signaling endpoint.

### TURN hostname

```text
NEXTCLOUD_TALK_TURN_HOST
```

For public DNS, create an `A` record pointing directly to the router's public IPv4 address.

Example:

```text
turn.antblu.net → <WAN IPv4 address>
```

The TURN hostname must resolve directly to the router. Do not place the TURN hostname behind an HTTP reverse proxy.

Do not create an `AAAA` record unless IPv6 routing and firewall rules for TURN are fully configured.

### Internal TURN resolution

Clients and pods inside the network must also be able to reach the TURN hostname.

Use either:

- Hairpin NAT on the router, or
    
- Split DNS so that internally:
    

```text
turn.antblu.net → NEXTCLOUD_TALK_LOAD_BALANCER_IP
```

Split DNS is generally preferable when the internal DNS infrastructure already supports host overrides.

---

## 3. Configure TLS

The signaling endpoint requires a valid TLS certificate for:

```text
NEXTCLOUD_TALK_HOST
```

The Kubernetes certificate is managed by:

```text
apps/nextcloud/certificate.yaml
```

Verify that the certificate covers the Talk signaling hostname and that normal HTTPS access to the hostname succeeds.

Nextcloud is configured to verify the signaling server's TLS certificate.

---

## 4. Configure Router Port Forwarding (If external)

Forward both configured TURN ports from the public WAN address to the Talk MetalLB address.

For:

```text
NEXTCLOUD_TALK_TURN_0_PORT
NEXTCLOUD_TALK_TURN_1_PORT
```

create both TCP and UDP forwards:

```text
WAN:<TURN_0_PORT> TCP → NEXTCLOUD_TALK_LOAD_BALANCER_IP:<TURN_0_PORT>
WAN:<TURN_0_PORT> UDP → NEXTCLOUD_TALK_LOAD_BALANCER_IP:<TURN_0_PORT>

WAN:<TURN_1_PORT> TCP → NEXTCLOUD_TALK_LOAD_BALANCER_IP:<TURN_1_PORT>
WAN:<TURN_1_PORT> UDP → NEXTCLOUD_TALK_LOAD_BALANCER_IP:<TURN_1_PORT>
```

The destination ports should remain unchanged.

Each port corresponds to one Talk/Janus/TURN StatefulSet instance.

---

## 5. Firewall Rules

Allow inbound WAN traffic for only:

```text
TCP 443                     → existing HTTPS ingress
TCP NEXTCLOUD_TALK_TURN_0_PORT
UDP NEXTCLOUD_TALK_TURN_0_PORT
TCP NEXTCLOUD_TALK_TURN_1_PORT
UDP NEXTCLOUD_TALK_TURN_1_PORT
```

The Talk architecture does **not** require exposing the following directly to the Internet:

```text
NATS
gRPC peer discovery
Janus WebSocket
internal signaling ports
```

These remain Kubernetes-internal services.

---

## 6. Kubernetes Internal Networking

Ensure the cluster network permits:

```text
Talk pod ↔ Talk pod
Talk pod ↔ NATS
Talk pod ↔ Janus
Janus/Talk pod ↔ TURN
pod ↔ pod UDP media traffic
```

The manifests restrict:

- gRPC access to Talk pods
    
- NATS access to authenticated Talk/NATS pods
    

The three-replica NATS Core cluster does not require persistent storage.

---

## 7. Node Requirements

The deployment requires **three nodes eligible for NATS scheduling**. NATS tolerates
the existing `quorum:NoSchedule` taint so that the third replica can use the
quorum worker alongside the two ordinary workers. Required pod anti-affinity
keeps one NATS replica per node; control-plane taints remain respected.

The architecture uses:

```text
Talk backend replicas: 2
NATS replicas:         3
```

NATS pod anti-affinity places the three NATS replicas on different nodes.

Talk replicas should also run on separate nodes.

---

## 8. Configure Deployment Variables

Verify the Talk values in:

```text
apps/variables.yaml
```

including:

```text
NEXTCLOUD_TALK_HOST
NEXTCLOUD_TALK_TURN_HOST
NEXTCLOUD_TALK_LOAD_BALANCER_IP
NEXTCLOUD_TALK_TURN_0_PORT
NEXTCLOUD_TALK_TURN_1_PORT
NEXTCLOUD_TALK_IMAGE_TAG
```

The Talk image currently uses the official quick-install `latest` channel, so the image behind that tag can change without the variable changing.

The launcher uses Bash to supervise eturnal, Janus, and signaling directly,
without requiring a bundled `dinit` supervisor. It forwards shutdown signals
and exits if any service stops, allowing Kubernetes to restart the container.
`NEXTCLOUD_TALK_CONFIG_REVISION` triggers a Talk rollout when launcher changes
are synced; increment it for future ConfigMap-only startup changes.

---

## 9. Deploy Talk Secrets

Talk credentials are stored in:

```text
talk-secrets.yaml
```

They are encrypted using Sealed Secrets.

The deployment requires shared credentials for components such as:

```text
Nextcloud ↔ signaling authentication
Talk signaling replicas
NATS authentication
```

Do not store the plaintext versions of these credentials in Git.

---

## 10. Configure Nextcloud Talk

The existing Nextcloud startup lifecycle hook automatically configures Nextcloud with:

```text
Signaling URL
Signaling shared secret
TURN server 0
TURN server 1
```

TLS certificate verification for signaling remains enabled.

These settings are managed declaratively by the lifecycle hook. Manual changes to the corresponding Nextcloud Talk settings will be overwritten the next time a Nextcloud pod starts.

---

## 11. Deployment Checklist

Before deploying, verify:

-  `NEXTCLOUD_TALK_LOAD_BALANCER_IP` is reserved in MetalLB
    
-  `NEXTCLOUD_TALK_HOST` resolves to the HTTPS ingress
    
-  `NEXTCLOUD_TALK_TURN_HOST` publicly resolves to the WAN IPv4 address
    
-  Internal TURN DNS resolves to the MetalLB IP, or hairpin NAT works
    
-  No TURN `AAAA` record exists unless IPv6 TURN works
    
-  TLS certificate exists for the signaling hostname
    
-  TURN port 0 TCP is forwarded
    
-  TURN port 0 UDP is forwarded
    
-  TURN port 1 TCP is forwarded
    
-  TURN port 1 UDP is forwarded
    
-  Kubernetes allows pod-to-pod UDP media traffic
    
-  At least three schedulable Kubernetes nodes are available
    
-  Talk secrets have been sealed
    
-  Talk variables have been configured
    
-  Nextcloud can reach the signaling hostname
    
-  Nextcloud/Janus can reach both TURN endpoints
    

## Publicly Exposed Services

The final externally accessible surface should therefore be approximately:

```text
Internet
   │
   ├── TCP 443
   │      └── Traefik
   │             └── Talk signaling HTTPS
   │
   ├── TCP/UDP TURN_PORT_0
   │      └── Talk LoadBalancer IP
   │             └── Talk/Janus/TURN replica 0
   │
   └── TCP/UDP TURN_PORT_1
          └── Talk LoadBalancer IP
                 └── Talk/Janus/TURN replica 1
```

NATS, gRPC peer discovery, and Janus' internal interfaces remain private to the Kubernetes cluster.
## Recording backend

The recording backend follows the [official recording server installation guide](https://github.com/nextcloud/nextcloud-talk-recording/blob/main/docs/installation.md)
and uses the [official AIO recording image](https://github.com/nextcloud/all-in-one/tree/main/Containers/talk-recording), pinned by digest in `apps/variables.yaml`.

`apps/nextcloud/talk-recording.yaml` deploys one recording process in a StatefulSet.
Traefik strips the `/recording` prefix and forwards requests directly to the
recorder. No HAProxy sidecar or room-based load balancing is needed.
Nextcloud uses `https://<NEXTCLOUD_TALK_HOST>/recording`, with the existing Talk
certificate from `certificate.yaml`. No additional DNS or router rule is needed.

The recording authentication secret is generated and sealed in
`talk-recording-secrets.yaml`. The recording process reuses the HPB's existing
`internal-secret` separately. The Nextcloud lifecycle hook manages the recording
URL and shared secret. TLS verification remains enabled for both Nextcloud and HPB.

The recorder has a retained `openebs-local` PVC sized by
`NEXTCLOUD_RECORDING_STORAGE_SIZE`. The launcher stores recordings under
`/recordings`; disposable browser state stays under `/tmp`. It bypasses the AIO
entrypoint because that entrypoint clears temporary files on startup. Failed
uploads remain available for manual recovery on the owning PVC. Local volumes
stay attached to their original worker and are not replicated backups.

### Availability limits

Recording is unavailable while the single pod restarts or its worker is down.
Active recordings cannot resume after a process failure. The retained local PVC
stays on its original worker, including the former second replica's PVC, which
is preserved for manual recovery. There is no disruption budget blocking node
maintenance for this single-replica service.

### Verification

Check the single StatefulSet pod is ready. The
HTTPS welcome endpoint is `/recording/api/v1/welcome`; a successful response alone
does not verify the authentication secrets or media path.

For end-to-end verification, start a dedicated test call as a moderator, start
recording, speak with video enabled, stop recording, and check the uploaded file
and notification. Inspect the recording container logs if joining, encoding, or
uploading fails. Avoid testing against another user's live conversation.
