-- Tests for Drop_Column: it drops the column and its foreign key, and does nothing when the column is gone.
-- Spec Reference: none - header comment of Drop_Column in database-migrations/V1_0_1__define_procedures.sql

DELIMITER $$

-- Drop_Column drops the column
BEGIN NOT ATOMIC
    -- Arrange
    CREATE TABLE dc_plain (id INT, label VARCHAR(10));

    -- Act
    CALL Drop_Column('dc_plain', 'label');

    -- Assert
    CALL assert_equals('Drop_Column: drops the column', '0', has_column('dc_plain', 'label'));
END$$

-- Drop_Column drops the column's foreign key first
BEGIN NOT ATOMIC
    -- Arrange
    CREATE TABLE dc_parent (dc_parentID INT PRIMARY KEY);
    CREATE TABLE dc_child (id INT, parent_id INT,
        CONSTRAINT fk_dc_child_parent_id FOREIGN KEY (parent_id) REFERENCES dc_parent (dc_parentID));

    -- Act
    CALL Drop_Column('dc_child', 'parent_id');

    -- Assert
    CALL assert_equals('Drop_Column: drops the column and its foreign key',
        '0 0',
        CONCAT(has_column('dc_child', 'parent_id'), ' ', foreign_key_count('dc_child')));
END$$

-- Drop_Column does not fail when the column does not exist
BEGIN NOT ATOMIC
    DECLARE v_failed INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_failed = 1;
    -- Arrange
    CREATE TABLE dc_missing (id INT);

    -- Act
    CALL Drop_Column('dc_missing', 'label');

    -- Assert
    CALL assert_equals('Drop_Column: missing column is not an error', '0', v_failed);
END$$

DELIMITER ;
