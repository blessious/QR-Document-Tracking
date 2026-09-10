ALTER TABLE `users`
  ADD COLUMN `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `last_failed_login_at` DATETIME(3) NULL,
  ADD COLUMN `locked_until` DATETIME(3) NULL;

ALTER TABLE `documents`
  ADD COLUMN `public_token_hash` CHAR(64) NULL,
  ADD COLUMN `public_token_issued_at` DATETIME(3) NULL,
  ADD COLUMN `public_token_revoked_at` DATETIME(3) NULL,
  ADD UNIQUE INDEX `documents_public_token_hash_key` (`public_token_hash`);
