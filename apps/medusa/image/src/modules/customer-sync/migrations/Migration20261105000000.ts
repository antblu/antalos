import { Migration } from "@medusajs/framework/mikro-orm/migrations"
export class Migration20261105000000 extends Migration {
  async up(): Promise<void> { this.addSql('alter table sync_identity add column if not exists newsletter_welcome_state text null') }
  async down(): Promise<void> { throw new Error("Retain welcome delivery state to avoid duplicate messages") }
}
