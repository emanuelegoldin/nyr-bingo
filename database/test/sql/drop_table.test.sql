-- Tests for Drop_Table: it drops a table and does nothing when the table is gone.
-- Spec Reference: none - header comment of Drop_Table in database-migrations/V1_0_1__define_procedures.sql

DELIMITER $$

-- Drop_Table drops an existing table
BEGIN NOT ATOMIC
    -- Arrange
    CREATE TABLE dt_existing (id INT);

    -- Act
    CALL Drop_Table('dt_existing');

    -- Assert
    CALL assert_equals('Drop_Table: drops the table', '0', has_table('dt_existing'));
END$$

-- Drop_Table does not fail when the table does not exist
BEGIN NOT ATOMIC
    DECLARE v_failed INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_failed = 1;
    -- Arrange: no table dt_missing

    -- Act
    CALL Drop_Table('dt_missing');

    -- Assert
    CALL assert_equals('Drop_Table: missing table is not an error', '0', v_failed);
END$$

DELIMITER ;
