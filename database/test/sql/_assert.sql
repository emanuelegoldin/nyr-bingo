-- Assertion helpers for the SQL procedure tests, loaded into the scratch database before each test file.
-- A failed assertion signals SQLSTATE 45001, so it is never swallowed by a test's handler for 45000
-- (the state the procedures under test signal).
-- Spec Reference: none - the contract is the header comment of each procedure in
-- database-migrations/V1_0_1__define_procedures.sql

DELIMITER $$

DROP PROCEDURE IF EXISTS assert_equals$$
CREATE PROCEDURE assert_equals(IN p_label VARCHAR(512), IN p_expected TEXT, IN p_actual TEXT)
BEGIN
    DECLARE v_message VARCHAR(512);
    IF NOT (p_expected <=> p_actual) THEN
        SET v_message = LEFT(CONCAT('FAIL: ', p_label, ': expected ', IFNULL(p_expected, 'NULL'),
            ', got ', IFNULL(p_actual, 'NULL')), 512);
        SIGNAL SQLSTATE '45001' SET MESSAGE_TEXT = v_message;
    END IF;
    SELECT CONCAT('ok - ', p_label) AS result;
END$$

DROP FUNCTION IF EXISTS has_table$$
CREATE FUNCTION has_table(p_table VARCHAR(255)) RETURNS INT
READS SQL DATA
BEGIN
    RETURN (SELECT COUNT(*) FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table);
END$$

DROP FUNCTION IF EXISTS has_column$$
CREATE FUNCTION has_column(p_table VARCHAR(255), p_column VARCHAR(255)) RETURNS INT
READS SQL DATA
BEGIN
    RETURN (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column);
END$$

DROP FUNCTION IF EXISTS column_type$$
CREATE FUNCTION column_type(p_table VARCHAR(255), p_column VARCHAR(255)) RETURNS VARCHAR(255)
READS SQL DATA
BEGIN
    RETURN (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column);
END$$

DROP FUNCTION IF EXISTS column_nullable$$
CREATE FUNCTION column_nullable(p_table VARCHAR(255), p_column VARCHAR(255)) RETURNS VARCHAR(3)
READS SQL DATA
BEGIN
    RETURN (SELECT IS_NULLABLE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column);
END$$

DROP FUNCTION IF EXISTS foreign_key_count$$
CREATE FUNCTION foreign_key_count(p_table VARCHAR(255)) RETURNS INT
READS SQL DATA
BEGIN
    RETURN (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND CONSTRAINT_TYPE = 'FOREIGN KEY');
END$$

DELIMITER ;
