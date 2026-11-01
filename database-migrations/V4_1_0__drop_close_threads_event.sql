-- Deadline closure of review threads moved to the Next.js application, which can also
-- remove the proof files from disk.
DROP EVENT IF EXISTS `CloseThreadsEvent`;
DROP PROCEDURE IF EXISTS `CloseThreads`;
