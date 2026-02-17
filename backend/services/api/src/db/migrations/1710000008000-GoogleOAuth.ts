import { MigrationInterface, QueryRunner } from "typeorm"

export class GoogleOAuth1710000008000 implements MigrationInterface {
  name = 'GoogleOAuth1710000008000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN "passwordHash" DROP NOT NULL`)
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "googleId" text`)
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "displayName" text`)
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "avatarUrl" text`)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users("googleId") WHERE "googleId" IS NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_google_id`)
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "avatarUrl"`)
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "displayName"`)
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "googleId"`)
  }
}
