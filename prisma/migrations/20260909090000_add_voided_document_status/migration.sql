ALTER TABLE `documents`
    MODIFY `status` ENUM('registered', 'in_transit', 'received', 'in_process', 'on_hold', 'returned', 'completed', 'filed', 'voided') NOT NULL DEFAULT 'registered';

ALTER TABLE `tracking_events`
    MODIFY `action` ENUM('registered', 'dispatched', 'received', 'processed', 'held', 'returned', 'completed', 'filed', 'wrong_office', 'voided') NOT NULL;
