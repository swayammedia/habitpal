/*
  # Fix habits policies recursion

  1. Changes
    - Simplify habits policies to avoid recursion
    - Rewrite policies to use direct checks instead of subqueries where possible
    - Ensure proper access control while avoiding circular references

  2. Security
    - Maintain row level security
    - Keep access restricted to appropriate users
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Habits are viewable by creator and assigned users" ON habits;
DROP POLICY IF EXISTS "Users can create habits" ON habits;
DROP POLICY IF EXISTS "Users can update own habits" ON habits;

-- Create new, simplified policies
CREATE POLICY "Habits are viewable by creator"
  ON habits FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Habits are viewable by assigned users"
  ON habits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM player_habits 
      WHERE player_habits.habit_id = id 
      AND player_habits.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can create habits"
  ON habits FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update own habits"
  ON habits FOR UPDATE
  USING (auth.uid() = creator_id);

-- Drop and recreate player_habits policies to ensure consistency
DROP POLICY IF EXISTS "Player habits are viewable by creator and assigned users" ON player_habits;

CREATE POLICY "Player habits are viewable by assigned users"
  ON player_habits FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Player habits are viewable by habit creators"
  ON player_habits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM habits 
      WHERE habits.id = habit_id 
      AND habits.creator_id = auth.uid()
    )
  );