ALTER TABLE `document_types`
  DROP FOREIGN KEY `document_types_default_workflow_id_fkey`;

ALTER TABLE `documents`
  DROP FOREIGN KEY `documents_workflow_id_fkey`;

ALTER TABLE `document_types`
  DROP COLUMN `default_workflow_id`;

ALTER TABLE `documents`
  DROP COLUMN `workflow_id`,
  DROP COLUMN `current_step_index`;

DROP TABLE `workflow_steps`;
DROP TABLE `workflows`;
