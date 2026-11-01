-- V5.2.1 — Seed the prepared resolutions pool
--
-- Categories (spec 17-prepared-resolutions.md):
--   short  : completed in days, with no preparation
--   medium : completed in weeks, or more demanding but scoped in days
--   long   : months up to the whole year
--
-- Ids are fixed, so INSERT IGNORE skips entries already present and the seed can run again.

INSERT IGNORE INTO prepared_resolutions
  (id, category, resolution_type, title, description, subtasks, number_of_repetition)
VALUES
  -- Short
  ('prepared-short-01', 'short', 'base', 'Call an old friend', NULL, NULL, NULL),
  ('prepared-short-02', 'short', 'base', 'Write a thank-you note to someone', NULL, NULL, NULL),
  ('prepared-short-03', 'short', 'base', 'Cook a recipe you have never tried', NULL, NULL, NULL),
  ('prepared-short-04', 'short', 'base', 'Take a walk somewhere new in your town', NULL, NULL, NULL),
  ('prepared-short-05', 'short', 'base', 'Declutter one drawer', NULL, NULL, NULL),
  ('prepared-short-06', 'short', 'base', 'Spend an evening without any screens', NULL, NULL, NULL),
  ('prepared-short-07', 'short', 'base', 'Visit a local museum or gallery', NULL, NULL, NULL),
  ('prepared-short-08', 'short', 'base', 'Watch a sunrise', NULL, NULL, NULL),
  ('prepared-short-09', 'short', 'base', 'Donate clothes you no longer wear', NULL, NULL, NULL),
  ('prepared-short-10', 'short', 'base', 'Compliment a stranger', NULL, NULL, NULL),
  ('prepared-short-11', 'short', 'base', 'Back up your phone photos', NULL, NULL, NULL),
  ('prepared-short-12', 'short', 'base', 'Have a picnic', NULL, NULL, NULL),
  ('prepared-short-13', 'short', 'base', 'Try a food you have never eaten', NULL, NULL, NULL),
  ('prepared-short-14', 'short', 'base', 'Unsubscribe from newsletters you never read', NULL, NULL, NULL),
  ('prepared-short-15', 'short', 'base', 'Learn to say hello in three new languages', NULL, NULL, NULL),
  ('prepared-short-16', 'short', 'iterative', 'Drink two litres of water a day', 'Reach the target on three days.', NULL, 3),
  ('prepared-short-17', 'short', 'iterative', 'Go to bed before 11 pm', 'Do it on three nights.', NULL, 3),
  ('prepared-short-18', 'short', 'iterative', 'Take the stairs instead of the lift', 'Do it on five occasions.', NULL, 5),
  ('prepared-short-19', 'short', 'compound', 'Reset your desk', 'Leave your workspace clean and tidy.',
    '[{"title":"Clear the surface","description":"","completed":false},{"title":"Sort the papers","description":"","completed":false},{"title":"Wipe everything down","description":"","completed":false}]', NULL),
  ('prepared-short-20', 'short', 'compound', 'Plan a screen-free Sunday', 'Prepare a day away from your devices.',
    '[{"title":"Pick the date","description":"","completed":false},{"title":"Choose an activity","description":"","completed":false},{"title":"Tell your friends you are offline","description":"","completed":false}]', NULL),

  -- Medium
  ('prepared-medium-01', 'medium', 'base', 'Read a book you have been putting off', NULL, NULL, NULL),
  ('prepared-medium-02', 'medium', 'base', 'Hike a mountain trail', NULL, NULL, NULL),
  ('prepared-medium-03', 'medium', 'base', 'Organise a dinner for your friends', NULL, NULL, NULL),
  ('prepared-medium-04', 'medium', 'base', 'Take a weekend trip to a place you have never been', NULL, NULL, NULL),
  ('prepared-medium-05', 'medium', 'base', 'Deep clean your home', NULL, NULL, NULL),
  ('prepared-medium-06', 'medium', 'base', 'Sort your finances and set a budget', NULL, NULL, NULL),
  ('prepared-medium-07', 'medium', 'base', 'Volunteer for a local cause', NULL, NULL, NULL),
  ('prepared-medium-08', 'medium', 'base', 'Learn to cook a dish from another country', NULL, NULL, NULL),
  ('prepared-medium-09', 'medium', 'base', 'Finish an online course', NULL, NULL, NULL),
  ('prepared-medium-10', 'medium', 'base', 'Build something with your hands', NULL, NULL, NULL),
  ('prepared-medium-11', 'medium', 'base', 'Go without social media for two weeks', NULL, NULL, NULL),
  ('prepared-medium-12', 'medium', 'base', 'Go a month without buying takeaway coffee', NULL, NULL, NULL),
  ('prepared-medium-13', 'medium', 'base', 'Take a first aid course', NULL, NULL, NULL),
  ('prepared-medium-14', 'medium', 'iterative', 'Exercise for 30 minutes', 'Do ten sessions.', NULL, 10),
  ('prepared-medium-15', 'medium', 'iterative', 'Meditate for ten minutes', 'Do it on fourteen days.', NULL, 14),
  ('prepared-medium-16', 'medium', 'iterative', 'Cook dinner at home', 'Do it on fifteen evenings.', NULL, 15),
  ('prepared-medium-17', 'medium', 'iterative', 'Write in a journal', 'Write fourteen entries.', NULL, 14),
  ('prepared-medium-18', 'medium', 'compound', 'Plan a trip', 'Get a whole trip ready to go.',
    '[{"title":"Choose the destination","description":"","completed":false},{"title":"Book travel and a place to stay","description":"","completed":false},{"title":"Write a day-by-day itinerary","description":"","completed":false}]', NULL),
  ('prepared-medium-19', 'medium', 'compound', 'Refresh your CV', 'Get your professional profile up to date.',
    '[{"title":"Update your experience","description":"","completed":false},{"title":"Ask someone for feedback","description":"","completed":false},{"title":"Update your online profile","description":"","completed":false}]', NULL),
  ('prepared-medium-20', 'medium', 'compound', 'Declutter your wardrobe', 'Keep only what you actually wear.',
    '[{"title":"Try everything on","description":"","completed":false},{"title":"Donate or sell what you do not wear","description":"","completed":false},{"title":"Organise what is left","description":"","completed":false}]', NULL),

  -- Long
  ('prepared-long-01', 'long', 'base', 'Do not drink alcohol for the whole year', NULL, NULL, NULL),
  ('prepared-long-02', 'long', 'base', 'Stop smoking', NULL, NULL, NULL),
  ('prepared-long-03', 'long', 'base', 'Run a marathon', NULL, NULL, NULL),
  ('prepared-long-04', 'long', 'base', 'Hold a basic conversation in a new language', NULL, NULL, NULL),
  ('prepared-long-05', 'long', 'base', 'Learn to play a musical instrument', NULL, NULL, NULL),
  ('prepared-long-06', 'long', 'base', 'Go a whole year without buying new clothes', NULL, NULL, NULL),
  ('prepared-long-07', 'long', 'base', 'Eat no meat for six months', NULL, NULL, NULL),
  ('prepared-long-08', 'long', 'base', 'Give up sugary drinks for the whole year', NULL, NULL, NULL),
  ('prepared-long-09', 'long', 'base', 'Write a short story collection', NULL, NULL, NULL),
  ('prepared-long-10', 'long', 'base', 'Keep a houseplant or vegetable patch alive all year', NULL, NULL, NULL),
  ('prepared-long-11', 'long', 'base', 'Do 50 push-ups in a row', NULL, NULL, NULL),
  ('prepared-long-12', 'long', 'base', 'Build up an emergency fund of three months of expenses', NULL, NULL, NULL),
  ('prepared-long-13', 'long', 'iterative', 'Read 12 books', 'One book at a time.', NULL, 12),
  ('prepared-long-14', 'long', 'iterative', 'Exercise 100 times', 'Any workout of at least 30 minutes counts.', NULL, 100),
  ('prepared-long-15', 'long', 'iterative', 'Save money every month', 'Set money aside in six different months.', NULL, 6),
  ('prepared-long-16', 'long', 'iterative', 'Spend a full day in nature', 'Do it on twelve days.', NULL, 12),
  ('prepared-long-17', 'long', 'iterative', 'Volunteer every month', 'Volunteer in ten different months.', NULL, 10),
  ('prepared-long-18', 'long', 'iterative', 'Write a letter to someone you care about', 'Send twelve letters.', NULL, 12),
  ('prepared-long-19', 'long', 'compound', 'Train for a half marathon', 'Build up to race day.',
    '[{"title":"Run 5 km without stopping","description":"","completed":false},{"title":"Run 10 km without stopping","description":"","completed":false},{"title":"Run 15 km without stopping","description":"","completed":false},{"title":"Finish a half marathon","description":"","completed":false}]', NULL),
  ('prepared-long-20', 'long', 'compound', 'Learn a new professional skill', 'Take a skill from zero to something you can show.',
    '[{"title":"Choose the skill and a course","description":"","completed":false},{"title":"Finish the course","description":"","completed":false},{"title":"Complete a real project with it","description":"","completed":false}]', NULL);
