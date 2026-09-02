# Nextcloud Storage Architecture

Nextcloud is deployed with a mostly stateless application tier. Persistent state is separated by purpose:

|Storage|Purpose|Persistence|
|---|---|---|
|**PostgreSQL**|Users, groups, shares, file metadata, app configuration, calendars, contacts, Deck/Form data, and other application state|Critical|
|**Garage S3**|Actual user file/object contents|Critical|
|**Git + ConfigMap**|Declarative Nextcloud `config.php`, app list, versions, and deployment configuration|Reconstructable from Git|
|**Kubernetes Secrets**|Database credentials, Nextcloud secret/salt, S3 credentials, companion-app secrets|Critical|
|**NFS (**`**nextcloud-apps**`**)**|Downloaded Nextcloud application PHP/code shared between replicas|Reconstructable|
|**Redis**|Cache, distributed locking, and other transient runtime state|Disposable|
|**Pod filesystem**|Nextcloud runtime/core files|Disposable|

### Data Flow

```
Nextcloud Pods
├── PostgreSQL → application state and metadata
├── Garage S3  → user file contents
├── Redis      → cache and locking
├── NFS        → installed app code
└── Git/ConfigMap + Secrets → server configuration
```

Nextcloud uses an external PostgreSQL database rather than its internal database. User file storage is configured through the S3 object-store settings.

The primary `config.php` is declaratively supplied through the `nextcloud-shared-config` ConfigMap and is marked read-only.

Third-party Nextcloud application code resides on the `nextcloud-apps` RWX NFS volume.

**Recovery-critical data:** PostgreSQL + Garage S3 + Kubernetes Secrets + Git.  
**Reconstructable/disposable:** NFS app code, Redis state, and individual Nextcloud pod filesystems.