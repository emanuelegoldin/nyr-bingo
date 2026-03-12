-- Migration: V1_0_1__define_procedures.sql
-- Create_Table procedure
--    p_tableName: Name of the table to create
--    p_createDefaultColumns: If 1, includes createdAt and updatedAt columns
-- Primary Key is always <tableName>ID.
-- This procedure is idempotent and can be safely re-run without affecting existing tables.
DELIMITER $$
DROP PROCEDURE IF EXISTS Create_Table$$
CREATE PROCEDURE Create_Table(
    IN p_tableName VARCHAR(255),
    IN p_createDefaultColumns INT
)
MODIFIES SQL DATA
NOT DETERMINISTIC
COMMENT 'Create a new table with optional default columns'
BEGIN
    DECLARE v_sqlStatement LONGTEXT;
    DECLARE v_tableExists INT DEFAULT 0;
    
    -- Check if table already exists
    SELECT COUNT(*) INTO v_tableExists
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_tableName;
    
    IF v_tableExists = 0 THEN
        -- Build the CREATE TABLE statement
        SET v_sqlStatement = CONCAT(
            'CREATE TABLE `', TRIM(p_tableName), '` (',
            '`', TRIM(p_tableName), 'ID` INT AUTO_INCREMENT PRIMARY KEY'
        );
        
        IF p_createDefaultColumns = 1 THEN
            SET v_sqlStatement = CONCAT(
                v_sqlStatement,
                ', `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
            );
        END IF;
        
        SET v_sqlStatement = CONCAT(v_sqlStatement, ')');
        
        -- Execute the prepared statement
        SET @sql = v_sqlStatement;
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

-- Drop_Table procedure
--    p_tableName: Name of the table to drop
-- This procedure is idempotent and can be safely re-run without affecting existing tables.
DELIMITER $$
DROP PROCEDURE IF EXISTS Drop_Table$$
CREATE PROCEDURE Drop_Table(
    IN p_tableName VARCHAR(255)
)
MODIFIES SQL DATA
NOT DETERMINISTIC
COMMENT 'Drop a table if it exists'
BEGIN
    DECLARE v_sqlStatement LONGTEXT;
    SET v_sqlStatement = CONCAT('DROP TABLE IF EXISTS `', TRIM(p_tableName), '`');
    SET @sql = v_sqlStatement;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END$$

DELIMITER ;

-- Add_Column procedure
--    p_tableName: Name of the table to alter
--    p_columnName: Name of the column to add
--    p_columnType: Data type of the column (e.g. VARCHAR(255))
--    p_isNullable: If 1, column will allow NULL values; if 0, NOT NULL
--    p_defaultValue: Default value for the column (optional, use NULL if not needed)
--    p_referencedTable: If not NULL, adds a foreign key constraint referencing this table's ID column
-- This procedure is idempotent and can be safely re-run without affecting existing columns.
DELIMITER $$
DROP PROCEDURE IF EXISTS Add_Column$$
CREATE PROCEDURE Add_Column(
    IN p_tableName VARCHAR(255),
    IN p_columnName VARCHAR(255),
    IN p_columnType VARCHAR(255),
    IN p_isNullable INT,
    IN p_defaultValue VARCHAR(255),
    IN p_referencedTable VARCHAR(255)
)
MODIFIES SQL DATA
NOT DETERMINISTIC
COMMENT 'Add a column to a table with optional default value and foreign key constraint'
BEGIN
    DECLARE v_sqlStatement LONGTEXT;
    DECLARE v_columnExists INT DEFAULT 0;
    
    -- Check if column already exists
    SELECT COUNT(*) INTO v_columnExists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_tableName
    AND COLUMN_NAME = p_columnName;

    IF v_columnExists = 0 THEN
        -- Build the ALTER TABLE statement
        SET v_sqlStatement = CONCAT(
            'ALTER TABLE `', TRIM(p_tableName), '` ADD COLUMN `', TRIM(p_columnName), '` ', p_columnType,
            IF(p_isNullable = 1, ' NULL', ' NOT NULL'),
            IF(p_defaultValue IS NOT NULL AND LOWER(TRIM(p_defaultValue)) != 'null' AND TRIM(p_defaultValue) != '', CONCAT(' DEFAULT \'', p_defaultValue, '\''), '')
        );
        
        -- Execute the prepared statement to add the column
        SET @sql = v_sqlStatement;
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        
        -- If a referenced table is specified, add a foreign key constraint
        IF p_referencedTable IS NOT NULL THEN
            SET v_sqlStatement = CONCAT(
                'ALTER TABLE `', TRIM(p_tableName), '` ADD CONSTRAINT `fk_', TRIM(p_tableName), '_', TRIM(p_columnName), '` FOREIGN KEY (`', TRIM(p_columnName), '`) REFERENCES `', TRIM(p_referencedTable), '`(`', TRIM(p_referencedTable), 'ID`) ON DELETE CASCADE'
            );
            SET @sql = v_sqlStatement;
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
    END IF;
END$$

DELIMITER ;
