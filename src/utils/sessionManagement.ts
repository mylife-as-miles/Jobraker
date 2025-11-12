// Session management utilities
// Tracks active sessions and enforces security policies
import { createClient } from '../lib/supabaseClient';

export interface SessionInfo {
  device_id?: string;
  device_name?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  ip_address?: string;
  location?: string;
  user_agent?: string;
}

function getDeviceInfo(): SessionInfo {
  if (typeof window === 'undefined') {
    return {};
  }

  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let os = 'Unknown';
  let deviceType = 'desktop';

  // Detect browser
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera')) browser = 'Opera';

  // Detect OS
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // Detect device type
  if (ua.includes('Mobile') || ua.includes('Android')) deviceType = 'mobile';
  else if (ua.includes('Tablet') || ua.includes('iPad')) deviceType = 'tablet';

  // Generate device ID from browser fingerprint
  const deviceId = btoa(
    `${navigator.userAgent}|${navigator.language}|${screen.width}x${screen.height}`
  ).slice(0, 32);

  return {
    device_id: deviceId,
    device_name: `${browser} on ${os}`,
    device_type: deviceType,
    browser,
    os,
    user_agent: ua,
  };
}

export async function createActiveSession(userId: string, sessionToken: string, expiresAt?: Date) {
  try {
    const supabase = createClient();
    const deviceInfo = getDeviceInfo();
    
    // Mark all other sessions as not current
    await supabase
      .from('security_active_sessions')
      .update({ is_current: false })
      .eq('user_id', userId);

    // Create new session
    const { data, error } = await supabase
      .from('security_active_sessions')
      .insert({
        user_id: userId,
        session_token: sessionToken,
        device_id: deviceInfo.device_id,
        device_name: deviceInfo.device_name,
        device_type: deviceInfo.device_type,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        user_agent: deviceInfo.user_agent,
        is_current: true,
        expires_at: expiresAt?.toISOString() || null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (e: any) {
    console.warn('[session] Failed to create active session:', e.message);
    return null;
  }
}

export async function updateSessionActivity(sessionToken: string) {
  try {
    const supabase = createClient();
    await supabase
      .from('security_active_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('session_token', sessionToken);
  } catch (e: any) {
    console.warn('[session] Failed to update session activity:', e.message);
  }
}

export async function checkSecuritySettings(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  requires2FA?: boolean;
}> {
  try {
    const supabase = createClient();
    const { data: settings } = await supabase
      .from('security_settings')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!settings) {
      return { allowed: true }; // No restrictions if no settings
    }

    // Check 2FA requirement (this would be checked during login flow)
    if (settings.require_2fa_for_login && !settings.two_factor_enabled) {
      return {
        allowed: false,
        reason: '2FA is required but not enabled',
        requires2FA: true,
      };
    }

    // IP whitelist check would be done server-side or in auth middleware
    // For now, we just return allowed if no IP restrictions
    if (settings.ip_whitelist_enabled && settings.allowed_ips && settings.allowed_ips.length > 0) {
      // IP check would need to be done server-side with actual request IP
      // This is a placeholder - actual IP checking should be in backend/auth middleware
    }

    return { allowed: true };
  } catch (e: any) {
    console.warn('[security] Failed to check security settings:', e.message);
    return { allowed: true }; // Fail open for now
  }
}

export async function enforceMaxSessions(userId: string, maxSessions: number) {
  try {
    const supabase = createClient();
    
    // Get all active sessions ordered by last activity
    const { data: sessions } = await supabase
      .from('security_active_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('last_activity_at', { ascending: false });

    if (!sessions || sessions.length <= maxSessions) {
      return;
    }

    // Revoke oldest sessions beyond the limit (keep current session)
    const sessionsToRevoke = sessions
      .filter(s => !s.is_current)
      .slice(maxSessions - 1); // Keep maxSessions - 1 (current session is separate)

    for (const session of sessionsToRevoke) {
      await supabase
        .from('security_active_sessions')
        .delete()
        .eq('id', session.id);
    }
  } catch (e: any) {
    console.warn('[security] Failed to enforce max sessions:', e.message);
  }
}

export async function logSecurityEvent(
  userId: string,
  eventType: string,
  eventDescription?: string,
  riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low',
  metadata?: any
) {
  try {
    const supabase = createClient();
    await supabase.from('security_audit_log').insert({
      user_id: userId,
      event_type: eventType,
      event_description: eventDescription,
      risk_level: riskLevel,
      metadata: metadata || {},
    });
  } catch (e: any) {
    console.warn('[security] Failed to log security event:', e.message);
  }
}

