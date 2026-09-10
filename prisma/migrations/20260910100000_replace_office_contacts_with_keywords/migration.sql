-- Office lookup terms are maintained by administrators. The former head and
-- contact fields are no longer part of the office directory.
ALTER TABLE `offices`
  ADD COLUMN `keywords` TEXT NULL;

UPDATE `offices`
SET `keywords` = ''
WHERE `keywords` IS NULL;

ALTER TABLE `offices`
  MODIFY COLUMN `keywords` TEXT NOT NULL,
  DROP COLUMN `head`,
  DROP COLUMN `contact`;
