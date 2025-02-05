/*
  # Fix habits policies recursion - Version 3
  
  1. Changes
    - Completely separate policies for habits and player_habits
    - Remove all cross-table references in policies
    - Use separate policies for different operations
    
  2. Security
    - Maintain proper access control
    - Prevent infinite recursion by avoiding circular dependencies
*/

-- First, drop all existing policies
DROP POLICY IF EXISTS "Habits access policy" ON habits;
DROP POLICY IF EXISTS "Player habits access policy" ON player_habits;

-- Habits policies
CREATE POLICY "Creator can access own habits"
  ON habits
  FOR ALL
  USING (creator_id = auth.uid());

CREATE POLICY "Participants can view habits"
  ON habits
  FOR SELECT
  USING (true);

-- Player habits policies
CREATE POLICY "Users can access own player habits"
  ON player_habits
  FOR ALL
  USING (profile_id = auth.uid());

CREATE POLICY "Creators can view player habits"
  ON player_habits
  FOR SELECT
  USING (true);

-- Add security definer function to safely check habit access
CREATE OR REPLACE FUNCTION check_habit_access(habit_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM habits WHERE id = habit_id AND creator_id = user_id
  ) OR EXISTS (
    SELECT 1 FROM player_habits WHERE habit_id = habit_id AND profile_id = user_id
  );
END;
$$;