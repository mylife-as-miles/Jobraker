-- =============================================================
-- Gamification System: XP, Streaks, Achievements
-- =============================================================

-- 1. Append-only event log for XP-earning actions
CREATE TABLE IF NOT EXISTS gamification_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'job_applied', 'interview_scheduled', 'offer_received',
    'profile_completed', 'resume_uploaded', 'daily_login',
    'cover_letter_generated', 'streak_bonus'
  )),
  xp_earned INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gamification_events_user ON gamification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_events_type ON gamification_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_gamification_events_date ON gamification_events(user_id, created_at);

-- 2. Single-row-per-user aggregate for fast dashboard reads
CREATE TABLE IF NOT EXISTS user_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  week_activity BOOLEAN[] NOT NULL DEFAULT ARRAY[false,false,false,false,false,false,false],
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Junction table for unlocked achievements
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- =============================================================
-- Row Level Security
-- =============================================================

ALTER TABLE gamification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- gamification_events: users read/insert their own rows only
CREATE POLICY "Users read own gamification events"
  ON gamification_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own gamification events"
  ON gamification_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- user_streaks: users read/insert/update their own row
CREATE POLICY "Users read own streak"
  ON user_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own streak"
  ON user_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own streak"
  ON user_streaks FOR UPDATE
  USING (auth.uid() = user_id);

-- user_achievements: users read/insert their own rows
CREATE POLICY "Users read own achievements"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own achievements"
  ON user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);
