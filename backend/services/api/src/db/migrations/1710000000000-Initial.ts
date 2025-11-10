import { MigrationInterface, QueryRunner } from "typeorm"

export class Initial1710000000000 implements MigrationInterface {
  name = 'Initial1710000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      email text UNIQUE NOT NULL,
      "passwordHash" text NOT NULL,
      role text NOT NULL DEFAULT 'user',
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`)

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS creators (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name text NOT NULL,
      platform text,
      category text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      "ownerId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    ); CREATE INDEX IF NOT EXISTS idx_creators_owner ON creators("ownerId");`)

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS trends (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      label text NOT NULL,
      signals jsonb NOT NULL DEFAULT '{}'::jsonb,
      metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
      "ownerId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    ); CREATE INDEX IF NOT EXISTS idx_trends_owner ON trends("ownerId");`)

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS content_assets (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name text NOT NULL,
      url text,
      tags jsonb NOT NULL DEFAULT '{}'::jsonb,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      "ownerId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    ); CREATE INDEX IF NOT EXISTS idx_assets_owner ON content_assets("ownerId");`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS content_assets`)
    await queryRunner.query(`DROP TABLE IF EXISTS trends`)
    await queryRunner.query(`DROP TABLE IF EXISTS creators`)
    await queryRunner.query(`DROP TABLE IF EXISTS users`)
  }
}

