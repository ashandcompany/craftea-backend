import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResetPasswordTokenToUsers1743422000000 implements MigrationInterface {
  name = 'AddResetPasswordTokenToUsers1743422000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "reset_password_token" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "reset_password_expires" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "reset_password_expires"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "reset_password_token"`,
    );
  }
}
