import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../lib/supabaseClient';
import {
  GamificationEventType,
  XP_VALUES,
  ACHIEVEMENTS,
  AchievementDef,
  xpToLevel,
  xpProgress,
  xpForNextLevel,
} from '../utils/gamification';

export interface UserStreak {
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  total_xp: number;
  level: number;
  week_activity: boolean[];
}

export interface UserAchievement {
  achievement_key: string;
  unlocked_at: string;
}

export interface GamificationState {
  streak: UserStreak;
  achievements: UserAchievement[];
  loading: boolean;
  /** Emit an XP-earning event. Returns newly unlocked achievement keys (if any). */
  recordEvent: (type: GamificationEventType, metadata?: Record<string, any>) => Promise<string[]>;
  /** Derived helpers */
  xpProgress: number;
  xpForNext: number;
  allAchievements: (AchievementDef & { unlocked: boolean; unlocked_at?: string })[];
}

const DEFAULT_STREAK: UserStreak = {
  current_streak: 0,
  longest_streak: 0,
  last_active_date: null,
  total_xp: 0,
  level: 1,
  week_activity: [false, false, false, false, false, false, false],
};

export function useGamification(): GamificationState {
  const supabase = useMemo(() => createClient(), []);
  const [streak, setStreak] = useState<UserStreak>(DEFAULT_STREAK);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Bootstrap: fetch streak + achievements
  useEffect(() => {
    let sub: any;

    const bootstrap = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setUserId(user.id);

        // Ensure user_streaks row exists (upsert with defaults)
        const { data: existing } = await supabase
          .from('user_streaks')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('user_streaks').insert({ user_id: user.id });
          setStreak(DEFAULT_STREAK);
        } else {
          setStreak({
            current_streak: existing.current_streak ?? 0,
            longest_streak: existing.longest_streak ?? 0,
            last_active_date: existing.last_active_date,
            total_xp: existing.total_xp ?? 0,
            level: existing.level ?? 1,
            week_activity: existing.week_activity ?? [false, false, false, false, false, false, false],
          });
        }

        // Fetch achievements
        const { data: achData } = await supabase
          .from('user_achievements')
          .select('achievement_key, unlocked_at')
          .eq('user_id', user.id);
        setAchievements(achData ?? []);

        // Realtime subscription on user_streaks
        sub = supabase
          .channel('user_streaks_realtime')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'user_streaks',
            filter: `user_id=eq.${user.id}`,
          }, (payload: any) => {
            if (payload.new) {
              const n = payload.new;
              setStreak({
                current_streak: n.current_streak ?? 0,
                longest_streak: n.longest_streak ?? 0,
                last_active_date: n.last_active_date,
                total_xp: n.total_xp ?? 0,
                level: n.level ?? 1,
                week_activity: n.week_activity ?? [false, false, false, false, false, false, false],
              });
            }
          })
          .subscribe();
      } catch (err) {
        console.error('useGamification bootstrap error', err);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
    return () => { if (sub) supabase.removeChannel(sub); };
  }, [supabase]);

  // Helper: get current day-of-week index (Mon=0 … Sun=6)
  const dayIndex = useCallback(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }, []);

  // Helper: today as YYYY-MM-DD
  const todayStr = useCallback(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  /**
   * Record a gamification event, update streaks, check achievements.
   * Returns an array of newly unlocked achievement keys.
   */
  const recordEvent = useCallback(async (
    type: GamificationEventType,
    metadata: Record<string, any> = {},
  ): Promise<string[]> => {
    if (!userId) return [];

    const xp = XP_VALUES[type] ?? 0;
    const today = todayStr();

    // Deduplicate daily_login: only one per day
    if (type === 'daily_login') {
      const { count } = await supabase
        .from('gamification_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('event_type', 'daily_login')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);
      if ((count ?? 0) > 0) return []; // already logged today
    }

    // 1. Insert event
    await supabase.from('gamification_events').insert({
      user_id: userId,
      event_type: type,
      xp_earned: xp,
      metadata,
    });

    // 2. Update streak + XP
    const newTotalXp = streak.total_xp + xp;
    const newLevel = xpToLevel(newTotalXp);
    const lastActive = streak.last_active_date;
    let newStreak = streak.current_streak;
    let newLongest = streak.longest_streak;

    // Streak logic
    if (lastActive !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      if (lastActive === yesterdayStr) {
        newStreak += 1;
      } else if (lastActive !== today) {
        newStreak = 1; // streak broken
      }
      newLongest = Math.max(newLongest, newStreak);
    }

    // Week activity update
    const newWeek = [...(streak.week_activity || [false, false, false, false, false, false, false])];
    const di = dayIndex();
    newWeek[di] = true;

    const updatePayload = {
      total_xp: newTotalXp,
      level: newLevel,
      current_streak: newStreak,
      longest_streak: newLongest,
      last_active_date: today,
      week_activity: newWeek,
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from('user_streaks')
      .update(updatePayload)
      .eq('user_id', userId);

    // Optimistic local update
    setStreak(prev => ({ ...prev, ...updatePayload }));

    // 3. Check achievements
    const unlockedKeys = new Set(achievements.map(a => a.achievement_key));
    const newlyUnlocked: string[] = [];

    for (const ach of ACHIEVEMENTS) {
      if (unlockedKeys.has(ach.key)) continue;

      let met = false;
      const cond = ach.condition;

      if (cond.type === 'event_count' && cond.eventType) {
        const { count } = await supabase
          .from('gamification_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('event_type', cond.eventType);
        met = (count ?? 0) >= cond.threshold;
      } else if (cond.type === 'streak') {
        met = newStreak >= cond.threshold;
      } else if (cond.type === 'daily_count' && cond.eventType) {
        const { count } = await supabase
          .from('gamification_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('event_type', cond.eventType)
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`);
        met = (count ?? 0) >= cond.threshold;
      } else if (cond.type === 'total_xp') {
        met = newTotalXp >= cond.threshold;
      } else if (cond.type === 'level') {
        met = newLevel >= cond.threshold;
      }

      if (met) {
        const { error } = await supabase.from('user_achievements').upsert({
          user_id: userId,
          achievement_key: ach.key,
        }, { onConflict: 'user_id,achievement_key' });
        if (!error) {
          newlyUnlocked.push(ach.key);
          unlockedKeys.add(ach.key);
        }
      }
    }

    if (newlyUnlocked.length > 0) {
      // Refresh achievements list
      const { data: achData } = await supabase
        .from('user_achievements')
        .select('achievement_key, unlocked_at')
        .eq('user_id', userId);
      setAchievements(achData ?? []);
    }

    return newlyUnlocked;
  }, [userId, streak, achievements, supabase, todayStr, dayIndex]);

  // Merge achievement definitions with user's unlock state
  const allAchievements = useMemo(() => {
    const unlockMap = new Map(achievements.map(a => [a.achievement_key, a.unlocked_at]));
    return ACHIEVEMENTS.map(def => ({
      ...def,
      unlocked: unlockMap.has(def.key),
      unlocked_at: unlockMap.get(def.key),
    }));
  }, [achievements]);

  return {
    streak,
    achievements,
    loading,
    recordEvent,
    xpProgress: xpProgress(streak.total_xp),
    xpForNext: xpForNextLevel(streak.level),
    allAchievements,
  };
}
