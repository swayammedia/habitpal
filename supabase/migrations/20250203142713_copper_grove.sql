/*
  # Initial Schema for HabitPal

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key) - matches auth.users id
      - `username` (text, unique)
      - `full_name` (text)
      - `avatar_url` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `habits`
      - `id` (uuid, primary key)
      - `creator_id` (uuid) - references profiles.id
      - `title` (text)
      - `description` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `player_habits`
      - `id` (uuid, primary key)
      - `habit_id` (uuid) - references habits.id
      - `profile_id` (uuid) - references profiles.id
      - `created_at` (timestamp)
      - `status` (text) - active/archived
    
    - `habit_completions`
      - `id` (uuid, primary key)
      - `player_habit_id` (uuid) - references player_habits.id
      - `completed_at` (timestamp)
      - `created_at` (timestamp)
    
    - `friendships`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - references profiles.id
      - `friend_id` (uuid) - references profiles.id
      - `status` (text) - pending/accepted
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  username text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create habits table
CREATE TABLE habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES profiles(id) NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create player_habits table
CREATE TABLE player_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid REFERENCES habits(id) NOT NULL,
  profile_id uuid REFERENCES profiles(id) NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz DEFAULT now()
);

-- Create habit_completions table
CREATE TABLE habit_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_habit_id uuid REFERENCES player_habits(id) NOT NULL,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create friendships table
CREATE TABLE friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  friend_id uuid REFERENCES profiles(id) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Habits policies
CREATE POLICY "Habits are viewable by creator and assigned users"
  ON habits FOR SELECT
  USING (
    auth.uid() = creator_id OR
    EXISTS (
      SELECT 1 FROM player_habits
      WHERE habit_id = habits.id
      AND profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can create habits"
  ON habits FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update own habits"
  ON habits FOR UPDATE
  USING (auth.uid() = creator_id);

-- Player habits policies
CREATE POLICY "Player habits are viewable by creator and assigned users"
  ON player_habits FOR SELECT
  USING (
    profile_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM habits
      WHERE id = player_habits.habit_id
      AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can create player habits"
  ON player_habits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM habits
      WHERE id = habit_id
      AND creator_id = auth.uid()
    ) OR
    profile_id = auth.uid()
  );

-- Habit completions policies
CREATE POLICY "Habit completions are viewable by related users"
  ON habit_completions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM player_habits
      WHERE id = player_habit_id
      AND (
        profile_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM habits
          WHERE id = player_habits.habit_id
          AND creator_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create own habit completions"
  ON habit_completions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM player_habits
      WHERE id = player_habit_id
      AND profile_id = auth.uid()
    )
  );

-- Friendships policies
CREATE POLICY "Friendships are viewable by involved users"
  ON friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendships"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own friendships"
  ON friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);