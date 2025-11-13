import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Add pgvector extension and embedding columns for semantic search
 *
 * Adds vector(1536) columns to:
 * - trends: for semantic search of trend labels and signals
 * - creators: for semantic search of creator names and categories
 * - content_assets: for semantic search of uploaded content
 *
 * Uses OpenAI text-embedding-3-small (1536 dimensions)
 */
export class VectorEmbeddings1710000004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`)

    // Add embedding column to trends table
    await queryRunner.query(`
      ALTER TABLE trends
      ADD COLUMN IF NOT EXISTS embedding vector(1536)
    `)

    // Add embedding column to creators table
    await queryRunner.query(`
      ALTER TABLE creators
      ADD COLUMN IF NOT EXISTS embedding vector(1536)
    `)

    // Add embedding column to content_assets table
    await queryRunner.query(`
      ALTER TABLE content_assets
      ADD COLUMN IF NOT EXISTS embedding vector(1536)
    `)

    // Create indexes for cosine similarity search (using vector_cosine_ops)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trends_embedding_idx
      ON trends USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS creators_embedding_idx
      ON creators USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS content_assets_embedding_idx
      ON content_assets USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS trends_embedding_idx`)
    await queryRunner.query(`DROP INDEX IF EXISTS creators_embedding_idx`)
    await queryRunner.query(`DROP INDEX IF EXISTS content_assets_embedding_idx`)

    // Remove embedding columns
    await queryRunner.query(`ALTER TABLE trends DROP COLUMN IF EXISTS embedding`)
    await queryRunner.query(`ALTER TABLE creators DROP COLUMN IF EXISTS embedding`)
    await queryRunner.query(`ALTER TABLE content_assets DROP COLUMN IF EXISTS embedding`)

    // Note: Not dropping vector extension in case other tables use it
  }
}
