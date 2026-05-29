import type { User } from '@supabase/supabase-js';
import { createClient } from './supabaseClient';

const ADMIN_ROLE = 'admin';

function normalizeRole(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const role = value.trim().toLowerCase();
  return role.length > 0 ? role : null;
}

function extractRoles(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(normalizeRole)
      .filter((role): role is string => role !== null);
  }

  const role = normalizeRole(value);
  return role ? [role] : [];
}

function hasAdminFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === ADMIN_ROLE;
}

function getMetadataRoles(user: User): string[] {
  return Array.from(
    new Set([
      ...extractRoles(user.app_metadata?.roles),
      ...extractRoles(user.user_metadata?.roles),
      ...extractRoles(user.app_metadata?.role),
      ...extractRoles(user.user_metadata?.role),
    ]),
  );
}

function hasMetadataAdminAccess(user: User): boolean {
  return (
    hasAdminFlag(user.app_metadata?.claims_admin) ||
    hasAdminFlag(user.user_metadata?.is_admin) ||
    getMetadataRoles(user).includes(ADMIN_ROLE)
  );
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('Error getting current user for admin check:', userError);
    return false;
  }

  if (!user) return false;

  if (hasMetadataAdminAccess(user)) {
    return true;
  }

  const { data, error } = await supabase.rpc('is_admin', { user_id: user.id });

  if (error) {
    console.error('Error checking admin status:', error);
    return false;
  }

  return data === true;
}

export async function getCurrentUserRoles(): Promise<string[]> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('Error getting current user for roles:', userError);
    return [];
  }

  if (!user) return [];

  const roles = new Set<string>(getMetadataRoles(user));

  if (hasMetadataAdminAccess(user)) {
    roles.add(ADMIN_ROLE);
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
    user_id: user.id,
  });

  if (!adminError && isAdmin === true) {
    roles.add(ADMIN_ROLE);
  }

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (error) {
    return Array.from(roles);
  }

  for (const record of data || []) {
    const role = normalizeRole(record.role);
    if (role) {
      roles.add(role);
    }
  }

  return Array.from(roles);
}

export async function getCurrentUserAdminSubRole(): Promise<'owner' | 'editor' | 'reader' | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data, error } = await supabase
    .from('user_roles')
    .select('admin_sub_role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!error && data?.admin_sub_role) {
    return data.admin_sub_role as 'owner' | 'editor' | 'reader';
  }

  // Fallback to metadata for developers or local configs
  if (hasMetadataAdminAccess(user)) {
    return 'owner';
  }

  return null;
}
