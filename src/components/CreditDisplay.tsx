import { useEffect, useState, useMemo } from "react";
import { Coins, Zap, Crown } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export const CreditDisplay = () => {
  const [credits, setCredits] = useState<number>(0);
  const [subscriptionTier, setSubscriptionTier] = useState<
    "Free" | "Basics" | "Pro" | "Ultimate"
  >("Free");
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
        const { data: creditsData, error: creditsError } = await supabase
          .from("user_credits")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle();

        if (creditsError) {
          console.error("CreditDisplay: Failed to fetch credits", creditsError);
        } else if (creditsData) {
          setCredits(creditsData.balance);
        }

        // Fetch subscription tier
        const { data: subscription, error: subError } = await supabase
          .from("user_subscriptions")
          .select("subscription_plans(name)")
          .eq("user_id", userId)
          .eq("status", "active")
          .gt("current_period_end", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subError) {
          console.error(
            "CreditDisplay: Failed to fetch subscription tier",
            subError,
          );
        }

        const planName = (subscription as any)?.subscription_plans?.name;
        if (
          planName &&
          (planName === "Free" ||
            planName === "Basics" ||
            planName === "Pro" ||
            planName === "Ultimate")
        ) {
          setSubscriptionTier(
            planName as "Free" | "Basics" | "Pro" | "Ultimate",
          );
        } else {
          setSubscriptionTier("Free");
        }
      } catch (error) {
        console.error("Error fetching credits and tier:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCreditsAndTier();
    const handleCreditRefresh = () => {
      void fetchCreditsAndTier();
    };

    window.addEventListener("jobraker:credits-updated", handleCreditRefresh);
    window.addEventListener("focus", handleCreditRefresh);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    // We set up the channel after getting userId to ensure we only listen to our own changes
    supabase.auth.getUser().then(({ data }) => {
      const currentUserId = data?.user?.id;
      if (currentUserId) {
        channel = supabase
          .channel("user-credits-changes")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "user_credits",
              filter: `user_id=eq.${currentUserId}`
            },
            (payload) => {
              if (payload.new && typeof (payload.new as any).balance === "number") {
                setCredits((payload.new as any).balance);
              }
            },
          )
          .subscribe();
      }
    });

    return () => {
      window.removeEventListener(
        "jobraker:credits-updated",
        handleCreditRefresh,
      );
      window.removeEventListener("focus", handleCreditRefresh);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  const getTierColor = () => {
    switch (subscriptionTier) {
      case "Basics":
        return "brand";
      case "Pro":
        return "blue-600";
      case "Ultimate":
        return "purple-600";
      default:
        return "brand";
    }
  };

  const getTierIcon = () => {
    switch (subscriptionTier) {
      case "Basics":
        return <Zap className='w-3 h-3 sm:w-4 sm:h-4 text-black' />;
      case "Pro":
        return <Zap className='w-3 h-3 sm:w-4 sm:h-4 text-black' />;
      case "Ultimate":
        return <Crown className='w-3 h-3 sm:w-4 sm:h-4 text-black' />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className='flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-foreground/5 border border-foreground/10 animate-pulse'>
        <div className='w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-foreground/10' />
        <div className='w-12 h-3 sm:h-4 bg-foreground/10 rounded' />
      </div>
    );
  }

  return (
    <button
      onClick={() => navigate("/dashboard/billing")}
      className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-${getTierColor()} hover:opacity-90 transition-all duration-300 hover:scale-105 cursor-pointer dark:text-background text-foreground/80`}
      title={`${subscriptionTier} Plan - ${credits} credits remaining. Click to view billing.`}
    >
      <Coins className='w-4 h-4 sm:w-5 sm:h-5 ' />
      <span className='font-bold text-sm sm:text-base whitespace-nowrap'>
        {credits.toLocaleString()}
      </span>
      {getTierIcon()}
      <span className='hidden lg:inline text-xs font-semibold ml-0.5'>
        {subscriptionTier}
      </span>
    </button>
  );
};
