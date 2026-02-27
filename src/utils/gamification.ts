// Gamification Constants: XP values, achievement definitions, and level formula
// XP can eventually be converted to platform credits at a controlled exchange rate.

export type GamificationEventType =
  | 'job_applied'
  | 'interview_scheduled'
  | 'offer_received'
  | 'profile_completed'
  | 'resume_uploaded'
  | 'daily_login'
  | 'cover_letter_generated'
  | 'streak_bonus';

export const XP_VALUES: Record<GamificationEventType, number> = {
  job_applied: 10,
  interview_scheduled: 25,
  offer_received: 50,
  profile_completed: 15,
  resume_uploaded: 10,
  daily_login: 5,
  cover_letter_generated: 5,
  streak_bonus: 15,
};

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string; // emoji
  /** Function-style condition metadata used by the hook */
  condition: {
    type: 'event_count' | 'streak' | 'daily_count' | 'level' | 'total_xp';
    eventType?: GamificationEventType;
    threshold: number;
  };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: 'first_application',
    title: 'First Application',
    description: 'Submit your first job application',
    icon: '🔥',
    condition: { type: 'event_count', eventType: 'job_applied', threshold: 1 },
  },
  {
    key: 'job_hunter',
    title: 'Job Hunter',
    description: 'Apply to 10 jobs',
    icon: '🎯',
    condition: { type: 'event_count', eventType: 'job_applied', threshold: 10 },
  },
  {
    key: 'power_applicant',
    title: 'Power Applicant',
    description: 'Apply to 50 jobs',
    icon: '🏆',
    condition: { type: 'event_count', eventType: 'job_applied', threshold: 50 },
  },
  {
    key: 'resume_master',
    title: 'Resume Master',
    description: 'Upload 3 resumes',
    icon: '📝',
    condition: { type: 'event_count', eventType: 'resume_uploaded', threshold: 3 },
  },
  {
    key: 'interview_pro',
    title: 'Interview Pro',
    description: 'Schedule 5 interviews',
    icon: '💼',
    condition: { type: 'event_count', eventType: 'interview_scheduled', threshold: 5 },
  },
  {
    key: 'streak_champion',
    title: 'Streak Champion',
    description: 'Maintain a 7-day activity streak',
    icon: '⭐',
    condition: { type: 'streak', threshold: 7 },
  },
  {
    key: 'rocket_start',
    title: 'Rocket Start',
    description: 'Apply to 5 jobs in a single day',
    icon: '🚀',
    condition: { type: 'daily_count', eventType: 'job_applied', threshold: 5 },
  },
  {
    key: 'xp_centurion',
    title: 'XP Centurion',
    description: 'Earn 500 total XP',
    icon: '💎',
    condition: { type: 'total_xp', threshold: 500 },
  },
  {
    key: 'level_5',
    title: 'Rising Star',
    description: 'Reach Level 5',
    icon: '🌟',
    condition: { type: 'level', threshold: 5 },
  },
  {
    key: 'offer_getter',
    title: 'Offer Getter',
    description: 'Receive your first job offer',
    icon: '🎉',
    condition: { type: 'event_count', eventType: 'offer_received', threshold: 1 },
  },
];

/** Deterministic level from total XP */
export function xpToLevel(totalXp: number): number {
  return Math.floor(totalXp / 100) + 1;
}

/** XP needed for the next level boundary */
export function xpForNextLevel(currentLevel: number): number {
  return currentLevel * 100;
}

/** XP progress within the current level (0–99) */
export function xpProgress(totalXp: number): number {
  return totalXp % 100;
}
