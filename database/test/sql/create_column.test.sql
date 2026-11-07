-- Tests for Create_Column: the column it adds, its foreign key, and the refused or skipped calls.
-- Spec Reference: none - header comment of Create_Column in database-migrations/V1_0_1__define_procedures.sql

DELIMITER $$

-- Create_Column adds the column with the given type
BEGIN NOT ATOMIC
    -- Arrange
    CREATE TABLE cc_type (id INT);

    -- Act
    CALL Create_Column('cc_type', 'label', 'VARCHAR(40)', 1, NULL, NULL, NULL, NULL);

    -- Assert
    CALL assert_equals('Create_Column: adds the column with its type', 'varchar(40)', column_type('cc_type', 'label'));
END$$

-- Create_Column makes the column NOT NULL when p_isNullable is 0
BEGIN NOT ATOMIC
    -- Arrange
    CREATE TABLE cc_not_null (id INT);

    -- Act
    CALL Create_Column('cc_not_null', 'label', 'INT', 0, NULL, NULL, NULL, NULL);

    -- Assert
    CALL assert_equals('Create_Column: p_isNullable 0 gives NOT NULL', 'NO', column_nullable('cc_not_null', 'label'));
END$$

-- Create_Column allows NULL when p_isNullable is 1
BEGIN NOT ATOMIC
    -- Arrange
    CREATE TABLE cc_nullable (id INT);

    -- Act
    CALL Create_Column('cc_nullable', 'label', 'INT', 1, NULL, NULL, NULL, NULL);

    -- Assert
    CALL assert_equals('Create_Column: p_isNullable 1 allows NULL', 'YES', column_nullable('cc_nullable', 'label'));
END$$

-- Create_Column sets the default value
BEGIN NOT ATOMIC
    -- Arrange
    CREATE TABLE cc_default (id INT);
    INSERT INTO cc_default VALUES (1);

    -- Act
    CALL Create_Column('cc_default', 'status', 'VARCHAR(10)', 0, 'open', NULL, NULL, NULL);

    -- Assert
    CALL assert_equals('Create_Column: existing rows get the default value', 'open', (SELECT status FROM cc_default));
END$$

-- Create_Column leaves an existing column untouched
BEGIN NOT ATOMIC
    -- Arrange
    CREATE TABLE cc_existing (id INT, label VARCHAR(10));

    -- Act
    CALL Create_Column('cc_existing', 'label', 'INT', 1, NULL, NULL, NULL, NULL);

    -- Assert
    CALL assert_equals('Create_Column: second run keeps the existing column', 'varchar(10)', column_type('cc_existing', 'label'));
END$$

-- Create_Column names the foreign key fk_<table>_<column> and points it at the referenced column
BEGIN NOT ATOMIC
    -- Arrange
    CREATE TABLE cc_parent (cc_parentID INT PRIMARY KEY);
    CREATE TABLE cc_child (id INT);

    -- Act
    CALL Create_Column('cc_child', 'parent_id', 'INT', 1, NULL, 'cc_parent', 'cc_parentID', NULL);

    -- Assert
    CALL assert_equals('Create_Column: foreign key fk_<table>_<column> to the referenced column',
        'cc_parent.cc_parentID',
        (SELECT CONCAT(REFERENCED_TABLE_NAME, '.', REFERENCED_COLUMN_NAME) FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cc_child' AND CONSTRAINT_NAME = 'fk_cc_child_parent_id'));
END$$

-- Create_Column applies the ON DELETE action to the foreign key
BEGIN NOT ATOMIC
    -- Arrange
    CREATE TABLE cc_owner (cc_ownerID INT PRIMARY KEY);
    CREATE TABLE cc_owned (id INT);

    -- Act
    CALL Create_Column('cc_owned', 'owner_id', 'INT', 1, NULL, 'cc_owner', 'cc_ownerID', 'CASCADE');

    -- Assert
    CALL assert_equals('Create_Column: foreign key uses the ON DELETE action',
        'CASCADE',
        (SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_cc_owned_owner_id'));
END$$

-- Create_Column refuses a referenced table without a referenced column
BEGIN NOT ATOMIC
    DECLARE v_caught INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET v_caught = 1;
    -- Arrange
    CREATE TABLE cc_no_ref_column (id INT);

    -- Act
    CALL Create_Column('cc_no_ref_column', 'parent_id', 'INT', 1, NULL, 'cc_parent', NULL, NULL);

    -- Assert
    CALL assert_equals('Create_Column: referenced table without column signals 45000', '1', v_caught);
END$$

-- Create_Column refuses a referenced column without a referenced table
BEGIN NOT ATOMIC
    DECLARE v_caught INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET v_caught = 1;
    -- Arrange
    CREATE TABLE cc_no_ref_table (id INT);

    -- Act
    CALL Create_Column('cc_no_ref_table', 'parent_id', 'INT', 1, NULL, NULL, 'cc_parentID', NULL);

    -- Assert
    CALL assert_equals('Create_Column: referenced column without table signals 45000', '1', v_caught);
END$$

-- Create_Column skips the whole call when the referenced column does not exist
BEGIN NOT ATOMIC
    -- Arrange
    CREATE TABLE cc_gone_parent (cc_gone_parentID INT PRIMARY KEY);
    CREATE TABLE cc_gone_child (id INT);

    -- Act
    CALL Create_Column('cc_gone_child', 'parent_id', 'INT', 1, NULL, 'cc_gone_parent', 'dropped_column', NULL);

    -- Assert
    CALL assert_equals('Create_Column: missing referenced column skips the column', '0', has_column('cc_gone_child', 'parent_id'));
END$$

DELIMITER ;
