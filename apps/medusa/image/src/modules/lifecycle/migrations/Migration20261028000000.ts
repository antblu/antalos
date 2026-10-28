import { Migration } from "@medusajs/framework/mikro-orm/migrations"
export class Migration20261028000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`create table if not exists lifecycle_event (
      id text primary key, key text not null unique, channel text not null check (channel in ('email','odoo')),
      kind text not null, order_id text not null, payload jsonb not null,
      status text not null default 'pending' check (status in ('pending','sending','sent','retrying','review')),
      attempts integer not null default 0, available_at timestamptz not null,
      sent_at timestamptz null, provider_id text null, failure text null,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz null
    )`)
    this.addSql(`create index if not exists lifecycle_event_due on lifecycle_event (available_at) where status in ('pending','retrying') and deleted_at is null`)
  }
  async down(): Promise<void> { throw new Error("Retain lifecycle delivery history to prevent duplicate notifications") }
}
