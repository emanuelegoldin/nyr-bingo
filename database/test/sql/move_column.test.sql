-- Tests for Move_Column_Without_Constraints: the destination column it creates, the source column it
-- drops, and the moves it refuses. The data copy is not tested: see the gap report (it copies nothing).
-- Spec Reference: none - header comment of Move_Column_Without_Constraints in
-- database-migrations/V1_0_1__define_procedures.sql

DELIMITER $$

-- Move_Column_Without_Constraints creates the destination column with the source type and nullability
BEGIN NOT ATOMIC
    -- Arrange
    CREATE TABLE mc_from_shape (id INT, label VARCHAR(20) NOT NULL);
    CREATE TABLE mc_to_shape (id INT);

    -- Act
    CALL Move_Column_Without_Constraints('mc_from_shape', 'mc_to_shape', 'label', 'title');

    -- Assert
    CALL assert_equals('Move_Column: destination column copies type and nullability',
        'varchar(20) NO',
        CONCAT(column_type('mc_to_shape', 'title'), ' ', column_nullable('mc_to_shape', 'title')));
END$$

-- Move_Column_Without_Constraints drops the source column
BEGIN NOT ATOMIC
    -- Arrange
    CREATE TABLE mc_from_drop (id INT, label VARCHAR(20));
    CREATE TABLE mc_to_drop (id INT);

    -- Act
    CALL Move_Column_Without_Constraints('mc_from_drop', 'mc_to_drop', 'label', 'label');

    -- Assert
    CALL assert_equals('Move_Column: drops the source column', '0', has_column('mc_from_drop', 'label'));
END$$

-- Move_Column_Without_Constraints accepts an existing destination column of the same type
BEGIN NOT ATOMIC
    DECLARE v_failed INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_failed = 1;
    -- Arrange
    CREATE TABLE mc_from_same (id INT, label VARCHAR(20));
    CREATE TABLE mc_to_same (id INT, label VARCHAR(20));

    -- Act
    CALL Move_Column_Without_Constraints('mc_from_same', 'mc_to_same', 'label', 'label');

    -- Assert
    CALL assert_equals('Move_Column: existing destination column of the same type is accepted', '0', v_failed);
END$$

-- Move_Column_Without_Constraints refuses an empty source table name
BEGIN NOT ATOMIC
    DECLARE v_caught INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET v_caught = 1;
    -- Arrange
    CREATE TABLE mc_to_no_source (id INT);

    -- Act
    CALL Move_Column_Without_Constraints('', 'mc_to_no_source', 'label', 'label');

    -- Assert
    CALL assert_equals('Move_Column: empty source table signals 45000', '1', v_caught);
END$$

-- Move_Column_Without_Constraints refuses an empty destination table name
BEGIN NOT ATOMIC
    DECLARE v_caught INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET v_caught = 1;
    -- Arrange
    CREATE TABLE mc_from_no_dest (id INT, label VARCHAR(20));

    -- Act
    CALL Move_Column_Without_Constraints('mc_from_no_dest', '', 'label', 'label');

    -- Assert
    CALL assert_equals('Move_Column: empty destination table signals 45000', '1', v_caught);
END$$

-- Move_Column_Without_Constraints refuses a source column that does not exist
BEGIN NOT ATOMIC
    DECLARE v_caught INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET v_caught = 1;
    -- Arrange
    CREATE TABLE mc_from_missing (id INT);
    CREATE TABLE mc_to_missing (id INT);

    -- Act
    CALL Move_Column_Without_Constraints('mc_from_missing', 'mc_to_missing', 'label', 'label');

    -- Assert
    CALL assert_equals('Move_Column: missing source column signals 45000', '1', v_caught);
END$$

-- Move_Column_Without_Constraints refuses a source column with a foreign key
BEGIN NOT ATOMIC
    DECLARE v_caught INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET v_caught = 1;
    -- Arrange
    CREATE TABLE mc_parent (mc_parentID INT PRIMARY KEY);
    CREATE TABLE mc_from_fk (id INT, parent_id INT,
        CONSTRAINT fk_mc_from_fk_parent_id FOREIGN KEY (parent_id) REFERENCES mc_parent (mc_parentID));
    CREATE TABLE mc_to_fk (id INT);

    -- Act
    CALL Move_Column_Without_Constraints('mc_from_fk', 'mc_to_fk', 'parent_id', 'parent_id');

    -- Assert
    CALL assert_equals('Move_Column: source column with a foreign key signals 45000', '1', v_caught);
END$$

-- Move_Column_Without_Constraints refuses a destination table that does not exist
BEGIN NOT ATOMIC
    DECLARE v_caught INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET v_caught = 1;
    -- Arrange
    CREATE TABLE mc_from_no_table (id INT, label VARCHAR(20));

    -- Act
    CALL Move_Column_Without_Constraints('mc_from_no_table', 'mc_missing_table', 'label', 'label');

    -- Assert
    CALL assert_equals('Move_Column: missing destination table signals 45000', '1', v_caught);
END$$

-- Move_Column_Without_Constraints refuses an existing destination column of another type
BEGIN NOT ATOMIC
    DECLARE v_caught INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET v_caught = 1;
    -- Arrange
    CREATE TABLE mc_from_type (id INT, label VARCHAR(20));
    CREATE TABLE mc_to_type (id INT, label INT);

    -- Act
    CALL Move_Column_Without_Constraints('mc_from_type', 'mc_to_type', 'label', 'label');

    -- Assert
    CALL assert_equals('Move_Column: destination column of another type signals 45000', '1', v_caught);
END$$

DELIMITER ;
