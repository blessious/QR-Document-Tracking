-- Make document types local to the office that creates and maintains them.
-- Existing records are retained: types used by a document are assigned to that
-- document's origin office; unused legacy types fall back to the first office.
ALTER TABLE `document_types`
  ADD COLUMN `office_id` VARCHAR(191) NULL;

UPDATE `document_types` AS `types`
INNER JOIN `documents` AS `documents` ON `documents`.`type_id` = `types`.`id`
SET `types`.`office_id` = `documents`.`origin_office_id`
WHERE `types`.`office_id` IS NULL;

UPDATE `document_types`
SET `office_id` = (SELECT `id` FROM `offices` ORDER BY `created_at` ASC LIMIT 1)
WHERE `office_id` IS NULL;

ALTER TABLE `document_types`
  MODIFY COLUMN `office_id` VARCHAR(191) NOT NULL,
  DROP INDEX `document_types_code_key`,
  ADD UNIQUE INDEX `document_types_office_id_code_key` (`office_id`, `code`),
  ADD INDEX `document_types_office_id_active_idx` (`office_id`, `active`),
  ADD CONSTRAINT `document_types_office_id_fkey`
    FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
