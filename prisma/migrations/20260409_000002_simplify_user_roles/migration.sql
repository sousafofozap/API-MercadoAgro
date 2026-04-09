-- Simplify public user roles to USER and keep ADMIN separate
ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "UserRole"
  USING (
    CASE
      WHEN "role"::text = 'ADMIN' THEN 'ADMIN'::"UserRole"
      ELSE 'USER'::"UserRole"
    END
  ),
  ALTER COLUMN "role" SET DEFAULT 'USER';

DROP TYPE "UserRole_old";
