import { MigrationInterface, QueryRunner } from 'typeorm'

export class ContentAssetsProjectId1710000005000 implements MigrationInterface {
  name = 'ContentAssetsProjectId1710000005000'

  public async up(q: QueryRunner): Promise<void> {
    // Add nullable projectId column to content_assets
    await q.query(`
      ALTER TABLE content_assets
      ADD COLUMN IF NOT EXISTS "projectId" uuid REFERENCES projects(id) ON DELETE CASCADE
    `)

    // Create index for projectId queries
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_content_assets_project
      ON content_assets("projectId")
    `)

    // Create index for RKB queries (WHERE projectId IS NULL)
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_content_assets_rkb
      ON content_assets("projectId") WHERE "projectId" IS NULL
    `)
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX IF EXISTS idx_content_assets_rkb')
    await q.query('DROP INDEX IF EXISTS idx_content_assets_project')
    await q.query('ALTER TABLE content_assets DROP COLUMN IF EXISTS "projectId"')
  }
}
