import { useEffect, useState, useMemo } from "react";
import { Coins, Zap, Crown } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { CreditService } from "@/services/creditService";

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

        // Fetch credits via CreditService (V2-first)
        const balanceData = await CreditService.getCreditBalance(userId);
        if (balanceData) {
          setCredits(balanceData.balance);
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

    let channels: ReturnType<typeof CreditService.subscribeToCredits> | null = null;
    
    // We set up the channels after getting userId to ensure we only listen to our own changes
    supabase.auth.getUser().then(({ data }) => {
      const currentUserId = data?.user?.id;
      if (currentUserId) {
        channels = CreditService.subscribeToCredits(currentUserId, (updatedCredits) => {
          if (updatedCredits && typeof updatedCredits.balance === "number") {
            setCredits(updatedCredits.balance);
          }
        });
      }
    });

    return () => {
      window.removeEventListener(
        "jobraker:credits-updated",
        handleCreditRefresh,
      );
      window.removeEventListener("focus", handleCreditRefresh);
      if (channels) {
        if (channels.legacyChannel) supabase.removeChannel(channels.legacyChannel);
        if (channels.v2Channel) supabase.removeChannel(channels.v2Channel);
      }
    };
  }, [supabase]);

  const tierClasses: Record<string, string> = {
    Free: "bg-foreground/10 border-foreground/15 text-foreground",
    Basics: "bg-brand/15 border-brand/30 text-brand",
    Pro: "bg-blue-500/15 border-blue-500/30 text-blue-400",
    Ultimate: "bg-purple-500/15 border-purple-500/30 text-purple-400",
  };

  const tierIconClasses: Record<string, string> = {
    Free: "text-muted-foreground",
    Basics: "text-brand",
    Pro: "text-blue-400",
    Ultimate: "text-purple-400",
  };

  const getTierIcon = () => {
    switch (subscriptionTier) {
      case "Basics":
        return <Zap className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${tierIconClasses[subscriptionTier]}`} />;
      case "Pro":
        return <Zap className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${tierIconClasses[subscriptionTier]}`} />;
      case "Ultimate":
        return <Crown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${tierIconClasses[subscriptionTier]}`} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className='flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-foreground/5 border border-foreground/10 animate-pulse'>
        <div className='w-4 h-4 rounded-full bg-foreground/10' />
        <div className='w-10 h-3 bg-foreground/10 rounded' />
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        if (credits <= 0) {
          window.dispatchEvent(
            new CustomEvent("jobraker:open-out-of-credits", {
              detail: { threshold: 300 },
            }),
          );
        } else {
          navigate("/dashboard/billing");
        }
      }}
      className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border backdrop-blur-sm hover:brightness-125 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] cursor-pointer ${tierClasses[subscriptionTier] || tierClasses.Free}`}
      title={`${subscriptionTier} Plan - ${credits} credits remaining. Click to manage billing & auto-refill.`}
    >
      <Coins className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${tierIconClasses[subscriptionTier] || tierIconClasses.Free}`} />
      <span className='font-bold text-xs sm:text-sm whitespace-nowrap'>
        {credits.toLocaleString()}
      </span>
      {getTierIcon()}
      <span className='hidden lg:inline text-[10px] font-bold uppercase tracking-wider opacity-80'>
        {subscriptionTier}
      </span>
    </button>
  );
};
