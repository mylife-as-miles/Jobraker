import { useEffect, useState, useMemo } from 'react';
import { Coins, Zap, Crown } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export const CreditDisplay = () => {
  const [credits, setCredits] = useState<number>(0);
  const [subscriptionTier, setSubscriptionTier] = useState<'Free' | 'Pro' | 'Ultimate'>('Free');
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const navigate = useNavigate();

  // Fetch credits and subscription tier
  useEffect(() => {
    const fetchCreditsAndTier = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) {
          setLoading(false);
          return;
        }

        // Fetch credits
        const { data: creditsData } = await supabase
          .from('user_credits')
          .select('balance')
          .eq('user_id', userId)
          .single();

        if (creditsData) {
          setCredits(creditsData.balance);
        }

        // Fetch subscription tier
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('subscription_plans(name)')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const planName = (subscription as any)?.subscription_plans?.name;
        if (planName) {
          setSubscriptionTier(planName as 'Free' | 'Pro' | 'Ultimate');
        } else {
          // Fallback to profiles table
          const { data: profileData } = await supabase
            .from('profiles')
            .select('subscription_tier')
            .eq('id', userId)
            .single();

          setSubscriptionTier(profileData?.subscription_tier || 'Free');
        }
      } catch (error) {
        console.error('Error fetching credits and tier:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCreditsAndTier();

    // Set up real-time subscription for credits
    const channel = supabase
      .channel('user-credits-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
        },
        (payload) => {
          if (payload.new && typeof (payload.new as any).balance === 'number') {
            setCredits((payload.new as any).balance);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const getTierColor = () => {
    switch (subscriptionTier) {
      case 'Pro':
        return 'from-blue-500 to-blue-600';
      case 'Ultimate':
        return 'from-purple-500 to-purple-600';
      default:
        return 'from-[#1dff00] to-[#0a8246]';
    }
  };

  const getTierIcon = () => {
    switch (subscriptionTier) {
      case 'Pro':
        return <Zap className="w-3 h-3 sm:w-4 sm:h-4" />;
      case 'Ultimate':
        return <Crown className="w-3 h-3 sm:w-4 sm:h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/5 border border-white/10 animate-pulse">
        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/10" />
        <div className="w-12 h-3 sm:h-4 bg-white/10 rounded" />
      </div>
    );
  }

  return (
    <button
      onClick={() => navigate('/dashboard/settings?tab=subscription')}
      className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r ${getTierColor()} hover:opacity-90 transition-all duration-300 hover:scale-105 cursor-pointer border border-white/20`}
      title={`${subscriptionTier} Plan - ${credits} credits remaining. Click to manage subscription.`}
    >
      <Coins className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
      <span className="text-white font-semibold text-xs sm:text-sm whitespace-nowrap">
        {credits.toLocaleString()}
      </span>
      {getTierIcon()}
      <span className="hidden lg:inline text-white/80 text-xs ml-0.5">
        {subscriptionTier}
      </span>
    </button>
  );
};
