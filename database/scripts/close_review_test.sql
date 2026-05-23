-- https://mariadb.com/docs/server/reference/sql-structure/sql-language-structure/user-defined-variables
-- User-defined variables names must be preceded by a single at character (@).
-- User-defined variables cannot be declared. They can be read even if no value has been set yet; in that case, they are NULL
SET @reviewId = 'b1e91c0b-ebfc-4be0-aeb2-7c71d956767c';
SET @completedByUserId = 'f40f5005-cdd0-47ac-8535-53f03788a087';
SET @cellId = 'dce16460-6199-4a1d-9551-e791baee3101';

-- See initial state
SELECT completed_by_user_id, status FROM review_threads WHERE id = @reviewId;
SELECT vote, COUNT(vote) AS Amount FROM review_votes WHERE thread_id = @reviewId GROUP BY vote;
SELECT * FROM review_files WHERE thread_id = @reviewId;
SELECT first_bingo_at, completed_tasks FROM team_leaderboard WHERE user_id = @completedByUserId;
SELECT state FROM bingo_cells WHERE id = @cellId;

---------------------------------------------------
-- deny <= accept; cell state shall be accomplished [OK]
---------------------------------------------------
START TRANSACTION;
-- ACT
CALL CloseThreads;

-- ASSERT
SELECT completed_by_user_id, status FROM review_threads WHERE id = @reviewId;
SELECT * FROM review_files WHERE thread_id = @reviewId;
SELECT first_bingo_at, completed_tasks FROM team_leaderboard WHERE user_id = @completedByUserId;
SELECT state FROM bingo_cells WHERE id = @cellId;
ROLLBACK;  

---------------------------------------------
-- deny > accept; cell state shall be pending [OK]
---------------------------------------------
START TRANSACTION;
-- PREPARE
INSERT INTO review_votes (id, thread_id, voter_user_id, vote)
VALUES ('a18e9699-9dd6-4a04-8cf1-a22b3c61ce9b', @reviewId, '39731ca0-b73e-49c0-ad9e-32a1b34ea5ec', 'deny');

-- ACT
CALL CLoseThreads;

-- ASSERT
SELECT state FROM bingo_cells WHERE id = @cellId;
ROLLBACK;

----------------------------------------------
-- no votes; cell state shall be accomplished [OK]
----------------------------------------------
START TRANSACTION;
-- PREPARE
DELETE FROM review_votes WHERE thread_id = @reviewId;

-- ACT
CALL CLoseThreads;

-- ASSERT
SELECT state FROM bingo_cells WHERE id = @cellId;
ROLLBACK;


--------------------------------------------------
-- deadline not met; review status shall stay open [OK]
--------------------------------------------------
START TRANSACTION;
-- PREPARE
UPDATE review_threads
SET created_at = CURDATE()
WHERE id = @reviewId;

-- ACT
CALL CLoseThreads;

-- ASSERT
SELECT completed_by_user_id, status FROM review_threads WHERE id = @reviewId;
ROLLBACK;

-------------------------------------------------------------
-- bingo; leaderboard shall be updated; cell is at position 2
-------------------------------------------------------------
START TRANSACTION;
-- PREPARE: row 			[OK]
UPDATE bingo_cells
SET state = 'accomplished'
WHERE card_id = '4a2f2e58-c428-44d8-a1ae-8cc238036e43' AND position IN (0, 1, 3, 4);

INSERT INTO team_leaderboard (team_id, user_id, completed_tasks, first_bingo_at)
VALUES ('f9efb876-f224-422d-9316-96e3b49e5f34', @completedByUserId, 4, NULL);

-- ACT
CALL CLoseThreads;

-- ASSERT: completed tasks shall be 5; first_bingo_at shall be current date
SELECT first_bingo_at, completed_tasks FROM team_leaderboard WHERE user_id = @completedByUserId;
ROLLBACK;

START TRANSACTION;
-- PREPARE: column with Joker		[OK - Joker cell not stored in table!]
UPDATE bingo_cells
SET state = 'accomplished'
WHERE card_id = '4a2f2e58-c428-44d8-a1ae-8cc238036e43' AND position IN (7, 12, 17, 22);

INSERT INTO team_leaderboard (team_id, user_id, completed_tasks, first_bingo_at)
VALUES ('f9efb876-f224-422d-9316-96e3b49e5f34', @completedByUserId, 4, NULL);

-- ACT
CALL CLoseThreads;

-- ASSERT: completed tasks shall be 5; first_bingo_at shall be current date
SELECT first_bingo_at, completed_tasks FROM team_leaderboard WHERE user_id = @completedByUserId;
ROLLBACK;

--------------------------------------
-- review files for thread are removed	[OK]
--------------------------------------
START TRANSACTION;
-- PREPARE
INSERT INTO review_files (id, thread_id, uploaded_by_user_id, file_name, file_path, file_size)
VALUES
('f9efb875-f224-422d-9316-96e3b49e5f34', @reviewId, @completedByUserId, 'SHALL NOT EXIST', 'path', 12)
,('f9efb875-f224-422d-9316-96e3b49e5f35', '81b0da83-2f71-4510-a902-bb3bedb92f05', @completedByUserId, 'SHALL_EXIST', 'path', 12);

-- ACT
CALL CLoseThreads;

-- ASSERT: completed tasks shall be 5; first_bingo_at shall be current date
SELECT * FROM review_files;
ROLLBACK;