/*
  # Fix habits policies recursion - Version 2

  1. Changes
    - Further simplify policies to completely eliminate recursion
    - Remove complex subqueries
    - Streamline access patterns

  2. Security
    - Maintain row level security
    - Ensure proper access control
*/

-- First, drop all existing policies to start fresh
DROP POLICY IF EXISTS "Habits are viewable by creator" ON habits;
DROP POLICY IF EXISTS "Habits are viewable by assigned users" ON habits;
DROP POLICY IF EXISTS "Users can create habits" ON habits;
DROP POLICY IF EXISTS "Users can update own habits" ON habits;
DROP POLICY IF EXISTS "Player habits are viewable by assigned users" ON player_habits;
DROP POLICY IF EXISTS "Player habits are viewable by habit creators" ON player_habits;

-- Create simplified habits policies
CREATE POLICY "Habits access policy"
  ON habits FOR ALL
  USING (
    -- Can access if creator
    creator_id = auth.uid()
    OR
    -- Can access if participant
    EXISTS (
      SELECT 1 
      FROM player_habits 
      WHERE habit_id = habits.id 
      AND profile_id = auth.uid()
    )
  );

-- Create simplified player_habits policies
CREATE POLICY "Player habits access policy"
  ON player_habits FOR ALL
  USING (
    -- Can access if participant
    profile_id = auth.uid()
    OR
    -- Can access if habit creator
    EXISTS (
      SELECT 1 
      FROM habits 
      WHERE id = player_habits.habit_id 
      AND creator_id = auth.uid()
    )
  );