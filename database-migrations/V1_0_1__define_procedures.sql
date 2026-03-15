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

-- Create_Column procedure
--    p_tableName: Name of the table to alter
--    p_columnName: Name of the column to add
--    p_columnType: Data type of the column (e.g. VARCHAR(255))
--    p_isNullable: If 1, column will allow NULL values; if 0, NOT NULL
--    p_defaultValue: Default value for the column (optional, use NULL if not needed)
--    p_referencedTable: If not NULL, adds a foreign key constraint referencing this table's ID column
-- This procedure is idempotent and can be safely re-run without affecting existing columns.
DELIMITER $$
DROP PROCEDURE IF EXISTS Create_Column$$
CREATE PROCEDURE Create_Column(
    IN p_tableName VARCHAR(255),
    IN p_columnName VARCHAR(255),
    IN p_columnType VARCHAR(255),
    IN p_isNullable INT,
    IN p_defaultValue VARCHAR(255),
    IN p_referencedTable VARCHAR(255),
    IN p_referencedColumn VARCHAR(255)
)
MODIFIES SQL DATA
NOT DETERMINISTIC
COMMENT 'Add a column to a table with optional default value and foreign key constraint'
proc_body: BEGIN
    DECLARE v_sqlStatement LONGTEXT;
    DECLARE v_columnExists INT DEFAULT 0;
    DECLARE v_messageText VARCHAR(512);
    DECLARE v_referenced_table_exists INT DEFAULT 0;
    DECLARE v_referenced_column_exists INT DEFAULT 0;
    DECLARE v_fk_exists INT DEFAULT 0;
    DECLARE v_is_referenced_table_null INT DEFAULT 0;
    DECLARE v_is_referenced_column_null INT DEFAULT 0;

    SET v_is_referenced_table_null = IF(p_referencedTable IS NULL OR TRIM(p_referencedTable) = '', 1, 0);
    SET v_is_referenced_column_null = IF(p_referencedColumn IS NULL OR TRIM(p_referencedColumn) = '', 1, 0);
    
    -- If referencedTable is provided and referencedColumn is not, show meaningful error message and exit procedure
    IF v_is_referenced_table_null = 0 AND v_is_referenced_column_null = 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Referenced column must be provided if referenced table is specified';
    END IF;
    -- If referencedColumn is provided and referencedTable is not, show meaningful error message and exit procedure
    IF v_is_referenced_column_null = 1 AND v_is_referenced_table_null = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Referenced table must be provided if referenced column is specified';
    END IF;

    -- If referenceColumn in referencedTable does not exist, skip whole execution (likely dropped in a later migration); show warning message
    SET @referenced_column_exists = (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = p_referencedTable
        AND COLUMN_NAME = p_referencedColumn
    );
    IF v_is_referenced_column_null = 0 AND v_is_referenced_table_null = 0 AND @referenced_column_exists IS NULL THEN
        SET v_messageText = CONCAT('Warning: Referenced column ', p_referencedColumn, ' does not exist in table ', p_referencedTable, '; skipping foreign key constraint creation');
        SIGNAL SQLSTATE '01000' SET MESSAGE_TEXT = v_messageText;
        LEAVE proc_body;
    END IF;

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
        IF v_is_referenced_table_null = 0 THEN
            -- Check if foreign key constraint already exists
            SET @fk_exists = (
                SELECT 1
                FROM information_schema.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = p_tableName
                  AND CONSTRAINT_NAME = CONCAT('fk_', TRIM(p_tableName), '_', TRIM(p_columnName))
                  AND CONSTRAINT_TYPE = 'FOREIGN KEY'
            );
            SET v_sqlStatement = IF(
                @fk_exists IS NULL,
                 CONCAT(
                    'ALTER TABLE `', TRIM(p_tableName), '` ADD CONSTRAINT `fk_', TRIM(p_tableName), '_', TRIM(p_columnName), '` FOREIGN KEY (`', TRIM(p_columnName), '`) REFERENCES `', TRIM(p_referencedTable), '`(`', TRIM(p_referencedColumn), '`) ON DELETE CASCADE'
                ),
                'SELECT 1'
            );
            SET @sql = v_sqlStatement;
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
    END IF;
END$$

DELIMITER ;

-- Drop_Column procedure
--    p_tableName: Name of the table to alter
--    p_columnName: Name of the column to drop
-- This procedure is idempotent and can be safely re-run without affecting existing columns.
DELIMITER $$
DROP PROCEDURE IF EXISTS Drop_Column$$
CREATE PROCEDURE Drop_Column(
    IN p_tableName VARCHAR(255),
    IN p_columnName VARCHAR(255)
)
MODIFIES SQL DATA
NOT DETERMINISTIC
COMMENT 'Drop a column from a table if it exists'
BEGIN
    DECLARE v_fkName VARCHAR(255);
    DECLARE v_sqlStatement LONGTEXT;

    -- Drop any FK constraint referencing this column first
    SET v_fkName = (
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = p_tableName
          AND COLUMN_NAME = p_columnName
          AND REFERENCED_TABLE_NAME IS NOT NULL
        LIMIT 1
    );
    IF v_fkName IS NOT NULL THEN
        SET v_sqlStatement = CONCAT('ALTER TABLE `', TRIM(p_tableName), '` DROP FOREIGN KEY `', v_fkName, '`');
        SET @sql = v_sqlStatement;
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;

    -- Now drop the column
    SET v_sqlStatement = CONCAT('ALTER TABLE `', TRIM(p_tableName), '` DROP COLUMN IF EXISTS `', TRIM(p_columnName), '`');
    SET @sql = v_sqlStatement;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END$$

-- Move_Column_Without_Constraints procedure
--    p_fromTableName: Name of the source table; SHALL already exist
--    p_toTableName: Name of the destination table; SHALL already exist
--    p_fromColumnName: Name of the column to move; SHALL already exist in the source table
--    p_toColumnName: Name of the column in the destination table; if it does not exist, it will be created with the same type and nullability as the source column; if it already exists, it must be of a compatible type or the procedure will exit with an error
-- This procedure is idempotent and can be safely re-run without affecting existing columns.
DELIMITER $$
DROP PROCEDURE IF EXISTS Move_Column_Without_Constraints$$
CREATE PROCEDURE Move_Column_Without_Constraints(
    IN p_fromTableName VARCHAR(255),
    IN p_toTableName VARCHAR(255),
    IN p_fromColumnName VARCHAR(255),
    IN p_toColumnName VARCHAR(255)
)
MODIFIES SQL DATA
NOT DETERMINISTIC
COMMENT 'Move a column from one table to another'
BEGIN
    DECLARE v_columnExists INT DEFAULT 0;
    DECLARE v_destColumnExists INT DEFAULT 0;
    DECLARE v_fromColumnType VARCHAR(255);
    DECLARE v_toColumnType VARCHAR(255);
    DECLARE v_messageText VARCHAR(512);

    -- If fromTable is empty, exit procedure; show meaningful error message
    IF p_fromTableName IS NULL OR TRIM(p_fromTableName) = '' THEN
        SET v_messageText = 'Source table name cannot be null or empty';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_messageText;
    END IF;

    -- If toTable is empty, exit procedure; show meaningful error message
    IF p_toTableName IS NULL OR TRIM(p_toTableName) = '' THEN
        SET v_messageText = 'Destination table name cannot be null or empty';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_messageText;
    END IF;
    
    -- Check if source column exists
    SELECT COUNT(*) INTO v_columnExists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_fromTableName
    AND COLUMN_NAME = p_fromColumnName;

    -- If source column does not exist, exit procedure; show meaningful error message
    IF v_columnExists = 0 THEN
        SET v_messageText = CONCAT('Source column ', p_fromColumnName, ' does not exist in table ', p_fromTableName);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_messageText;
    END IF;

    -- IF source column exists, THEN check whether it has any FK constraints; if so, exit procedure and show meaningful error message (this procedure is only meant for moving columns without constraints)
    IF v_columnExists = 1 THEN
        IF EXISTS (
            SELECT 1
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = p_fromTableName
              AND COLUMN_NAME = p_fromColumnName
              AND REFERENCED_TABLE_NAME IS NOT NULL
        ) THEN
            SET v_messageText = CONCAT('Source column ', p_fromColumnName, ' in table ', p_fromTableName, ' has foreign key constraints; cannot move using this procedure');
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_messageText;
        END IF;
    END IF;

    -- Check if destination table exists, if not, exit procedure; show meaningful error message
    SELECT COUNT(*) INTO v_destColumnExists
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_toTableName;
    IF v_destColumnExists = 0 THEN
        SET v_messageText = CONCAT('Destination table ', p_toTableName, ' does not exist');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_messageText;
    END IF;

    -- Check if destination column already exists
    SELECT COUNT(*) INTO v_destColumnExists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_toTableName
    AND COLUMN_NAME = p_toColumnName;

    -- IF destination column already exists, THEN check if from column type is compatible with to column type
    IF v_destColumnExists = 1 THEN
        SELECT COLUMN_TYPE INTO v_fromColumnType
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = p_fromTableName
        AND COLUMN_NAME = p_fromColumnName;

        SELECT COLUMN_TYPE INTO v_toColumnType
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = p_toTableName
        AND COLUMN_NAME = p_toColumnName;

        IF v_fromColumnType != v_toColumnType THEN
            SET v_messageText = CONCAT('Destination column ', p_toColumnName, ' already exists in table ', p_toTableName, ' with incompatible type ', v_toColumnType);
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_messageText;
        END IF;
    END IF;

    -- Add column to destination table if it does not exist
    IF v_destColumnExists = 0 THEN
        CALL Create_Column(
            p_toTableName,
            p_toColumnName,
            (SELECT COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_fromTableName AND COLUMN_NAME = p_fromColumnName),
            (SELECT IF(IS_NULLABLE = 'YES', 1, 0) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_fromTableName AND COLUMN_NAME = p_fromColumnName),
            (SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_fromTableName AND COLUMN_NAME = p_fromColumnName),
            NULL
        );
    END IF;

    -- Copy data from source column to destination column
    SET @sql = CONCAT(
        'UPDATE `', TRIM(p_toTableName), '` dest JOIN `', TRIM(p_fromTableName), '` src ON dest.`', TRIM(p_toColumnName), '` = src.`', TRIM(p_fromColumnName), '` SET dest.`', TRIM(p_toColumnName), '` = src.`', TRIM(p_fromColumnName), '`'
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    -- Drop source column
    CALL Drop_Column(p_fromTableName, p_fromColumnName);
END$$