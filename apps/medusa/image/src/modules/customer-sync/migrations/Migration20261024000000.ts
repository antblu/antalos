import { Migration } from "@medusajs/framework/mikro-orm/migrations"
export class Migration20261024000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`create table if not exists "sync_identity" (
      "id" text primary key, "email" text not null, "customer_id" text null,
      "odoo_id" integer null, "mautic_id" integer null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
    )`)
    for (const field of ["email", "customer_id", "odoo_id", "mautic_id"]) {
      this.addSql(`create unique index if not exists "IDX_sync_identity_${field}" on "sync_identity" ("${field}") where "deleted_at" is null`)
    }
    this.addSql(`create table if not exists "sync_decision" (
      "id" text primary key, "identity_id" text not null, "revision" integer not null,
      "kind" text not null check ("kind" in ('legal', 'marketing', 'profile')),
      "payload" jsonb not null, "delivered" boolean not null default false,
      "attempts" integer not null default 0, "available_at" timestamptz not null, "failure" text null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
    )`)
    this.addSql(`create index if not exists "IDX_sync_decision_due" on "sync_decision" ("available_at", "created_at") where "delivered" = false and "deleted_at" is null`)
    this.addSql(`create index if not exists "IDX_sync_decision_identity" on "sync_decision" ("identity_id", "created_at") where "deleted_at" is null`)
    this.addSql(`create unique index "IDX_sync_decision_revision" on "sync_decision" ("identity_id", "revision")`)
    // Enforce audit immutability independently of application service callers.
    this.addSql(`create or replace function sync_decision_immutable() returns trigger language plpgsql as $$
      begin
        if TG_OP = 'DELETE' then raise exception 'Integration audit records cannot be deleted'; end if;
        if OLD.kind in ('legal', 'marketing') and (NEW.revision is distinct from OLD.revision or NEW.payload is distinct from OLD.payload or NEW.kind is distinct from OLD.kind or NEW.identity_id is distinct from OLD.identity_id or NEW.deleted_at is distinct from OLD.deleted_at) then
          raise exception 'Integration audit payloads are immutable';
        end if;
        return NEW;
      end $$`)
    this.addSql(`create trigger sync_decision_audit before update or delete on sync_decision for each row execute function sync_decision_immutable()`)
  }
  async down(): Promise<void> { throw new Error("Audit history requires an explicit retention/recovery plan; automatic rollback is disabled") }
}
