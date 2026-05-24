const populateDummydata: string = `
-- This file is for populating the database with dummy data for development and testing.
-- It can be run manually after setting up the database schema using setup-db.ts.
-- Usage: npx tsx scripts/populate-dummy-data.ts

USE resolution_bingo_test;

INSERT INTO users (id, email, name) VALUES
  (1, 'user1@example.com', 'User One'),
  (2, 'user2@example.com', 'User Two'),
  (3, 'user3@example.com', 'User Three');

INSERT INTO user_profiles (user_id, display_name) VALUES
  (1, 'User One'),
  (2, 'User Two'),
  (3, 'User Three');

INSERT INTO resolutions (id, user_id, title, description) VALUES
  (1, 1, 'Learn TypeScript', 'I want to learn TypeScript in 2024.'),
  (2, 1, 'Exercise Regularly', 'I will exercise at least 3 times a week.'),
  (3, 2, 'Read More Books', 'I aim to read at least 12 books this year.'),
  (4, 3, 'Travel More', 'I want to visit at least 3 new countries.');

INSERT INTO resolution_statuses (id, resolution_id, status) VALUES
  (1, 1, 'pending'),
  (2, 2, 'pending'),
  (3, 3, 'completed'),
  (4, 4, 'pending');
`;

export default populateDummydata;