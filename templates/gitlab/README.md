# GitLab template

This directory preserves the GitLab application manifests, their shared variable values, and the service-specific handbook pages. It is outside `apps/` and `docs/`, so the normal Argo CD application discovery and documentation build do not include it.

To restore the checked-in design, move `app/` to `apps/gitlab/`, merge `variables.yaml` under the `variables:` key in `apps/variables.yaml`, and move the three pages from `docs/` back to their matching handbook directories. Restore the GitLab service navigation and shared handbook references as appropriate. The Application source in `app/app.yaml` expects the manifest path `apps/gitlab`.

The sealed credentials are retained as recovery material. Restore the original application keys and verify the external database, object storage, routing, and identity dependencies before reconciling the Application.
