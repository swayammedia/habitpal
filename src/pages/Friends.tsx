import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Check, X } from 'lucide-react';

interface Friend {
  id: string;
  username: string;
  full_name: string | null;
  status: string;
  friendship_id: string;
}

export function Friends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchPendingRequests();
    }
  }, [user]);

  async function fetchFriends() {
    if (!user) return;

    // Fetch both incoming and outgoing accepted friendships
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        status,
        user_id,
        friend:profiles!friendships_friend_id_fkey (
          id,
          username,
          full_name
        ),
        user:profiles!friendships_user_id_fkey (
          id,
          username,
          full_name
        )
      `)
      .eq('status', 'accepted')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (error) {
      console.error('Error fetching friends:', error);
      return;
    }

    // Transform the data to get the friend's info regardless of whether they're the user or friend
    const transformedFriends = data.map(friendship => {
      const isFriend = friendship.user_id === user.id;
      const friendProfile = isFriend ? friendship.friend : friendship.user;
      
      return {
        id: friendProfile.id,
        username: friendProfile.username,
        full_name: friendProfile.full_name,
        status: 'accepted',
        friendship_id: friendship.id
      };
    });

    setFriends(transformedFriends);
  }

  async function fetchPendingRequests() {
    if (!user) return;

    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        user:profiles!friendships_user_id_fkey (
          id,
          username,
          full_name
        )
      `)
      .eq('friend_id', user.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching pending requests:', error);
      return;
    }

    setPendingRequests(
      data.map(({ id, user }) => ({
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        status: 'pending',
        friendship_id: id
      }))
    );
  }

  async function sendFriendRequest() {
    if (!user || !username.trim()) return;

    setError('');
    setSuccess('');

    try {
      // First check if trying to add self
      if (user.email?.split('@')[0] === username) {
        throw new Error('You cannot add yourself as a friend');
      }

      // Check if user exists
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          throw new Error('User not found. Please check the username and try again.');
        }
        throw profileError;
      }

      // Check if friendship already exists
      const { data: existingFriendship, error: friendshipCheckError } = await supabase
        .from('friendships')
        .select('status')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${profileData.id}),and(user_id.eq.${profileData.id},friend_id.eq.${user.id})`);

      if (friendshipCheckError) throw friendshipCheckError;

      if (existingFriendship && existingFriendship.length > 0) {
        const status = existingFriendship[0].status;
        if (status === 'pending') {
          throw new Error('A friend request is already pending with this user');
        } else if (status === 'accepted') {
          throw new Error('You are already friends with this user');
        }
      }

      // Send friend request
      const { error: friendshipError } = await supabase
        .from('friendships')
        .insert([{
          user_id: user.id,
          friend_id: profileData.id,
          status: 'pending'
        }]);

      if (friendshipError) throw friendshipError;

      setSuccess('Friend request sent successfully!');
      setUsername('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send friend request');
      console.error('Error sending friend request:', error);
    }
  }

  async function handleFriendRequest(friendshipId: string, accept: boolean) {
    if (!user) return;

    try {
      if (accept) {
        await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', friendshipId);
      } else {
        await supabase
          .from('friendships')
          .delete()
          .eq('id', friendshipId);
      }

      fetchPendingRequests();
      fetchFriends();
    } catch (error) {
      console.error('Error handling friend request:', error);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Friends</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Manage your friends and friend requests
          </p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          {/* Add Friend Form */}
          <div className="mb-6">
            <div className="flex gap-4">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username to add friend"
                className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
              <button
                onClick={sendFriendRequest}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Friend
              </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
            {success && (
              <p className="mt-2 text-sm text-green-600">{success}</p>
            )}
          </div>

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Pending Requests</h4>
              <ul className="divide-y divide-gray-200">
                {pendingRequests.map((friend) => (
                  <li key={friend.id} className="py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{friend.username}</p>
                      {friend.full_name && (
                        <p className="text-sm text-gray-500">{friend.full_name}</p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleFriendRequest(friend.friendship_id, true)}
                        className="inline-flex items-center p-2 border border-transparent rounded-full text-green-600 hover:bg-green-50"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleFriendRequest(friend.friendship_id, false)}
                        className="inline-flex items-center p-2 border border-transparent rounded-full text-red-600 hover:bg-red-50"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Friends List */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">My Friends</h4>
            {friends.length === 0 ? (
              <p className="text-sm text-gray-500">No friends added yet.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {friends.map((friend) => (
                  <li key={friend.id} className="py-4">
                    <p className="text-sm font-medium text-gray-900">{friend.username}</p>
                    {friend.full_name && (
                      <p className="text-sm text-gray-500">{friend.full_name}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}