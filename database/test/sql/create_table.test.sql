-- Tests for Create_Table: the table it builds and that a second run changes nothing.
-- Spec Reference: none - header comment of Create_Table in database-migrations/V1_0_1__define_procedures.sql

DELIMITER $$

-- Create_Table names the primary key <table>ID
BEGIN NOT ATOMIC
    -- Arrange: nothing to set up

    -- Act
    CALL Create_Table('ct_key', 0);

    -- Assert
    CALL assert_equals('Create_Table: primary key is <table>ID',
        'ct_keyID',
        (SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ct_key' AND COLUMN_KEY = 'PRI'));
END$$

-- Create_Table adds only the key when default columns are not asked for
BEGIN NOT ATOMIC
    -- Arrange: nothing to set up

    -- Act
    CALL Create_Table('ct_plain', 0);

    -- Assert
    CALL assert_equals('Create_Table: no default columns when not asked for',
        '1',
        (SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ct_plain'));
END$$

-- Create_Table adds createdAt and updatedAt when asked for
BEGIN NOT ATOMIC
    -- Arrange: nothing to set up

    -- Act
    CALL Create_Table('ct_defaults', 1);

    -- Assert
    CALL assert_equals('Create_Table: default columns createdAt and updatedAt',
        '2',
        has_column('ct_defaults', 'createdAt') + has_column('ct_defaults', 'updatedAt'));
END$$

-- Create_Table leaves an existing table and its rows untouched
BEGIN NOT ATOMIC
    -- Arrange
    CALL Create_Table('ct_existing', 0);
    INSERT INTO ct_existing VALUES (1);

    -- Act
    CALL Create_Table('ct_existing', 1);

    -- Assert
    CALL assert_equals('Create_Table: second run keeps the existing table',
        '1 0',
        CONCAT((SELECT COUNT(*) FROM ct_existing), ' ', has_column('ct_existing', 'createdAt')));
END$$

DELIMITER ;
