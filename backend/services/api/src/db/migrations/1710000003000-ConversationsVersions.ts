import { MigrationInterface, QueryRunner } from 'typeorm'

export class ConversationsVersions1710000003000 implements MigrationInterface {
  name = 'ConversationsVersions1710000003000'

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS project_versions (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "projectId" uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      summary text NOT NULL,
      narrative text,
      scores jsonb NOT NULL DEFAULT '{}'::jsonb,
      "changeSummary" text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    ); CREATE INDEX IF NOT EXISTS idx_projvers_project ON project_versions("projectId");`)

    await q.query(`CREATE TABLE IF NOT EXISTS conversation_messages (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "projectId" uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role text NOT NULL,
      content text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    ); CREATE INDEX IF NOT EXISTS idx_conv_project ON conversation_messages("projectId");`)
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS conversation_messages')
    await q.query('DROP TABLE IF EXISTS project_versions')
  }
}

