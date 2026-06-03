import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { motion } from "framer-motion";
import {
  Edit,
  Mail,
  Phone,
  MapPin,
  Plus,
  ExternalLink,
  Calendar,
  Trash2,
  Award,
  GraduationCap,
  Briefcase,
  Lightbulb,
  Crown,
  Zap,
  Trophy,
  Lock as LockIcon,
} from "lucide-react";
import { EmptyState } from "../../../components/ui/empty-state";
import { Skeleton } from "../../../components/ui/skeleton";
import { useProfileSettings } from "../../../hooks/useProfileSettings";
import type {
  ProfileEducationRecord as TProfileEducation,
  ProfileExperienceRecord as TProfileExperience,
  ProfileSkillRecord as TProfileSkill,
} from "../../../hooks/useProfileSettings";
import { useApplications } from "../../../hooks/useApplications";
import { createClient } from "../../../lib/supabaseClient";
import { useGamification } from "../../../hooks/useGamification";
import { CandidateMemoryEditor } from "../components/CandidateMemoryEditor";
import { ProfileAvailabilitySection } from "../components/ProfileAvailabilitySection";
import { PublicProfileShareCard } from "../components/PublicProfileShareCard";

// Data now comes from Supabase via useProfileCollections

const ProfilePage = (): JSX.Element => {
  const [isEditing, setIsEditing] = useState(false);
  const {
    profile,
    updateProfile,
    loading: profileLoading,
  } = useProfileSettings();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<
    "Free" | "Basics" | "Pro" | "Ultimate"
  >("Free");
  const gamification = useGamification();
  const initials = useMemo(() => {
    const a = (profile?.first_name || "").trim();
    const b = (profile?.last_name || "").trim();
    const i =
      `${a.charAt(0) || ""}${b.charAt(0) || ""}` || email.charAt(0) || "U";
    return i.toUpperCase();
  }, [profile?.first_name, profile?.last_name, email]);

  // hydrate auth email
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const em = (data as any)?.user?.email ?? "";
      setEmail(em);
    })();
  }, [supabase]);

  // Fetch subscription tier
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;

      // Try to get from active subscription first
      const { data: subscription } = await supabase
        .from("user_subscriptions")
        .select("subscription_plans(name)")
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("current_period_end", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription && (subscription as any).subscription_plans?.name) {
        setSubscriptionTier((subscription as any).subscription_plans.name);
      } else {
        setSubscriptionTier("Free");
      }
    })();
  }, [supabase]);

  // resolve signed avatar URL from private storage (refresh every 8 mins)
  useEffect(() => {
    let active = true;
    const load = async () => {
      const path = (profile as any)?.avatar_url as string | undefined;
      if (!path) {
        if (active) setAvatarUrl(null);
        return;
      }
      try {
        const { data, error } = await (supabase as any).storage
          .from("avatars")
          .createSignedUrl(path, 60 * 10);
        if (error) throw error;
        if (active) setAvatarUrl(data?.signedUrl || null);
      } catch {
        if (active) setAvatarUrl(null);
      }
    };
    load();
    const id = setInterval(load, 1000 * 60 * 8);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [supabase, (profile as any)?.avatar_url]);

  // Collections now sourced directly from useProfileSettings (centralized hook)
  const {
    experiences,
    education,
    skills,
    addExperience,
    addEducation,
    addSkill,
    deleteExperience,
    deleteEducation,
    deleteSkill,
    updateExperience,
    updateEducation,
    updateSkill,
  } = useProfileSettings() as any; // NOTE: duplicate hook invocation; consider consolidating later

  // Local UI state for creation / editing
  const [showAddExperience, setShowAddExperience] = useState(false);
  const [showAddEducation, setShowAddEducation] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  // Applications for realtime Quick Stats
  const {
    applications,
    loading: appsLoading,
    error: appsError,
  } = useApplications();
  const totalApps = applications?.length ?? 0;
  const interviews =
    applications?.filter((a) => a.status === "Interview").length ?? 0;
  const offers = applications?.filter((a) => a.status === "Offer").length ?? 0;
  const successRate =
    totalApps > 0 ? Math.round((offers / totalApps) * 100) : 0;

  // --- PRD Metrics for Success ---
  // 1. Applications Submitted This Week
  const appsThisWeek = useMemo(() => {
    if (!applications?.length) return 0;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    return applications.filter((a) => new Date(a.applied_date) >= startOfWeek)
      .length;
  }, [applications]);

  // 2. Interview Conversion Rate
  const interviewConversion =
    totalApps > 0 ? Math.round((interviews / totalApps) * 100) : 0;

  // 3. Time Saved (20 min per application)
  const timeSavedMinutes = totalApps * 20;
  const timeSavedDisplay =
    timeSavedMinutes >= 60
      ? `${Math.floor(timeSavedMinutes / 60)}h ${timeSavedMinutes % 60}m`
      : `${timeSavedMinutes}m`;

  // 4. Automation Success Rate
  const automationMetrics = useMemo(() => {
    if (!applications?.length) return { total: 0, succeeded: 0, rate: 0 };
    const automated = applications.filter((a) => a.run_id);
    const total = automated.length;
    const succeeded = automated.filter(
      (a) => a.provider_status !== "failed",
    ).length;
    return {
      total,
      succeeded,
      rate: total > 0 ? Math.round((succeeded / total) * 100) : 0,
    };
  }, [applications]);

  // skill level helpers
  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case "Expert":
        return "bg-brand/100";
      case "Advanced":
        return "bg-blue-500";
      case "Intermediate":
        return "bg-brand/100";
      case "Beginner":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  // Subscription tier badge helper
  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "Pro":
        return {
          icon: Zap,
          color: "from-blue-500 to-brand",
          textColor: "text-blue-300",
          label: "Pro",
        };
      case "Ultimate":
        return {
          icon: Crown,
          color: "from-purple-500 to-pink-500",
          textColor: "text-purple-300",
          label: "Ultimate",
        };
      default:
        return null;
    }
  };

  const getSkillLevelWidth = (level: string) => {
    switch (level) {
      case "Expert":
        return "w-full";
      case "Advanced":
        return "w-3/4";
      case "Intermediate":
        return "w-1/2";
      case "Beginner":
        return "w-1/4";
      default:
        return "w-1/4";
    }
  };

  // Avatar upload handler
  const onAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = (userData as any)?.user?.id as string | undefined;
      if (!userId) return;
      const path = `${userId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await (supabase as any).storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      await updateProfile({ avatar_url: path } as any);
    } catch {
      // swallow; toast handled by hook on failure
    } finally {
      e.currentTarget.value = "";
    }
  };

  const showAboutEmpty =
    !isEditing &&
    !profile?.job_title &&
    !profile?.location &&
    !profile?.experience_years;

  // Register profile coach marks with stable IDs
  useRegisterCoachMarks({
    page: "profile",
    marks: [
      {
        id: "profile-avatar",
        selector: "#profile-avatar",
        title: "Personal Brand",
        body: "Upload or update your avatar to personalize applications.",
      },
      {
        id: "profile-quick-stats",
        selector: "#profile-quick-stats",
        title: "Live Outcomes",
        body: "Track total applications, interviews and offers to measure progress.",
      },
      {
        id: "profile-about",
        selector: "#profile-about",
        title: "Tell Your Story",
        body: "Summarize your role, location and experience to give context at a glance.",
      },
      {
        id: "profile-experience",
        selector: "#profile-experience",
        title: "Experience Timeline",
        body: "Add roles highlighting impact, scope and achievements.",
      },
    ],
  });

  return (
    <div className='product-page-shell min-h-full'>
      <div className='w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8'>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8'>
          {/* Profile Sidebar */}
          <div className='lg:col-span-1 space-y-6'>
            {/* Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.02 }}
              className='transition-transform duration-300'
            >
              <Card
                id='profile-avatar'
                data-tour='profile-avatar'
                className='product-section-card p-6 hover:border-brand/60 hover:shadow-lg transition-all duration-300'
              >
                <div className='text-center'>
                  <div className='relative inline-block mb-4'>
                    {profile === null && (
                      <Skeleton className='w-24 h-24 rounded-full' />
                    )}
                    {profile !== null && (
                      <>
                        <div className='w-24 h-24 bg-gradient-to-r from-brand to-background rounded-full flex items-center justify-center text-black font-bold text-2xl overflow-hidden'>
                          {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={avatarUrl}
                              alt='Avatar'
                              className='w-full h-full object-cover'
                            />
                          ) : (
                            <span>{initials}</span>
                          )}
                        </div>
                        <label className='absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-brand text-black hover:bg-brand/90 hover:scale-110 transition-all duration-300 p-0 flex items-center justify-center cursor-pointer'>
                          <Edit className='w-4 h-4' />
                          <input
                            type='file'
                            accept='image/*'
                            className='hidden'
                            onChange={onAvatarPick}
                          />
                        </label>
                      </>
                    )}
                  </div>

                  <h2 className='text-xl font-bold text-foreground mb-1'>
                    {(profile?.first_name || "").trim() || "Your"}{" "}
                    {(profile?.last_name || "").trim() || "Name"}
                  </h2>
                  <p className='product-helper-text mb-2'>
                    {profile?.job_title || "Add a job title"}
                  </p>

                  {/* Subscription Tier Badge */}
                  {(() => {
                    const tierBadge = getTierBadge(subscriptionTier);
                    if (!tierBadge) return null;
                    const TierIcon = tierBadge.icon;
                    return (
                      <div
                        className='inline-flex items-center gap-1.5 px-3 py-1.5 mb-3 rounded-full bg-gradient-to-r shadow-lg border border-foreground/20'
                        style={
                          {
                            backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))`,
                            "--tw-gradient-from": tierBadge.color
                              .split(" ")[0]
                              .replace("from-", ""),
                            "--tw-gradient-to": tierBadge.color
                              .split(" ")[1]
                              .replace("to-", ""),
                          } as any
                        }
                      >
                        <TierIcon className='w-4 h-4 text-foreground' />
                        <span className='text-sm font-semibold text-foreground'>
                          {tierBadge.label}
                        </span>
                      </div>
                    );
                  })()}

                  <p className='product-helper-text text-sm mb-4 flex items-center justify-center'>
                    <MapPin className='w-4 h-4 mr-1' />
                    {profile?.location || "Add location"}
                  </p>

                  <div className='space-y-2 text-sm'>
                    <div className='flex items-center justify-center product-helper-text hover:text-foreground transition-colors duration-300'>
                      <Mail className='w-4 h-4 mr-2' />
                      <span>{email || "your@email"}</span>
                    </div>
                    <div className='flex items-center justify-center product-helper-text hover:text-foreground transition-colors duration-300'>
                      <Phone className='w-4 h-4 mr-2' />
                      <span>{(profile as any)?.phone || "Add phone"}</span>
                    </div>
                  </div>

                  <div className='flex justify-center space-x-2 mt-4'>
                    {profile?.linkedin_url ? (
                      <Button
                        size='sm'
                        variant='outline'
                        className='product-outline-button hover:scale-105 transition-all duration-300'
                        asChild
                      >
                        <a
                          href={profile.linkedin_url.startsWith('http') ? profile.linkedin_url : `https://${profile.linkedin_url}`}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          <ExternalLink className='w-4 h-4 mr-1' />
                          LinkedIn
                        </a>
                      </Button>
                    ) : (
                      <Button
                        size='sm'
                        variant='outline'
                        className='product-outline-button border-dashed border-foreground/20 text-muted-foreground/60 hover:text-foreground hover:scale-105 transition-all duration-300'
                        asChild
                      >
                        <Link to='/dashboard/settings/profile'>
                          <Plus className='w-4 h-4 mr-1' />
                          Add LinkedIn
                        </Link>
                      </Button>
                    )}
                    {profile?.github_url ? (
                      <Button
                        size='sm'
                        variant='outline'
                        className='product-outline-button hover:scale-105 transition-all duration-300'
                        asChild
                      >
                        <a
                          href={profile.github_url.startsWith('http') ? profile.github_url : `https://${profile.github_url}`}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          <ExternalLink className='w-4 h-4 mr-1' />
                          GitHub
                        </a>
                      </Button>
                    ) : (
                      <Button
                        size='sm'
                        variant='outline'
                        className='product-outline-button border-dashed border-foreground/20 text-muted-foreground/60 hover:text-foreground hover:scale-105 transition-all duration-300'
                        asChild
                      >
                        <Link to='/dashboard/settings/profile'>
                          <Plus className='w-4 h-4 mr-1' />
                          Add GitHub
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className='transition-transform duration-300'
            >
              <PublicProfileShareCard profile={profile} />
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              className='transition-transform duration-300'
            >
              <Card
                id='profile-quick-stats'
                data-tour='profile-quick-stats'
                className='product-section-card p-6 hover:border-brand/60 hover:shadow-lg transition-all duration-300'
              >
                <h3 className='text-lg font-semibold text-foreground mb-4'>
                  Quick Stats
                </h3>
                {appsLoading ? (
                  <div className='space-y-3'>
                    <Skeleton className='h-4 w-32' />
                    <Skeleton className='h-4 w-28' />
                    <Skeleton className='h-4 w-24' />
                    <Skeleton className='h-4 w-20' />
                  </div>
                ) : appsError ? (
                  <p className='text-sm text-brand'>{appsError}</p>
                ) : (
                  <div className='space-y-3'>
                    <div className='flex justify-between items-center'>
                      <span className='product-helper-text'>Applications</span>
                      <span className='text-brand font-semibold'>
                        {totalApps}
                      </span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='product-helper-text'>Interviews</span>
                      <span className='text-brand font-semibold'>
                        {interviews}
                      </span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='product-helper-text'>Offers</span>
                      <span className='text-brand font-semibold'>{offers}</span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='product-helper-text'>Success Rate</span>
                      <span className='text-brand font-semibold'>
                        {successRate}%
                      </span>
                    </div>

                    {/* PRD Metrics for Success */}
                    <div className='border-t border-foreground/10 my-2 pt-3'>
                      <p className='text-[10px] uppercase tracking-widest text-foreground/30 mb-3'>
                        Key Metrics
                      </p>
                      <div className='space-y-3'>
                        <div className='flex justify-between items-center'>
                          <span className='product-helper-text flex items-center gap-1.5'>
                            <svg
                              className='w-3.5 h-3.5 text-brand/60'
                              fill='none'
                              viewBox='0 0 24 24'
                              stroke='currentColor'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                              />
                            </svg>
                            Apps This Week
                          </span>
                          <span className='text-brand font-semibold'>
                            {appsThisWeek}
                          </span>
                        </div>
                        <div className='flex justify-between items-center'>
                          <span className='product-helper-text flex items-center gap-1.5'>
                            <svg
                              className='w-3.5 h-3.5 text-brand/60'
                              fill='none'
                              viewBox='0 0 24 24'
                              stroke='currentColor'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'
                              />
                            </svg>
                            Interview Rate
                          </span>
                          <span className='text-brand font-semibold'>
                            {interviewConversion}%
                          </span>
                        </div>
                        <div className='flex justify-between items-center'>
                          <span className='product-helper-text flex items-center gap-1.5'>
                            <svg
                              className='w-3.5 h-3.5 text-brand/60'
                              fill='none'
                              viewBox='0 0 24 24'
                              stroke='currentColor'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                              />
                            </svg>
                            Time Saved
                          </span>
                          <span className='text-brand font-semibold'>
                            {timeSavedDisplay}
                          </span>
                        </div>
                        <div className='flex justify-between items-center'>
                          <span className='product-helper-text flex items-center gap-1.5'>
                            <svg
                              className='w-3.5 h-3.5 text-purple-400/60'
                              fill='none'
                              viewBox='0 0 24 24'
                              stroke='currentColor'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
                              />
                            </svg>
                            Automation Rate
                          </span>
                          <span className='text-purple-400 font-semibold'>
                            {automationMetrics.rate}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>

            {/* XP Level Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              whileHover={{ scale: 1.02 }}
              className='transition-transform duration-300'
            >
              <Card className='product-section-card relative overflow-hidden p-5 hover:border-brand/60 hover:shadow-lg transition-all duration-300'>
                <div className='absolute -top-20 -right-20 w-56 h-56 rounded-full bg-brand/5 blur-3xl' />
                <div className='relative z-10'>
                  <div className='flex items-center justify-between mb-3'>
                    <div className='flex items-center gap-2.5'>
                      <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/30 flex items-center justify-center shadow-inner'>
                        <Zap className='w-5 h-5 text-brand' />
                      </div>
                      <div>
                        <h3 className='text-sm sm:text-base font-semibold text-foreground tracking-tight'>
                          Level {gamification.streak.level}
                        </h3>
                        <p className='text-[9px] sm:text-[10px] text-foreground/30 uppercase tracking-wider font-medium'>
                          Experience Points
                        </p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <div className='text-lg sm:text-xl font-bold text-brand'>
                        {gamification.streak.total_xp}{" "}
                        <span className='text-xs font-normal text-foreground/20'>
                          XP
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className='mb-1'>
                    <div className='flex items-center justify-between mb-1.5'>
                      <span className='text-[9px] sm:text-[10px] product-helper-text uppercase tracking-wider font-medium'>
                        Next Level
                      </span>
                      <span className='text-xs font-semibold text-brand'>
                        {gamification.xpProgress}/{gamification.xpForNext}
                      </span>
                    </div>
                    <div className='relative w-full h-2.5 rounded-full bg-foreground/5 overflow-hidden'>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(100, (gamification.xpProgress / gamification.xpForNext) * 100)}%`,
                        }}
                        transition={{
                          duration: 1.2,
                          ease: "easeOut",
                          delay: 0.2,
                        }}
                        className='absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-brand to-background shadow-lg shadow-brand/50'
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Achievements Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className='transition-transform duration-300'
            >
              <Card className='product-section-card relative overflow-hidden p-5 hover:border-brand/60 hover:shadow-lg transition-all duration-300'>
                <div className='flex items-center gap-2.5 mb-3'>
                  <div className='w-9 h-9 rounded-xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/30 flex items-center justify-center shadow-inner'>
                    <Trophy className='w-4 h-4 text-brand' />
                  </div>
                  <div>
                    <h3 className='text-sm sm:text-base font-semibold text-foreground tracking-tight'>
                      Achievements
                    </h3>
                    <p className='text-[9px] sm:text-[10px] text-foreground/30 uppercase tracking-wider font-medium'>
                      {
                        gamification.allAchievements.filter((a) => a.unlocked)
                          .length
                      }
                      /{gamification.allAchievements.length} Unlocked
                    </p>
                  </div>
                </div>
                <div className='grid grid-cols-3 sm:grid-cols-5 gap-2'>
                  {gamification.allAchievements.map((ach) => (
                    <motion.div
                      key={ach.key}
                      whileHover={{ scale: 1.12 }}
                      title={`${ach.title}: ${ach.description}`}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-lg border transition-all duration-300 cursor-default ${
                        ach.unlocked
                          ? "bg-brand/10 border-brand/40 shadow-lg shadow-brand/20"
                          : "bg-foreground/5 border-foreground/5 opacity-40"
                      }`}
                    >
                      <span className='text-lg sm:text-xl'>{ach.icon}</span>
                      <span className='text-[7px] sm:text-[8px] product-helper-text mt-0.5 font-medium text-center leading-tight truncate w-full'>
                        {ach.title}
                      </span>
                      {!ach.unlocked && (
                        <LockIcon className='absolute top-1 right-1 w-2.5 h-2.5 text-foreground/20' />
                      )}
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Profile Main Content */}
          <div className='lg:col-span-2 space-y-6'>
            {/* About Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ scale: 1.01 }}
              className='transition-transform duration-300'
            >
              <Card
                id='profile-about'
                data-tour='profile-about'
                className='product-section-card p-6 hover:border-brand/60 hover:shadow-lg transition-all duration-300'
              >
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-lg font-semibold text-foreground'>
                    About
                  </h3>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='product-helper-text hover:text-foreground hover:bg-foreground/10 hover:scale-110 transition-all duration-300'
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Edit className='w-4 h-4' />
                  </Button>
                </div>
                {profileLoading && !isEditing && profile === null ? (
                  <div className='space-y-3'>
                    <Skeleton className='h-4 w-40' />
                    <Skeleton className='h-3 w-64' />
                    <Skeleton className='h-3 w-56' />
                  </div>
                ) : isEditing ? (
                  <AboutEditor
                    profile={{
                      job_title: profile?.job_title ?? "",
                      location: profile?.location ?? "",
                      location_scope:
                        (profile as any)?.location_scope ?? "city",
                      experience_years: profile?.experience_years ?? null,
                    }}
                    onCancel={() => setIsEditing(false)}
                    onSave={async (patch) => {
                      await updateProfile(patch as any);
                      setIsEditing(false);
                    }}
                  />
                ) : (
                  <>
                    {showAboutEmpty ? (
                      <EmptyState
                        icon={Lightbulb}
                        title='Tell Your Story'
                        description='Add your role, location and years of experience so recruiters immediately understand your professional narrative.'
                        primaryAction={{
                          label: "Start Editing",
                          onClick: () => setIsEditing(true),
                        }}
                        secondaryChips={[
                          "Job Title",
                          "Location",
                          "Years",
                          "Impact",
                        ]}
                        tone='info'
                      />
                    ) : (
                      <p className='product-helper-text leading-relaxed'>
                        Working as{" "}
                        <span className='text-foreground font-medium'>
                          {profile?.job_title}
                        </span>
                        {profile?.experience_years ? (
                          <>
                            {" "}
                            with{" "}
                            <span className='text-foreground font-medium'>
                              {profile.experience_years}
                            </span>{" "}
                            years experience
                          </>
                        ) : null}
                        {profile?.location ? (
                          <>
                            {" "}
                            in{" "}
                            <span className='text-foreground font-medium'>
                              {profile.location}
                            </span>
                            <span className='ml-1 inline-flex items-center rounded-full bg-foreground/5 border border-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70'>
                              {(profile as any)?.location_scope === "global"
                                ? "Global"
                                : (profile as any)?.location_scope === "country"
                                  ? "Country"
                                  : "City"}
                            </span>
                          </>
                        ) : null}
                        .
                      </p>
                    )}
                  </>
                )}
              </Card>
            </motion.div>

            <ProfileAvailabilitySection
              profile={profile}
              loading={profileLoading}
              onSave={async (patch) => {
                await updateProfile(patch);
              }}
            />

            {/* Experience Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ scale: 1.01 }}
              className='transition-transform duration-300'
            >
              <Card
                id='profile-experience'
                data-tour='profile-experience'
                className='product-section-card p-6 hover:border-brand/60 hover:shadow-lg transition-all duration-300'
              >
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-lg font-semibold text-foreground flex items-center'>
                    <Briefcase className='w-5 h-5 mr-2 text-foreground' />
                    Experience
                  </h3>
                  <Button
                    size='sm'
                    className='bg-brand text-black hover:bg-brand/90 hover:scale-105 transition-all duration-300'
                    onClick={() => setShowAddExperience((v) => !v)}
                  >
                    <Plus className='w-4 h-4 mr-1' />
                    {showAddExperience ? "Close" : "Add"}
                  </Button>
                </div>
                {showAddExperience && (
                  <div className='mb-4 space-y-2 p-4 bg-foreground/5 rounded-lg'>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                      <input
                        placeholder='Title'
                        id='exp-title'
                        className='product-input-surface rounded px-3 py-2 text-sm'
                      />
                      <input
                        placeholder='Company'
                        id='exp-company'
                        className='product-input-surface rounded px-3 py-2 text-sm'
                      />
                      <input
                        placeholder='Location'
                        id='exp-location'
                        className='product-input-surface rounded px-3 py-2 text-sm'
                      />
                      <div className='flex gap-2'>
                        <input
                          type='month'
                          placeholder='Start'
                          id='exp-start'
                          className='product-input-surface flex-1 rounded px-3 py-2 text-sm'
                        />
                        <input
                          type='month'
                          placeholder='End'
                          id='exp-end'
                          className='product-input-surface flex-1 rounded px-3 py-2 text-sm'
                        />
                      </div>
                      <label className='flex items-center gap-2 text-xs product-helper-text'>
                        <input
                          type='checkbox'
                          id='exp-current'
                          className='accent-brand'
                        />{" "}
                        Current Role
                      </label>
                      <textarea
                        placeholder='Description'
                        id='exp-desc'
                        rows={2}
                        className='product-input-surface col-span-full rounded px-3 py-2 text-sm resize-none'
                      />
                    </div>
                    <div className='flex justify-end gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        className='border-foreground/20 text-foreground hover:bg-foreground/10'
                        onClick={() => setShowAddExperience(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size='sm'
                        className='bg-brand text-black hover:bg-brand/90'
                        onClick={() => {
                          const title = (
                            document.getElementById(
                              "exp-title",
                            ) as HTMLInputElement
                          )?.value.trim();
                          if (!title) return;
                          addExperience({
                            title,
                            company: (
                              document.getElementById(
                                "exp-company",
                              ) as HTMLInputElement
                            )?.value.trim(),
                            location: (
                              document.getElementById(
                                "exp-location",
                              ) as HTMLInputElement
                            )?.value.trim(),
                            start_date: (
                              document.getElementById(
                                "exp-start",
                              ) as HTMLInputElement
                            )?.value
                              ? (
                                  document.getElementById(
                                    "exp-start",
                                  ) as HTMLInputElement
                                ).value + "-01"
                              : new Date().toISOString(),
                            end_date: (
                              document.getElementById(
                                "exp-current",
                              ) as HTMLInputElement
                            )?.checked
                              ? null
                              : (
                                    document.getElementById(
                                      "exp-end",
                                    ) as HTMLInputElement
                                  )?.value
                                ? (
                                    document.getElementById(
                                      "exp-end",
                                    ) as HTMLInputElement
                                  ).value + "-01"
                                : null,
                            is_current: (
                              document.getElementById(
                                "exp-current",
                              ) as HTMLInputElement
                            )?.checked,
                            description: (
                              document.getElementById(
                                "exp-desc",
                              ) as HTMLTextAreaElement
                            )?.value.trim(),
                          });
                          setShowAddExperience(false);
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                )}
                <div className='space-y-4'>
                  {experiences.loading && (
                    <div className='space-y-4'>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className='border-l-2 border-brand pl-4 pb-4 relative p-3 rounded-r-lg'
                        >
                          <Skeleton className='absolute -left-2 top-3 w-4 h-4 rounded-full' />
                          <div className='space-y-2'>
                            <Skeleton className='h-4 w-40' />
                            <Skeleton className='h-3 w-32' />
                            <Skeleton className='h-3 w-24' />
                            <Skeleton className='h-3 w-full' />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!experiences.loading && experiences.error && (
                    <p className='text-sm text-brand'>{experiences.error}</p>
                  )}
                  {!experiences.loading &&
                    !experiences.error &&
                    experiences.data.length === 0 && (
                      <EmptyState
                        icon={Briefcase}
                        title='Add Your First Role'
                        description='Showcase achievements, scope and measurable results. Strong experience entries boost credibility.'
                        primaryAction={{
                          label: "Add Experience",
                          onClick: () => setShowAddExperience(true),
                        }}
                        secondaryChips={[
                          "Leadership",
                          "Ownership",
                          "Impact",
                          "Growth",
                        ]}
                        tone='primary'
                      />
                    )}
                  {experiences.data.map(
                    (exp: TProfileExperience, index: number) => (
                      <motion.div
                        key={exp.id}
                        className='border-l-2 border-brand pl-4 pb-4 relative hover:bg-foreground/5 p-3 rounded-r-lg transition-all duration-300'
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ x: 4 }}
                      >
                        <div className='absolute -left-2 top-3 w-4 h-4 bg-brand rounded-full'></div>
                        <div className='flex items-start justify-between'>
                          <div className='flex-1'>
                            <h4 className='text-foreground font-semibold'>
                              {exp.title}
                            </h4>
                            <p className='text-foreground font-medium'>
                              {exp.company}
                            </p>
                            <p className='product-helper-text text-sm flex items-center'>
                              <MapPin className='w-3 h-3 mr-1' />
                              {exp.location}
                            </p>
                            <p className='product-helper-text text-sm flex items-center mt-1'>
                              <Calendar className='w-3 h-3 mr-1' />
                              {exp.start_date?.slice(0, 7)} -{" "}
                              {exp.is_current
                                ? "Present"
                                : exp.end_date
                                  ? exp.end_date.slice(0, 7)
                                  : ""}
                            </p>
                            <p className='product-helper-text text-sm mt-2 leading-relaxed'>
                              {exp.description}
                            </p>
                          </div>
                          <div className='flex space-x-1 ml-4'>
                            {editingExpId === exp.id ? null : (
                              <Button
                                size='sm'
                                variant='ghost'
                                className='product-helper-text hover:text-foreground hover:scale-110 transition-all duration-300 p-1'
                                onClick={() => setEditingExpId(exp.id)}
                              >
                                <Edit className='w-3 h-3' />
                              </Button>
                            )}
                            <Button
                              size='sm'
                              variant='ghost'
                              className='product-helper-text hover:text-brand hover:scale-110 transition-all duration-300 p-1'
                              onClick={() => deleteExperience(exp.id)}
                            >
                              <Trash2 className='w-3 h-3' />
                            </Button>
                          </div>
                        </div>

                        {editingExpId === exp.id && (
                          <div className='mt-3 p-3 bg-foreground/5 rounded-lg space-y-2'>
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                              <input
                                defaultValue={exp.title}
                                id={`exp-edit-title-${exp.id}`}
                                placeholder='Title'
                                className='product-input-surface rounded px-3 py-2 text-sm'
                              />
                              <input
                                defaultValue={exp.company}
                                id={`exp-edit-company-${exp.id}`}
                                placeholder='Company'
                                className='product-input-surface rounded px-3 py-2 text-sm'
                              />
                              <input
                                defaultValue={exp.location}
                                id={`exp-edit-location-${exp.id}`}
                                placeholder='Location'
                                className='product-input-surface rounded px-3 py-2 text-sm'
                              />
                              <div className='flex gap-2'>
                                <input
                                  type='month'
                                  defaultValue={(exp.start_date || "").slice(
                                    0,
                                    7,
                                  )}
                                  id={`exp-edit-start-${exp.id}`}
                                  className='product-input-surface flex-1 rounded px-3 py-2 text-sm'
                                />
                                <input
                                  type='month'
                                  defaultValue={
                                    exp.end_date ? exp.end_date.slice(0, 7) : ""
                                  }
                                  id={`exp-edit-end-${exp.id}`}
                                  className='product-input-surface flex-1 rounded px-3 py-2 text-sm'
                                />
                              </div>
                              <label className='flex items-center gap-2 text-xs product-helper-text'>
                                <input
                                  type='checkbox'
                                  defaultChecked={!!exp.is_current}
                                  id={`exp-edit-current-${exp.id}`}
                                  className='accent-brand'
                                />{" "}
                                Current Role
                              </label>
                              <textarea
                                defaultValue={exp.description || ""}
                                id={`exp-edit-desc-${exp.id}`}
                                rows={2}
                                placeholder='Description'
                                className='product-input-surface col-span-full rounded px-3 py-2 text-sm resize-none'
                              />
                            </div>
                            <div className='flex justify-end gap-2'>
                              <Button
                                size='sm'
                                variant='outline'
                                className='border-foreground/20 text-foreground hover:bg-foreground/10'
                                onClick={() => setEditingExpId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size='sm'
                                className='bg-brand text-black hover:bg-brand/90'
                                onClick={async () => {
                                  await updateExperience(exp.id, {
                                    title: (
                                      document.getElementById(
                                        `exp-edit-title-${exp.id}`,
                                      ) as HTMLInputElement
                                    )?.value.trim(),
                                    company: (
                                      document.getElementById(
                                        `exp-edit-company-${exp.id}`,
                                      ) as HTMLInputElement
                                    )?.value.trim(),
                                    location: (
                                      document.getElementById(
                                        `exp-edit-location-${exp.id}`,
                                      ) as HTMLInputElement
                                    )?.value.trim(),
                                    start_date: (
                                      document.getElementById(
                                        `exp-edit-start-${exp.id}`,
                                      ) as HTMLInputElement
                                    )?.value
                                      ? (
                                          document.getElementById(
                                            `exp-edit-start-${exp.id}`,
                                          ) as HTMLInputElement
                                        ).value + "-01"
                                      : exp.start_date,
                                    end_date: (
                                      document.getElementById(
                                        `exp-edit-current-${exp.id}`,
                                      ) as HTMLInputElement
                                    )?.checked
                                      ? null
                                      : (
                                            document.getElementById(
                                              `exp-edit-end-${exp.id}`,
                                            ) as HTMLInputElement
                                          )?.value
                                        ? (
                                            document.getElementById(
                                              `exp-edit-end-${exp.id}`,
                                            ) as HTMLInputElement
                                          ).value + "-01"
                                        : exp.end_date,
                                    is_current: (
                                      document.getElementById(
                                        `exp-edit-current-${exp.id}`,
                                      ) as HTMLInputElement
                                    )?.checked,
                                    description: (
                                      document.getElementById(
                                        `exp-edit-desc-${exp.id}`,
                                      ) as HTMLTextAreaElement
                                    )?.value.trim(),
                                  } as any);
                                  setEditingExpId(null);
                                }}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ),
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Education Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              whileHover={{ scale: 1.01 }}
              className='transition-transform duration-300'
            >
              <Card className='product-section-card p-6 hover:border-brand/60 hover:shadow-lg transition-all duration-300'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-lg font-semibold text-foreground flex items-center'>
                    <GraduationCap className='w-5 h-5 mr-2 text-foreground' />
                    Education
                  </h3>
                  <Button
                    size='sm'
                    className='bg-brand text-black hover:bg-brand/90 hover:scale-105 transition-all duration-300'
                    onClick={() => setShowAddEducation((v) => !v)}
                  >
                    <Plus className='w-4 h-4 mr-1' />
                    {showAddEducation ? "Close" : "Add"}
                  </Button>
                </div>
                {showAddEducation && (
                  <div className='mb-4 space-y-2 p-4 bg-foreground/5 rounded-lg'>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                      <input
                        placeholder='Degree'
                        id='edu-degree'
                        className='product-input-surface rounded px-3 py-2 text-sm'
                      />
                      <input
                        placeholder='School'
                        id='edu-school'
                        className='product-input-surface rounded px-3 py-2 text-sm'
                      />
                      <input
                        placeholder='Location'
                        id='edu-location'
                        className='product-input-surface rounded px-3 py-2 text-sm'
                      />
                      <div className='flex gap-2'>
                        <input
                          type='month'
                          placeholder='Start'
                          id='edu-start'
                          className='product-input-surface flex-1 rounded px-3 py-2 text-sm'
                        />
                        <input
                          type='month'
                          placeholder='End'
                          id='edu-end'
                          className='product-input-surface flex-1 rounded px-3 py-2 text-sm'
                        />
                      </div>
                      <input
                        placeholder='GPA'
                        id='edu-gpa'
                        className='product-input-surface rounded px-3 py-2 text-sm'
                      />
                    </div>
                    <div className='flex justify-end gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        className='border-foreground/20 text-foreground hover:bg-foreground/10'
                        onClick={() => setShowAddEducation(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size='sm'
                        className='bg-brand text-black hover:bg-brand/90'
                        onClick={() => {
                          const degree = (
                            document.getElementById(
                              "edu-degree",
                            ) as HTMLInputElement
                          )?.value.trim();
                          const school = (
                            document.getElementById(
                              "edu-school",
                            ) as HTMLInputElement
                          )?.value.trim();
                          if (!degree || !school) return;
                          addEducation({
                            degree,
                            school,
                            location: (
                              document.getElementById(
                                "edu-location",
                              ) as HTMLInputElement
                            )?.value.trim(),
                            start_date: (
                              document.getElementById(
                                "edu-start",
                              ) as HTMLInputElement
                            )?.value
                              ? (
                                  document.getElementById(
                                    "edu-start",
                                  ) as HTMLInputElement
                                ).value + "-01"
                              : new Date().toISOString(),
                            end_date: (
                              document.getElementById(
                                "edu-end",
                              ) as HTMLInputElement
                            )?.value
                              ? (
                                  document.getElementById(
                                    "edu-end",
                                  ) as HTMLInputElement
                                ).value + "-01"
                              : null,
                            gpa:
                              (
                                document.getElementById(
                                  "edu-gpa",
                                ) as HTMLInputElement
                              )?.value.trim() || null,
                          });
                          setShowAddEducation(false);
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                )}
                <div className='space-y-4'>
                  {education.loading && (
                    <div className='space-y-4'>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className='border-l-2 border-brand pl-4 pb-4 relative p-3 rounded-r-lg'
                        >
                          <Skeleton className='absolute -left-2 top-3 w-4 h-4 rounded-full' />
                          <div className='space-y-2'>
                            <Skeleton className='h-4 w-52' />
                            <Skeleton className='h-3 w-40' />
                            <Skeleton className='h-3 w-28' />
                            <Skeleton className='h-3 w-24' />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!education.loading && education.error && (
                    <p className='text-sm text-brand'>{education.error}</p>
                  )}
                  {!education.loading &&
                    !education.error &&
                    education.data.length === 0 && (
                      <EmptyState
                        icon={GraduationCap}
                        title='Add Education'
                        description='Highlight academic credentials, specializations and recognitions that support your expertise.'
                        primaryAction={{
                          label: "Add Education",
                          onClick: () => setShowAddEducation(true),
                        }}
                        secondaryChips={["Degree", "School", "GPA", "Honors"]}
                        tone='warning'
                      />
                    )}
                  {education.data.map(
                    (edu: TProfileEducation, index: number) => (
                      <motion.div
                        key={edu.id}
                        className='border-l-2 border-brand pl-4 pb-4 relative hover:bg-foreground/5 p-3 rounded-r-lg transition-all duration-300'
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ x: 4 }}
                      >
                        <div className='absolute -left-2 top-3 w-4 h-4 bg-brand rounded-full'></div>
                        <div className='flex items-start justify-between'>
                          <div className='flex-1'>
                            <h4 className='text-foreground font-semibold'>
                              {edu.degree}
                            </h4>
                            <p className='text-foreground font-medium'>
                              {edu.school}
                            </p>
                            <p className='product-helper-text text-sm flex items-center'>
                              <MapPin className='w-3 h-3 mr-1' />
                              {edu.location}
                            </p>
                            <p className='product-helper-text text-sm flex items-center mt-1'>
                              <Calendar className='w-3 h-3 mr-1' />
                              {edu.start_date?.slice(0, 7)} -{" "}
                              {edu.end_date?.slice(0, 7)}
                            </p>
                            {edu.gpa && (
                              <p className='product-helper-text text-sm mt-1'>
                                GPA: {edu.gpa}
                              </p>
                            )}
                          </div>
                          <div className='flex space-x-1 ml-4'>
                            {editingEduId === edu.id ? null : (
                              <Button
                                size='sm'
                                variant='ghost'
                                className='product-helper-text hover:text-foreground hover:scale-110 transition-all duration-300 p-1'
                                onClick={() => setEditingEduId(edu.id)}
                              >
                                <Edit className='w-3 h-3' />
                              </Button>
                            )}
                            <Button
                              size='sm'
                              variant='ghost'
                              className='product-helper-text hover:text-brand hover:scale-110 transition-all duration-300 p-1'
                              onClick={() => deleteEducation(edu.id)}
                            >
                              <Trash2 className='w-3 h-3' />
                            </Button>
                          </div>
                        </div>
                        {editingEduId === edu.id && (
                          <div className='mt-3 p-3 bg-foreground/5 rounded-lg space-y-2'>
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                              <input
                                defaultValue={edu.degree}
                                id={`edu-edit-degree-${edu.id}`}
                                placeholder='Degree'
                                className='product-input-surface rounded px-3 py-2 text-sm'
                              />
                              <input
                                defaultValue={edu.school}
                                id={`edu-edit-school-${edu.id}`}
                                placeholder='School'
                                className='product-input-surface rounded px-3 py-2 text-sm'
                              />
                              <input
                                defaultValue={edu.location}
                                id={`edu-edit-location-${edu.id}`}
                                placeholder='Location'
                                className='product-input-surface rounded px-3 py-2 text-sm'
                              />
                              <div className='flex gap-2'>
                                <input
                                  type='month'
                                  defaultValue={(edu.start_date || "").slice(
                                    0,
                                    7,
                                  )}
                                  id={`edu-edit-start-${edu.id}`}
                                  className='product-input-surface flex-1 rounded px-3 py-2 text-sm'
                                />
                                <input
                                  type='month'
                                  defaultValue={
                                    edu.end_date ? edu.end_date.slice(0, 7) : ""
                                  }
                                  id={`edu-edit-end-${edu.id}`}
                                  className='product-input-surface flex-1 rounded px-3 py-2 text-sm'
                                />
                              </div>
                              <input
                                defaultValue={edu.gpa || ""}
                                id={`edu-edit-gpa-${edu.id}`}
                                placeholder='GPA'
                                className='product-input-surface rounded px-3 py-2 text-sm'
                              />
                            </div>
                            <div className='flex justify-end gap-2'>
                              <Button
                                size='sm'
                                variant='outline'
                                className='border-foreground/20 text-foreground hover:bg-foreground/10'
                                onClick={() => setEditingEduId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size='sm'
                                className='bg-brand text-black hover:bg-brand/90'
                                onClick={async () => {
                                  await updateEducation(edu.id, {
                                    degree: (
                                      document.getElementById(
                                        `edu-edit-degree-${edu.id}`,
                                      ) as HTMLInputElement
                                    )?.value.trim(),
                                    school: (
                                      document.getElementById(
                                        `edu-edit-school-${edu.id}`,
                                      ) as HTMLInputElement
                                    )?.value.trim(),
                                    location: (
                                      document.getElementById(
                                        `edu-edit-location-${edu.id}`,
                                      ) as HTMLInputElement
                                    )?.value.trim(),
                                    start_date: (
                                      document.getElementById(
                                        `edu-edit-start-${edu.id}`,
                                      ) as HTMLInputElement
                                    )?.value
                                      ? (
                                          document.getElementById(
                                            `edu-edit-start-${edu.id}`,
                                          ) as HTMLInputElement
                                        ).value + "-01"
                                      : edu.start_date,
                                    end_date: (
                                      document.getElementById(
                                        `edu-edit-end-${edu.id}`,
                                      ) as HTMLInputElement
                                    )?.value
                                      ? (
                                          document.getElementById(
                                            `edu-edit-end-${edu.id}`,
                                          ) as HTMLInputElement
                                        ).value + "-01"
                                      : edu.end_date,
                                    gpa:
                                      (
                                        document.getElementById(
                                          `edu-edit-gpa-${edu.id}`,
                                        ) as HTMLInputElement
                                      )?.value.trim() || null,
                                  } as any);
                                  setEditingEduId(null);
                                }}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ),
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Skills Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              whileHover={{ scale: 1.01 }}
              className='transition-transform duration-300'
            >
              <Card className='product-section-card p-6 hover:border-brand/60 hover:shadow-lg transition-all duration-300'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-lg font-semibold text-foreground flex items-center'>
                    <Award className='w-5 h-5 mr-2 text-foreground' />
                    Skills
                  </h3>
                  <Button
                    size='sm'
                    className='bg-brand text-black hover:bg-brand/90 hover:scale-105 transition-all duration-300'
                    onClick={() => setShowAddSkill((v) => !v)}
                  >
                    <Plus className='w-4 h-4 mr-1' />
                    {showAddSkill ? "Close" : "Add"}
                  </Button>
                </div>
                {showAddSkill && (
                  <div className='mb-4 space-y-2 p-4 bg-foreground/5 rounded-lg'>
                    <div className='grid grid-cols-1 md:grid-cols-4 gap-2'>
                      <input
                        placeholder='Name'
                        id='skill-name'
                        className='product-input-surface rounded px-3 py-2 text-sm md:col-span-2'
                      />
                      <select
                        id='skill-level'
                        className='product-input-surface rounded px-3 py-2 text-sm md:col-span-1'
                      >
                        <option value=''>Level</option>
                        <option value='Beginner'>Beginner</option>
                        <option value='Intermediate'>Intermediate</option>
                        <option value='Advanced'>Advanced</option>
                        <option value='Expert'>Expert</option>
                      </select>
                      <input
                        placeholder='Category'
                        id='skill-category'
                        className='product-input-surface rounded px-3 py-2 text-sm md:col-span-1'
                      />
                    </div>
                    <div className='flex justify-end gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        className='border-foreground/20 text-foreground hover:bg-foreground/10'
                        onClick={() => setShowAddSkill(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size='sm'
                        className='bg-brand text-black hover:bg-brand/90'
                        onClick={() => {
                          const name = (
                            document.getElementById(
                              "skill-name",
                            ) as HTMLInputElement
                          )?.value.trim();
                          if (!name) return;
                          addSkill({
                            name,
                            level:
                              ((
                                document.getElementById(
                                  "skill-level",
                                ) as HTMLSelectElement
                              )?.value as any) || null,
                            category: (
                              document.getElementById(
                                "skill-category",
                              ) as HTMLInputElement
                            )?.value.trim(),
                          });
                          setShowAddSkill(false);
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                )}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  {skills.loading && (
                    <>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className='space-y-2 p-3 bg-foreground/5 rounded-lg col-span-1 md:col-span-1'
                        >
                          <Skeleton className='h-4 w-32' />
                          <Skeleton className='h-2 w-full' />
                          <Skeleton className='h-3 w-20' />
                        </div>
                      ))}
                    </>
                  )}
                  {!skills.loading && skills.error && (
                    <p className='text-sm text-brand col-span-full'>
                      {skills.error}
                    </p>
                  )}
                  {!skills.loading &&
                    !skills.error &&
                    skills.data.length === 0 && (
                      <div className='col-span-full'>
                        <EmptyState
                          icon={Award}
                          title='Show Your Skill Stack'
                          description='Add technical and soft skills. Choose realistic proficiency levels for credibility.'
                          primaryAction={{
                            label: "Add Skill",
                            onClick: () => setShowAddSkill(true),
                          }}
                          secondaryChips={[
                            "React",
                            "TypeScript",
                            "DB Design",
                            "Leadership",
                            "Problem Solving",
                          ]}
                          tone='success'
                        />
                      </div>
                    )}
                  {skills.data.map((skill: TProfileSkill, index: number) => (
                    <motion.div
                      key={skill.id}
                      className='space-y-2 p-3 bg-foreground/5 rounded-lg hover:bg-foreground/10 transition-all duration-300'
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className='flex items-center justify-between'>
                        {editingSkillId === skill.id ? (
                          <div className='w-full grid grid-cols-1 md:grid-cols-4 gap-2'>
                            <input
                              defaultValue={skill.name}
                              id={`skill-edit-name-${skill.id}`}
                              placeholder='Name'
                              className='product-input-surface rounded px-2 py-1 text-xs md:col-span-2'
                            />
                            <select
                              defaultValue={skill.level || ""}
                              id={`skill-edit-level-${skill.id}`}
                              className='product-input-surface rounded px-2 py-1 text-xs md:col-span-1'
                            >
                              <option value=''>Level</option>
                              <option value='Beginner'>Beginner</option>
                              <option value='Intermediate'>Intermediate</option>
                              <option value='Advanced'>Advanced</option>
                              <option value='Expert'>Expert</option>
                            </select>
                            <input
                              defaultValue={skill.category}
                              id={`skill-edit-category-${skill.id}`}
                              placeholder='Category'
                              className='product-input-surface rounded px-2 py-1 text-xs md:col-span-1'
                            />
                          </div>
                        ) : (
                          <>
                            <span className='text-foreground font-medium text-sm'>
                              {skill.name}
                            </span>
                            <div className='flex items-center gap-2'>
                              <span className='product-helper-text text-xs'>
                                {skill.level}
                              </span>
                              <button
                                className='product-helper-text hover:text-foreground transition-colors text-xs'
                                onClick={() => setEditingSkillId(skill.id)}
                                aria-label='Edit skill'
                                title='Edit'
                              >
                                <Edit className='w-3 h-3' />
                              </button>
                              <button
                                className='product-helper-text hover:text-brand transition-colors text-xs'
                                onClick={() => deleteSkill(skill.id)}
                                aria-label='Delete skill'
                                title='Delete'
                              >
                                <Trash2 className='w-3 h-3' />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      {editingSkillId === skill.id ? (
                        <div className='flex justify-end gap-2'>
                          <Button
                            size='sm'
                            variant='outline'
                            className='border-foreground/20 text-foreground hover:bg-foreground/10'
                            onClick={() => setEditingSkillId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size='sm'
                            className='bg-brand text-black hover:bg-brand/90'
                            onClick={async () => {
                              await updateSkill(skill.id, {
                                name: (
                                  document.getElementById(
                                    `skill-edit-name-${skill.id}`,
                                  ) as HTMLInputElement
                                )?.value.trim(),
                                level: ((
                                  document.getElementById(
                                    `skill-edit-level-${skill.id}`,
                                  ) as HTMLSelectElement
                                )?.value || null) as any,
                                category: (
                                  document.getElementById(
                                    `skill-edit-category-${skill.id}`,
                                  ) as HTMLInputElement
                                )?.value.trim(),
                              } as any);
                              setEditingSkillId(null);
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className='w-full bg-foreground/10 rounded-full h-2'>
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${getSkillLevelColor(skill.level || "")} ${getSkillLevelWidth(skill.level || "")}`}
                            ></div>
                          </div>
                          <span className='product-helper-text text-xs'>
                            {skill.category}
                          </span>
                        </>
                      )}
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              whileHover={{ scale: 1.01 }}
              className='transition-transform duration-300'
            >
              <CandidateMemoryEditor
                profile={profile}
                loading={profileLoading}
                onSave={async (patch) => {
                  await updateProfile(patch as any);
                }}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Lightweight About editor component (inline to keep file scoped)
function AboutEditor({
  profile,
  onSave,
  onCancel,
}: {
  profile: {
    job_title: string;
    location: string;
    location_scope: "city" | "country" | "global";
    experience_years: number | null;
  };
  onSave: (p: {
    job_title: string;
    location: string | null;
    location_scope: "city" | "country" | "global";
    experience_years: number | null;
  }) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [jobTitle, setJobTitle] = useState(profile.job_title);
  const [location, setLocation] = useState(profile.location || "");
  const [locationScope, setLocationScope] = useState<
    "city" | "country" | "global"
  >(profile.location_scope || "city");
  const [years, setYears] = useState<string>(
    profile.experience_years != null ? String(profile.experience_years) : "",
  );
  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
        <input
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder='Job title'
          className='product-input-surface rounded px-3 py-2 text-sm'
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder='Location (e.g. Enugu, Nigeria)'
          className='product-input-surface rounded px-3 py-2 text-sm'
        />
        <input
          value={years}
          onChange={(e) => setYears(e.target.value)}
          placeholder='Years experience'
          inputMode='numeric'
          className='product-input-surface rounded px-3 py-2 text-sm'
        />
      </div>
      <div>
        <label className='text-xs font-medium text-muted-foreground/70 mb-1.5 block'>
          Job search scope
        </label>
        <div className='inline-flex rounded-lg border border-border/40 bg-background/40 p-0.5'>
          {(["city", "country", "global"] as const).map((scope) => (
            <button
              key={scope}
              type='button'
              onClick={() => setLocationScope(scope)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                locationScope === scope
                  ? "bg-brand/15 text-brand border border-brand/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5 border border-transparent"
              }`}
            >
              {scope === "city"
                ? "City"
                : scope === "country"
                  ? "Country"
                  : "Global"}
            </button>
          ))}
        </div>
        <p className='text-[10px] text-muted-foreground/50 mt-1'>
          {locationScope === "city"
            ? "Search jobs in your exact city"
            : locationScope === "country"
              ? "Search jobs across your country"
              : "Search jobs worldwide & remote"}
        </p>
      </div>
      <div className='flex space-x-2'>
        <Button
          size='sm'
          className='bg-brand text-black hover:bg-brand/90 hover:scale-105 transition-all duration-300'
          onClick={() =>
            onSave({
              job_title: jobTitle.trim(),
              location: location.trim() || null,
              location_scope: locationScope,
              experience_years: years && !isNaN(Number(years)) ? Math.round(Number(years)) : null,
            })
          }
        >
          Save
        </Button>
        <Button
          size='sm'
          variant='outline'
          className='border-foreground/20 text-foreground hover:bg-foreground/10 hover:scale-105 transition-all duration-300'
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default ProfilePage;
