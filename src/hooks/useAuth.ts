// Simple useAuth hook for compatibility with the credit system
// Wraps the existing auth store to provide user information
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

interface User {
  id: string;
  email?: string;
  // Add other user properties as needed
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial user
    const getUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser ? { 
          id: authUser.id, 
          email: authUser.email 
        } : null);
      } catch (error) {
        console.error('Error getting user:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser({ 
            id: session.user.id, 
            email: session.user.email 
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return { 
    user, 
    loading,
    isAuthenticated: !!user 
  };
};