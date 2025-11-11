import { MigrationInterface, QueryRunner } from 'typeorm'

export class MvpExtras1710000002000 implements MigrationInterface {
  name = 'MvpExtras1710000002000'

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS projects (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "ownerId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      concept text NOT NULL,
      persona text NOT NULL DEFAULT 'Social Strategist',
      platforms text[] NOT NULL DEFAULT '{}',
      "areasOfInterest" text[] NOT NULL DEFAULT '{}',
      narrative text,
      scores jsonb NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    ); CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects("ownerId");`)

    await q.query(`CREATE TABLE IF NOT EXISTS ai_cache (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`)

    await q.query(`CREATE TABLE IF NOT EXISTS platform_metrics (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "trendId" uuid NOT NULL,
      platform text NOT NULL,
      engagement int NOT NULL DEFAULT 0,
      velocity float NOT NULL DEFAULT 0,
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "createdAt" timestamptz NOT NULL DEFAULT now()
    ); CREATE INDEX IF NOT EXISTS idx_pm_trend ON platform_metrics("trendId"); CREATE INDEX IF NOT EXISTS idx_pm_platform ON platform_metrics(platform);`)

    // RLS for projects
    await q.query(`ALTER TABLE projects ENABLE ROW LEVEL SECURITY`)
    await q.query(`DROP POLICY IF EXISTS projects_is_owner_read ON projects`)
    await q.query(`DROP POLICY IF EXISTS projects_is_owner_write ON projects`)
    await q.query(`CREATE POLICY projects_is_owner_read ON projects FOR SELECT USING ("ownerId"::text = current_setting('app.current_user_id', true))`)
    await q.query(`CREATE POLICY projects_is_owner_write ON projects FOR ALL USING ("ownerId"::text = current_setting('app.current_user_id', true))`)
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS platform_metrics')
    await q.query('DROP TABLE IF EXISTS ai_cache')
    await q.query('DROP TABLE IF EXISTS projects')
  }
}

