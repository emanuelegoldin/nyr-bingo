----------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------
--- Create Table
--- Procedure to create a new table. It ensures idempotency.
--- Automatically creates Primary Key (PK)
--- Auto-generates created_at and updated_at timestamps
CREATE OR REPLACE PROCEDURE Create_Table
    @table_name NVARCHAR(255), --- Name of the table to create
    @label NVARCHAR(255)       --- label describing the table (for documentation purposes)

BEGIN TRANSACTION;

SET XACT_ABORT ON;      -- Automatically roll back the transaction if any statement fails

    DECLARE @sql NVARCHAR(MAX);
    SET @sql = N'CREATE TABLE IF NOT EXISTS ' + QUOTENAME(TRIM(@table_name)) + ' (
        id INT AUTO_INCREMENT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )';

    EXEC sp_executesql @sql;
COMMIT TRANSACTION;
END;

----------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------
--- Add Column to Table
CREATE OR REPLACE PROCEDURE Add_Column_To_Table
    @table_name NVARCHAR(255),  --- Name of the table to modify
    @column_name NVARCHAR(255), --- Name of the column to add
    @data_type NVARCHAR(255)    --- Data type of the new column (e.g., VARCHAR(255), INT, etc.)
    @nullable BIT = 1          --- Whether the column should allow NULL values (default is 1, meaning it allows NULLs)
    @default_value NVARCHAR(255) = NULL --- Optional default value for the new column
    @referenced_table NVARCHAR(255) = NULL --- Optional referenced table for foreign key(FK) constraint

BEGIN TRANSACTION;
SET XACT_ABORT ON;
--- Check if Table exists
IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.TABLES 
    WHERE TABLE_NAME = @table_name
)
--- If the table does not exist, raise an error and exit; store the error message in a variable for logging or debugging purposes
BEGIN
    DECLARE @error_message NVARCHAR(255) = 'Table ' + @table_name + ' does not exist.';
    RAISERROR (@error_message, 16, 1);
    RETURN;
END

--- Check if Column already exists
IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.COLUMNS 
    WHERE TABLE_NAME = @table_name 
      AND COLUMN_NAME = @column_name
)
--- If the column does not exist, construct and execute the SQL statement to add the column; 
--- if it does exist, use aler statement to modify the column's data type and nullability as needed
--- If referenced_table is provided, add a foreign key constraint to the new column (REFERENCES referenced_table(id)) with type UNIQUEIDENTIFIER and call it <table_name>ID
BEGIN
    DECLARE @sql NVARCHAR(MAX);
    SET @sql = N'ALTER TABLE ' + QUOTENAME(TRIM(@table_name)) + 
        ' ADD COLUMN ' + QUOTENAME(TRIM(@column_name)) + ' ' +
        @data_type +
        CASE WHEN @nullable = 0 THEN ' NOT NULL' ELSE ' NULL' END +
        CASE WHEN @default_value IS NOT NULL THEN ' DEFAULT ' + @default_value ELSE '' END;
    EXEC sp_executesql @sql;
    IF @referenced_table IS NOT NULL
    BEGIN
        DECLARE @fk_sql NVARCHAR(MAX);
        SET @fk_sql = N'ALTER TABLE ' + QUOTENAME(TRIM(@table_name)) + 
            ' ADD CONSTRAINT fk_' + TRIM(@table_name) + '_' + TRIM(@column_name) + 
            ' FOREIGN KEY (' + QUOTENAME(TRIM(@column_name)) + ') REFERENCES ' + QUOTENAME(TRIM(@referenced_table)) + '(id)';
        EXEC sp_executesql @fk_sql;
    END
END
ELSE
BEGIN
    DECLARE @alter_sql NVARCHAR(MAX);
    SET @alter_sql = N'ALTER TABLE ' + QUOTENAME(TRIM(@table_name)) + 
        ' MODIFY COLUMN ' + QUOTENAME(TRIM(@column_name)) + ' ' + @data_type +
        CASE WHEN @nullable = 0 THEN ' NOT NULL' ELSE ' NULL' END +
        CASE WHEN @default_value IS NOT NULL THEN ' DEFAULT ' + @default_value ELSE '' END;
    EXEC sp_executesql @alter_sql;
END
COMMIT TRANSACTION;
END;