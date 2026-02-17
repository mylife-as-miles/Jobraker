import { createClient } from './supabaseClient';

export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;
  
  const { data, error } = await supabase
    .rpc('is_admin', { user_id: user.id });
  
  if (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
  
  return data === true;
}

export async function getCurrentUserRoles(): Promise<string[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return [];
  
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  
  if (error) {
    console.error('Error fetching user roles:', error);
    return [];
  }
  
  return (data || []).map(r => r.role);
}
