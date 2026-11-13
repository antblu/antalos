# Drupal template

This template preserves the Drupal manifests, derived image, image workflow, deployment inputs, Authentik integration, and handbook excerpts. Argo CD discovers applications under `apps/`. The handbook and GitHub Actions use their usual active source directories.

To restore Drupal:

1. Move `app/` to `apps/drupal/`, merge `variables.yaml` under the `variables:` key in `apps/variables.yaml`, and choose a hostname that does not conflict with WriteFreely.
2. Move the two Authentik YAML files back to `apps/authentik/` and restore the Drupal mounts and environment entries in the chart values. The saved `authentik/chart-settings.yaml.txt` contains the removed entries.
3. Move `workflows/drupal-image.yaml` back to `.github/workflows/` and add the object in `renovate-rule.json` to the main Renovate configuration's `packageRules`.
4. Return the Drupal page to `docs/admin-guide/` and restore its sidebar and availability entries. The Authentik excerpt records the former provider and access documentation.
5. Verify the original database and NFS files, sealed credentials, and Authentik provider before reconciling. Deploy the image and then follow the archived Drupal runbook.

The cutover leaves the Drupal namespace, database, and files available for recovery. The old ingress is removed so only WriteFreely owns the blog hostname. Authentik's existing provider, application, and groups can remain in its database after the blueprint is retired.
