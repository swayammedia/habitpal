/*
  # Fix profiles table RLS policies

  1. Changes
    - Drop existing profiles policies
    - Add new policies that allow:
      - Users to insert their own profile
      - Users to update their own profile
      - Everyone to view profiles
      - System to manage profiles during auth

  2. Security
    - Maintains row-level security
    - Ensures users can only modify their own profiles
    - Allows public read access for usernames and basic info
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new policies
CREATE POLICY "Anyone can create their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Enable trust for auth system
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;