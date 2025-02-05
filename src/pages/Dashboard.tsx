import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, Circle, Plus, Users } from 'lucide-react';

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
}

interface Habit {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

interface PlayerHabit {
  id: string;
  habit: Habit;
  completed_today: boolean;
  profile: Profile;
}

export function Dashboard() {
  const { user } = useAuth();
  const [myHabits, setMyHabits] = useState<PlayerHabit[]>([]);
  const [friendsHabits, setFriendsHabits] = useState<PlayerHabit[]>([]);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitDescription, setNewHabitDescription] = useState('');
  const [isAddingHabit, setIsAddingHabit] = useState(false);

  useEffect(() => {
    if (user) {
      fetchHabits();
      fetchFriendsHabits();
    }
  }, [user]);

  async function fetchHabits() {
    if (!user) return;

    const { data: playerHabitsData, error: playerHabitsError } = await supabase
      .from('player_habits')
      .select(`
        id,
        habit:habits (
          id,
          title,
          description,
          created_at
        ),
        profile:profiles (
          id,
          username,
          full_name
        )
      `)
      .eq('profile_id', user.id)
      .eq('status', 'active');

    if (playerHabitsError) {
      console.error('Error fetching habits:', playerHabitsError);
      return;
    }

    // Check for today's completions
    const today = new Date().toISOString().split('T')[0];
    const { data: completionsData } = await supabase
      .from('habit_completions')
      .select('player_habit_id')
      .gte('completed_at', today);

    const completedHabitIds = new Set(completionsData?.map(c => c.player_habit_id));

    setMyHabits(
      playerHabitsData?.map(ph => ({
        ...ph,
        completed_today: completedHabitIds.has(ph.id)
      })) || []
    );
  }

  async function fetchFriendsHabits() {
    if (!user) return;

    // First get all accepted friendships
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friendships')
      .select('friend_id, user_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (friendshipsError) {
      console.error('Error fetching friendships:', friendshipsError);
      return;
    }

    // Get friend IDs
    const friendIds = friendships
      .map(f => f.friend_id === user.id ? f.user_id : f.friend_id)
      .filter(Boolean);

    if (friendIds.length === 0) return;

    // Fetch friends' habits
    const { data: friendsHabitsData, error: friendsHabitsError } = await supabase
      .from('player_habits')
      .select(`
        id,
        habit:habits (
          id,
          title,
          description,
          created_at
        ),
        profile:profiles (
          id,
          username,
          full_name
        )
      `)
      .in('profile_id', friendIds)
      .eq('status', 'active');

    if (friendsHabitsError) {
      console.error('Error fetching friends habits:', friendsHabitsError);
      return;
    }

    // Check for today's completions
    const today = new Date().toISOString().split('T')[0];
    const { data: completionsData } = await supabase
      .from('habit_completions')
      .select('player_habit_id')
      .gte('completed_at', today);

    const completedHabitIds = new Set(completionsData?.map(c => c.player_habit_id));

    setFriendsHabits(
      friendsHabitsData?.map(ph => ({
        ...ph,
        completed_today: completedHabitIds.has(ph.id)
      })) || []
    );
  }

  async function handleCreateHabit() {
    if (!user || !newHabitTitle.trim()) return;

    const { data: habitData, error: habitError } = await supabase
      .from('habits')
      .insert([{
        creator_id: user.id,
        title: newHabitTitle,
        description: newHabitDescription
      }])
      .select()
      .single();

    if (habitError) {
      console.error('Error creating habit:', habitError);
      return;
    }

    const { error: playerHabitError } = await supabase
      .from('player_habits')
      .insert([{
        habit_id: habitData.id,
        profile_id: user.id
      }]);

    if (playerHabitError) {
      console.error('Error assigning habit:', playerHabitError);
      return;
    }

    setNewHabitTitle('');
    setNewHabitDescription('');
    setIsAddingHabit(false);
    fetchHabits();
  }

  async function toggleHabitCompletion(playerHabitId: string, completed: boolean) {
    if (!user) return;

    if (completed) {
      const { error } = await supabase
        .from('habit_completions')
        .insert([{ player_habit_id: playerHabitId }]);

      if (error) {
        console.error('Error completing habit:', error);
        return;
      }
    }

    fetchHabits();
    fetchFriendsHabits();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* My Habits Section */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Habits</h1>
          <button
            onClick={() => setIsAddingHabit(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Habit
          </button>
        </div>

        {isAddingHabit && (
          <div className="mb-6 bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-medium mb-4">Create New Habit</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={newHabitTitle}
                  onChange={(e) => setNewHabitTitle(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  value={newHabitDescription}
                  onChange={(e) => setNewHabitDescription(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsAddingHabit(false)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateHabit}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Create Habit
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {myHabits.map(({ id, habit, completed_today }) => (
              <li key={id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center">
                  <button
                    onClick={() => toggleHabitCompletion(id, !completed_today)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    {completed_today ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </button>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">{habit.title}</h3>
                    {habit.description && (
                      <p className="text-sm text-gray-500">{habit.description}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {myHabits.length === 0 && (
              <li className="px-6 py-4 text-center text-gray-500">
                No habits added yet. Click "Add Habit" to get started!
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Friends' Habits Section */}
      {friendsHabits.length > 0 && (
        <div>
          <div className="flex items-center mb-6">
            <Users className="w-6 h-6 text-indigo-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">Friends' Habits</h2>
          </div>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {friendsHabits.map(({ id, habit, completed_today, profile }) => (
                <li key={id} className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {completed_today ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900">{habit.title}</h3>
                        <span className="ml-2 text-sm text-gray-500">
                          by {profile.full_name || profile.username}
                        </span>
                      </div>
                      {habit.description && (
                        <p className="text-sm text-gray-500">{habit.description}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}