import { MigrationInterface, QueryRunner } from "typeorm"

export class Rls1710000001000 implements MigrationInterface {
  name = 'Rls1710000001000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS app`)
    await queryRunner.query(`CREATE OR REPLACE FUNCTION app.set_current_user(uid uuid) RETURNS void AS $$
      BEGIN PERFORM set_config('app.current_user_id', uid::text, true); END; $$ LANGUAGE plpgsql;`)

    // Enable RLS and policies
    for (const tbl of ['creators','trends','content_assets']) {
      await queryRunner.query(`ALTER TABLE ${tbl} ENABLE ROW LEVEL SECURITY`)
      await queryRunner.query(`DROP POLICY IF EXISTS ${tbl}_is_owner_read ON ${tbl}`)
      await queryRunner.query(`DROP POLICY IF EXISTS ${tbl}_is_owner_write ON ${tbl}`)
      await queryRunner.query(`CREATE POLICY ${tbl}_is_owner_read ON ${tbl}
        FOR SELECT USING ("ownerId"::text = current_setting('app.current_user_id', true))`)
      await queryRunner.query(`CREATE POLICY ${tbl}_is_owner_write ON ${tbl}
        FOR ALL USING ("ownerId"::text = current_setting('app.current_user_id', true))`)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tbl of ['creators','trends','content_assets']) {
      await queryRunner.query(`ALTER TABLE ${tbl} DISABLE ROW LEVEL SECURITY`)
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS app.set_current_user`)
  }
}

