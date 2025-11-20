import { MigrationInterface, QueryRunner } from "typeorm"

export class TrendSummaries1710000007000 implements MigrationInterface {
  name = 'TrendSummaries1710000007000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS trend_summaries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        period text NOT NULL,
        platform text NOT NULL,
        window_start timestamptz NOT NULL,
        window_end timestamptz NOT NULL,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS trend_summaries_unique ON trend_summaries(period, platform, window_start)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS trend_summaries`)
  }
}

