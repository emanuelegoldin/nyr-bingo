-- Define a stored procedure to close review threads that have been open for more than 2 days.
-- Create a scheduled event to run this procedure once a day.
DELIMITER $$
DROP PROCEDURE IF EXISTS `CloseThreads`$$

CREATE PROCEDURE `CloseThreads`()
    MODIFIES SQL DATA
proc_body: BEGIN
    DECLARE currReviewThreadId VARCHAR(255);
    DECLARE reviewCreationDate DATETIME;
    DECLARE cellState VARCHAR(255);
    DECLARE cellId VARCHAR(255);
    DECLARE cellPosition INT;
    DECLARE cardUserId VARCHAR(255);
    DECLARE resolutionType VARCHAR(255);
    DECLARE firstBingoDate DATETIME;
    DECLARE completedTasks INT;
    DECLARE teamId VARCHAR(255);
    DECLARE acceptVotes INT;
    DECLARE denyVotes INT;
    DECLARE teamMembers INT;
    DECLARE accomplishedOrCompletedInRow INT;
    DECLARE accomplishedOrCompletedInColumn INT;
    DECLARE accomplishedOrCompletedInDiagonal1 INT;
    DECLARE accomplishedOrCompletedInDiagonal2 INT;
    DECLARE bingoAchieved BOOL;
    DECLARE done BOOL DEFAULT FALSE;

    DECLARE cur CURSOR FOR
	SELECT rt.id AS ReviewThreadId 
        ,rt.created_at AS ReviewThreadCreationDate
        ,cell.state AS CellState
        ,cell.id AS CellId
        ,cell.position AS CellPosition
        ,card.user_id AS CardUserId
        ,r.resolution_type AS ResolutionType
        ,tl.first_bingo_at AS LeaderboardFirstBingoDate
        ,tl.completed_tasks AS LeaderboardCompletedTasks
        ,t.id AS TeamId
    FROM `review_threads` AS rt
        JOIN `bingo_cells` cell ON rt.cell_id = cell.id
        JOIN `resolutions` r ON cell.resolution_id = r.id
        JOIN `bingo_cards` card ON cell.card_id = card.id
        JOIN `teams` t ON card.team_id = t.id
        LEFT JOIN `team_leaderboard` tl ON t.id = tl.team_id AND card.user_id = tl.user_id	-- leaderboard might not contain entry for (team, user) yet
    WHERE rt.status = 'open';

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO currReviewThreadId
            ,reviewCreationDate
            ,cellState
            ,cellId
            ,cellPosition
            ,cardUserId
            ,resolutionType
            ,firstBingoDate
            ,completedTasks
            ,teamId;
        IF done THEN
            LEAVE read_loop;
        END IF;
        SET acceptVotes = 0;
        SET denyVotes = 0;
        SET teamMembers = 0;
        SET accomplishedOrCompletedInRow = 0;
        SET accomplishedOrCompletedInColumn = 0;
        SET accomplishedOrCompletedInDiagonal1 = 0;
        SET accomplishedOrCompletedInDiagonal2 = 0;
        SET bingoAchieved = 0;
        -- Execute logic here;
        IF CURDATE() > reviewCreationDate + INTERVAL 2 Day THEN
            -- 1) Close review thread if deadline has passed
            UPDATE `review_threads`
            SET status = 'closed'
            WHERE id = currReviewThreadId;

            -- 2) delete all review messages associated with the review thread
            DELETE FROM `review_messages`
            WHERE thread_id = currReviewThreadId;

            -- 3) delete review files associated with the review thread
            DELETE FROM `review_files`
            WHERE thread_id = currReviewThreadId;

            -- 4.1) join review_votes on thread_id to get count of 'accept' and  total votes
            SELECT COUNT(*) INTO acceptVotes
            FROM `review_votes`
            WHERE thread_id = currReviewThreadId AND vote = 'accept';

            SELECT COUNT(*) INTO denyVotes
            FROM `review_votes`
            WHERE thread_id = currReviewThreadId AND vote = 'deny';
            
            -- 4.2) get number of members in the team
            SELECT COUNT(*) INTO teamMembers
            FROM `team_memberships`
            WHERE team_id = teamId;
            
            -- 4.3) if accept votes are greater than or equal to 50% of team members or no votes are cast, mark cell state as accomplished, otherwise mark as pending
            IF acceptVotes >= FLOOR(teamMembers / 2) 
                OR (acceptVotes + denyVotes = 0) 
                OR (acceptVotes >= denyVotes) THEN
                -- Mark cell as accomplished
                UPDATE `bingo_cells`
                SET state = 'accomplished'
                WHERE id = cellId;

                -- Update leaderboard
                -- 1) count of completed tasks +1
                -- 2) get cell position; check if a bingo is achieved
                --    A card is a 5x5 grid; positions are numbered 0-24 from left to right, top to bottom
                --    A bingo is achieved if all cells in a row, column, or diagonal are accomplished or completed;
                --    the center cell (position 12) is a free cell; it is not stored, so lines through the center have 4 stored cells.
                SELECT COUNT(*) INTO accomplishedOrCompletedInRow
                FROM `bingo_cells`
                WHERE card_id = (SELECT card_id FROM `bingo_cells` WHERE id = cellId)
                    AND position DIV 5 = cellPosition DIV 5
                    AND (state = 'accomplished' OR state = 'completed');
                SELECT COUNT(*) INTO accomplishedOrCompletedInColumn
                FROM `bingo_cells`
                WHERE card_id = (SELECT card_id FROM `bingo_cells` WHERE id = cellId)
                    AND position MOD 5 = cellPosition MOD 5
                    AND (state = 'accomplished' OR state = 'completed');
                SELECT COUNT(*) INTO accomplishedOrCompletedInDiagonal1
                FROM `bingo_cells`
                WHERE card_id = (SELECT card_id FROM `bingo_cells` WHERE id = cellId)
                    AND position IN (0, 6, 18, 24)
                    AND (state = 'accomplished' OR state = 'completed');
                SELECT COUNT(*) INTO accomplishedOrCompletedInDiagonal2
                FROM `bingo_cells`
                WHERE card_id = (SELECT card_id FROM `bingo_cells` WHERE id = cellId)
                    AND position IN (4, 8, 16, 20)
                    AND (state = 'accomplished' OR state = 'completed');

                SET bingoAchieved = (accomplishedOrCompletedInRow = IF(cellPosition DIV 5 = 2, 4, 5))
                    OR (accomplishedOrCompletedInColumn = IF((cellPosition - (cellPosition DIV 5) * 5) = 2, 4, 5))
                    OR (accomplishedOrCompletedInDiagonal1 = 4)
                    OR (accomplishedOrCompletedInDiagonal2 = 4);

                -- If (teamid, cardUserId) pair does not exist in leaderboard, insert it with 0 completed tasks and NULL first bingo date; then update it
                IF NOT EXISTS (SELECT 1 FROM `team_leaderboard` WHERE team_id = teamId AND user_id = cardUserId) THEN
                    INSERT INTO `team_leaderboard` (team_id, user_id, completed_tasks, first_bingo_at)
                    VALUES (teamId, cardUserId, 0, NULL);
                END IF;
                UPDATE `team_leaderboard`
                SET completed_tasks = completed_tasks + 1,
                    first_bingo_at = IF(first_bingo_at IS NULL AND bingoAchieved = 1, NOW(), first_bingo_at)
                WHERE team_id = teamId AND user_id = cardUserId;
            ELSE
                -- Mark cell as pending
                UPDATE `bingo_cells`
                SET state = 'pending'
                WHERE id = cellId;
            END IF;
        END IF;
    END LOOP;
    CLOSE cur;
END$$

-- Schedule the procedure to run once a day
DROP EVENT IF EXISTS `CloseThreadsEvent`$$
CREATE EVENT `CloseThreadsEvent`
ON SCHEDULE EVERY 1 DAY
DO
    CALL `CloseThreads`()$$
DELIMITER ;