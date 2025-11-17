import { MigrationInterface, QueryRunner } from 'typeorm'

export class PlatformMetrics1710000006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create platform_metrics table for storing live social data from Apify
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        platform VARCHAR(50) NOT NULL,
        metric_type VARCHAR(100) NOT NULL,
        engagement INTEGER DEFAULT 0,
        velocity DECIMAL(10,2) DEFAULT 0,
        value JSONB NOT NULL DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    // Create indexes for efficient querying
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_platform_metrics_created
      ON platform_metrics("createdAt")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_platform_metrics_platform
      ON platform_metrics(platform)
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_platform_metrics_type
      ON platform_metrics(metric_type)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_platform_metrics_type`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_platform_metrics_platform`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_platform_metrics_created`)
    await queryRunner.query(`DROP TABLE IF EXISTS platform_metrics`)
  }
}
