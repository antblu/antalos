import { Migration } from "@medusajs/framework/mikro-orm/migrations"
export class Migration20261105000000 extends Migration {
  async up(): Promise<void> { this.addSql('alter table lifecycle_event alter column order_id drop not null') }
  async down(): Promise<void> { throw new Error("Account welcome history must be retained") }
}
