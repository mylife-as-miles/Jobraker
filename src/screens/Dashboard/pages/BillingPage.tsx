import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabaseClient';
import {
  Coins, Crown, Zap, ArrowRight, Calendar, History, TrendingUp,
  Sparkles, Package, Check, Star, ArrowUpRight, Download,
  Shield, Infinity, Target, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/toast';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  credits_per_month: number;
  description: string;
  features: string[];
}

interface CreditTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

interface CreditPack {
  credits: number;
  price: number;
  bonus: number;
  popular?: boolean;
}

const creditPacks: CreditPack[] = [
  { credits: 100, price: 9, bonus: 0 },
  { credits: 500, price: 39, bonus: 50, popular: true },
  { credits: 1000, price: 69, bonus: 150 },
  { credits: 2500, price: 149, bonus: 500 },
];

const defaultPlans: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    credits_per_month: 10,
    description: 'Perfect for trying out JobRaker',
    features: ['10 AI Job Applications/mo', 'Basic Resume Parsing', 'Standard Support']
  },
  {
    id: 'basics',
    name: 'Basics',
    price: 19,
    credits_per_month: 100,
    description: 'For active job seekers',
    features: ['100 AI Job Applications/mo', 'Advanced Resume Optimization', 'Priority Queue']
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    credits_per_month: 500,
    description: 'Power through your job search',
    features: ['500 AI Job Applications/mo', 'Cover Letter Generation', 'LinkedIn Optimization', '24/7 Priority Support']
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    price: 99,
    credits_per_month: 2000,
    description: 'Maximum automation & reach',
    features: ['2000 AI Job Applications/mo', 'Personal Career Agent', 'Interview Prep AI', 'Dedicated Account Manager']
  }
];

export const BillingPage = () => {
  const [currentCredits, setCurrentCredits] = useState(0);
  const [subscriptionTier, setSubscriptionTier] = useState<'Free' | 'Basics' | 'Pro' | 'Ultimate'>('Free');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'subscription' | 'packs' | 'history'>('subscription');
  const [processingPayment, setProcessingPayment] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const { notify } = useToast();

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      // If no user (e.g. preview mode), populate with defaults
      if (!userId) {
        setPlans(defaultPlans);
        setTransactions([
          { id: '1', transaction_type: 'bonus', amount: 50, balance_after: 50, description: 'Welcome Bonus', created_at: new Date().toISOString() }
        ]);
        return;
      }

      // Fetch current credits
      const { data: creditsData } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (creditsData) {
        setCurrentCredits(creditsData.balance);
      }

      // Fetch subscription
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('subscription_plans(name, credits_per_month), current_period_end')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (subscription) {
        const planName = (subscription as any)?.subscription_plans?.name;
        setSubscriptionTier(planName || 'Free');
        setCurrentPeriodEnd((subscription as any).current_period_end);
      }

      // Fetch all subscription plans
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (plansData && plansData.length > 0) {
        setPlans(plansData);
      } else {
        setPlans(defaultPlans);
      }

      // Fetch recent transactions
      const { data: transactionsData } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (transactionsData) {
        setTransactions(transactionsData);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      // Fallback to defaults on error
      setPlans(defaultPlans);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (type: 'subscription' | 'credit_pack', item: any) => {
    try {
      setProcessingPayment(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        notify({
          title: "Authentication Required",
          description: "Please sign in to make a purchase.",
          variant: "error"
        });
        return;
      }

      // Prepare payload
      const payload = {
        planType: type,
        amount: item.price,
        metadata: type === 'credit_pack'
          ? { credits: item.credits, bonus: item.bonus }
          : { plan_id: item.id, credits_per_month: item.credits_per_month }
      };

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('init-payment', {
        body: payload
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No payment URL returned");
      }

    } catch (error: any) {
      console.error('Payment initialization failed:', error);
      notify({
        title: "Payment Error",
        description: error.message || "Failed to initialize payment. Please try again.",
        variant: "error"
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Pro':
        return <Zap className="w-5 h-5 text-blue-400" />;
      case 'Ultimate':
        return <Crown className="w-5 h-5 text-purple-400" />;
      default:
        return <Coins className="w-5 h-5 text-[#1dff00]" />;
    }
  };

  const getTierGradient = (tier: string) => {
    switch (tier) {
      case 'Pro':
        return 'from-blue-500 via-blue-600 to-blue-700';
      case 'Ultimate':
        return 'from-purple-500 via-purple-600 to-purple-700';
      default:
        return 'from-[#1dff00] via-background to-background';
    }
  };

  const getTierTextColor = (_tier: string) => {
    return {
      primary: 'text-foreground',
      secondary: 'text-foreground/70',
      tertiary: 'text-foreground/80',
      muted: 'text-foreground/50'
    };
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'bonus':
        return { icon: <Sparkles className="w-4 h-4" />, color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' };
      case 'refill':
        return { icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-400 bg-green-400/10 border-green-400/20' };
      case 'spend':
        return { icon: <ArrowUpRight className="w-4 h-4" />, color: 'text-red-400 bg-red-400/10 border-red-400/20' };
      default:
        return { icon: <Coins className="w-4 h-4" />, color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background selection:bg-brand/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-foreground/10 bg-gradient-to-br from-background via-background to-black">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#1dff00]/5 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }} />
          {/* Grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1dff0005_1px,transparent_1px),linear-gradient(to_bottom,#1dff0005_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-foreground via-foreground to-white/60 bg-clip-text text-transparent">
                Billing &
              </span>{' '}
              <span className="text-[#1dff00] drop-shadow-[0_0_15px_rgba(29,255,0,0.3)]">
                Credits
              </span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Supercharge your job search with AI credits. Choose a plan that fits your ambition or top up anytime.
            </p>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
            {/* Current Balance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="relative overflow-hidden border-foreground/10 bg-background/[0.03] backdrop-blur-xl group hover:border-[#1dff00]/30 transition-colors duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1dff00]/5 to-transparent opacity-50" />
                <CardContent className="relative p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-[#1dff00]/10 border border-[#1dff00]/20 group-hover:bg-[#1dff00]/20 transition-colors">
                      <Coins className="w-6 h-6 text-[#1dff00]" />
                    </div>
                    <span className="text-[10px] tracking-wider font-bold text-[#1dff00] bg-[#1dff00]/10 px-2.5 py-1 rounded-full border border-[#1dff00]/20">
                      BALANCE
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400 font-medium">Available Credits</p>
                    <p className="text-4xl font-bold text-foreground tracking-tight">
                      {currentCredits.toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Current Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="relative overflow-hidden border-foreground/10 bg-background/[0.03] backdrop-blur-xl group hover:border-foreground/20 transition-colors duration-300">
                <div className={`absolute inset-0 bg-gradient-to-br ${getTierGradient(subscriptionTier)} opacity-5`} />
                <CardContent className="relative p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${getTierGradient(subscriptionTier)}/10 border border-foreground/10 group-hover:border-foreground/20 transition-colors`}>
                      {getTierIcon(subscriptionTier)}
                    </div>
                    <span className={`text-[10px] tracking-wider font-bold px-2.5 py-1 rounded-full border ${subscriptionTier === 'Pro' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                      subscriptionTier === 'Ultimate' ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' :
                        'bg-[#1dff00]/10 text-[#1dff00] border-[#1dff00]/20'
                      }`}>
                      ACTIVE PLAN
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400 font-medium">Current Tier</p>
                    <p className="text-4xl font-bold text-foreground tracking-tight">
                      {subscriptionTier}
                    </p>
                    <p className="text-sm text-gray-500">
                      {plans.find(p => p.name === subscriptionTier)?.credits_per_month.toLocaleString() || 0} credits/month
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Next Refill */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="relative overflow-hidden border-foreground/10 bg-background/[0.03] backdrop-blur-xl group hover:border-blue-400/30 transition-colors duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-50" />
                <CardContent className="relative p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                      <Calendar className="w-6 h-6 text-blue-400" />
                    </div>
                    <span className="text-[10px] tracking-wider font-bold text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-full border border-blue-400/20">
                      RENEWAL
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400 font-medium">Next Refill</p>
                    <p className="text-lg font-bold text-foreground tracking-tight pt-2">
                      {currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not scheduled'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Automatic renewal
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Custom Tab Navigation */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center p-1 bg-muted/50 rounded-full border border-foreground/10 backdrop-blur-md">
            {[
              { id: 'subscription', label: 'Plans', icon: <Star className="w-4 h-4" /> },
              { id: 'packs', label: 'Credit Packs', icon: <Package className="w-4 h-4" /> },
              { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${activeTab === tab.id
                  ? 'text-black shadow-lg'
                  : 'text-gray-400 hover:text-foreground hover:bg-muted/50'
                  }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-[#1dff00] rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {tab.icon}
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Subscription Plans Tab */}
          {activeTab === 'subscription' && (
            <motion.div
              key="subscription"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid gap-8 lg:grid-cols-3 xl:grid-cols-4">
                {plans.map((plan, index) => {
                  const isCurrentPlan = plan.name === subscriptionTier;
                  const isPro = plan.name === 'Pro';
                  const isUltimate = plan.name === 'Ultimate';

                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative h-full"
                    >
                      {(isPro || isUltimate) && (
                        <div className="absolute -top-3 left-0 right-0 flex justify-center z-20">
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-full shadow-lg border ${isUltimate
                            ? 'bg-purple-500 text-foreground border-purple-400'
                            : 'bg-[#1dff00] text-black border-[#1dff00]'
                            }`}>
                            {isUltimate ? 'MAXIMUM POWER' : 'MOST POPULAR'}
                          </span>
                        </div>
                      )}

                      <Card className={`group relative h-full flex flex-col overflow-hidden transition-all duration-300 ${isCurrentPlan
                        ? 'border-[#1dff00]/50 bg-gradient-to-b from-[#1dff00]/10 to-transparent shadow-[0_0_40px_-10px_rgba(29,255,0,0.2)]'
                        : 'border-foreground/10 bg-background/[0.02] hover:bg-background/[0.04] hover:border-foreground/20 hover:shadow-xl hover:shadow-[#1dff00]/5 hover:-translate-y-1'
                        }`}>
                        {/* Gradient accent top border */}
                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${getTierGradient(plan.name)} opacity-70`} />

                        {isCurrentPlan && (
                          <div className="absolute top-4 right-4 z-10">
                            <span className="px-2.5 py-1 text-[10px] font-bold bg-[#1dff00] text-black border border-[#1dff00] rounded-full flex items-center gap-1 shadow-md">
                              <Check className="w-3 h-3" />
                              CURRENT
                            </span>
                          </div>
                        )}

                        <CardContent className="p-6 flex flex-col h-full">
                          {(() => {
                            const textColors = getTierTextColor(plan.name);
                            return (
                              <>
                                {/* Header */}
                                <div className="mb-6">
                                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br ${plan.name === 'Pro' ? 'from-blue-500/20 to-transparent border-blue-500/20' :
                                    plan.name === 'Ultimate' ? 'from-purple-500/20 to-transparent border-purple-500/20' :
                                      'from-[#1dff00]/20 to-transparent border-[#1dff00]/20'
                                    } border border-foreground/5`}>
                                    {getTierIcon(plan.name)}
                                  </div>
                                  <h3 className={`text-2xl font-bold ${textColors.primary} tracking-tight`}>{plan.name}</h3>
                                  <p className={`text-sm ${textColors.secondary} mt-1 h-10`}>{plan.description}</p>
                                </div>

                                {/* Price */}
                                <div className="mb-6 pb-6 border-b border-foreground/10">
                                  <div className="flex items-baseline gap-1">
                                    <span className={`text-4xl font-bold ${textColors.primary}`}>${plan.price}</span>
                                    {plan.price > 0 && (
                                      <span className={textColors.tertiary}>/mo</span>
                                    )}
                                  </div>
                                </div>

                                {/* Credits */}
                                <div className="flex items-center gap-3 p-3 rounded-xl mb-6 bg-muted/50 border border-foreground/5 group-hover:bg-muted transition-colors">
                                  <div className="p-1.5 rounded-lg bg-muted/40">
                                    <Zap className={`w-4 h-4 ${plan.name === 'Pro' ? 'text-blue-400' :
                                      plan.name === 'Ultimate' ? 'text-purple-400' : 'text-[#1dff00]'
                                      }`} />
                                  </div>
                                  <div>
                                    <span className={`block text-sm font-bold ${textColors.primary}`}>{plan.credits_per_month} credits</span>
                                    <span className={`block text-[10px] uppercase tracking-wider ${textColors.muted}`}>Monthly Refill</span>
                                  </div>
                                </div>

                                {/* Features */}
                                <div className="space-y-3 mb-8 flex-grow">
                                  {plan.features && Array.isArray(plan.features) && plan.features.map((feature: any, idx: number) => {
                                    const featureName = typeof feature === 'string' ? feature : feature.name;
                                    const isIncluded = typeof feature === 'object' ? feature.included !== false : true;

                                    if (!isIncluded) return null;

                                    return (
                                      <div key={idx} className="flex items-start gap-3 group/item">
                                        <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${plan.name === 'Pro' ? 'bg-blue-500/20 text-blue-400' :
                                          plan.name === 'Ultimate' ? 'bg-purple-500/20 text-purple-400' :
                                            'bg-[#1dff00]/20 text-[#1dff00]'
                                          }`}>
                                          <Check className="w-2.5 h-2.5" />
                                        </div>
                                        <span className={`text-sm ${textColors.tertiary} group-hover/item:text-foreground transition-colors`}>{featureName}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            );
                          })()}

                          {/* CTA */}
                          <div className="mt-auto">
                            <Button
                              className={`w-full h-12 font-bold text-sm tracking-wide transition-all duration-300 ${isCurrentPlan
                                ? 'bg-muted/50 text-foreground/50 cursor-default border border-foreground/5'
                                : plan.name === 'Basics'
                                  ? 'bg-[#1dff00] text-black hover:bg-[#1dff00] hover:brightness-110 hover:shadow-[0_0_20px_rgba(29,255,0,0.4)] hover:scale-[1.02]'
                                  : plan.name === 'Pro'
                                    ? 'bg-blue-500 text-foreground hover:bg-blue-600 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:scale-[1.02]'
                                    : plan.name === 'Ultimate'
                                      ? 'bg-purple-600 text-foreground hover:bg-purple-700 hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:scale-[1.02]'
                                      : 'bg-background text-black hover:bg-gray-200'
                                }`}
                              disabled={isCurrentPlan || processingPayment}
                              onClick={() => !isCurrentPlan && handlePayment('subscription', plan)}
                            >
                              {processingPayment && !isCurrentPlan ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : null}
                              {isCurrentPlan ? 'CURRENT PLAN' : `UPGRADE TO ${plan.name.toUpperCase()}`}
                              {!isCurrentPlan && !processingPayment && <ArrowRight className="ml-2 w-4 h-4" />}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Credit Packs Tab */}
          {activeTab === 'packs' && (
            <motion.div
              key="packs"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="space-y-12"
            >
              <div className="text-center">
                <h2 className="text-3xl font-bold text-foreground mb-3">One-Time Credit Packs</h2>
                <p className="text-gray-400">Need a boost? Add credits that never expire.</p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {creditPacks.map((pack, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative"
                  >
                    {pack.popular && (
                      <div className="absolute -top-3 left-0 right-0 flex justify-center z-10">
                        <span className="bg-[#1dff00] text-black text-[10px] font-bold px-3 py-1 rounded-full shadow-lg shadow-[#1dff00]/20">
                          BEST VALUE
                        </span>
                      </div>
                    )}

                    <Card className={`relative overflow-hidden transition-all duration-300 group hover:scale-105 ${pack.popular
                      ? 'border-[#1dff00]/30 bg-gradient-to-b from-[#1dff00]/5 to-transparent'
                      : 'border-foreground/10 bg-background/[0.02] hover:bg-background/[0.04]'
                      }`}>
                      <CardContent className="p-6 flex flex-col items-center text-center">
                        <div className={`p-3 rounded-2xl mb-4 ${pack.popular ? 'bg-[#1dff00]/10 text-[#1dff00]' : 'bg-muted/50 text-gray-400 group-hover:text-foreground group-hover:bg-muted'
                          } transition-colors`}>
                          <Package className="w-8 h-8" />
                        </div>

                        {pack.bonus > 0 && (
                          <span className="mb-2 text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-yellow-400/20">
                            <Sparkles className="w-3 h-3" />
                            +{pack.bonus} BONUS
                          </span>
                        )}

                        <div className="mb-6">
                          <p className="text-4xl font-bold text-foreground mb-1">
                            {(pack.credits + pack.bonus).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Credits</p>
                        </div>

                        <div className="w-full pt-4 border-t border-foreground/5">
                          <p className="text-3xl font-bold text-foreground mb-1">${pack.price}</p>
                          <p className="text-xs text-gray-500 mb-4">
                            ${(pack.price / (pack.credits + pack.bonus)).toFixed(3)} per credit
                          </p>

                          <Button
                            className={`w-full font-bold transition-all duration-300 ${pack.popular
                              ? 'bg-[#1dff00] text-black hover:bg-[#1dff00] hover:brightness-110 shadow-[0_0_20px_rgba(29,255,0,0.3)]'
                              : 'bg-muted text-foreground hover:bg-foreground/20'
                              }`}
                            disabled={processingPayment}
                            onClick={() => handlePayment('credit_pack', pack)}
                          >
                            {processingPayment ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            PURCHASE
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Benefits Section */}
              <div className="grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto pt-8 border-t border-foreground/10">
                {[
                  { icon: <Shield className="w-6 h-6" />, title: 'Secure Payment', desc: 'Encrypted & safe checkout' },
                  { icon: <Infinity className="w-6 h-6" />, title: 'Never Expire', desc: 'Credits last until you use them' },
                  { icon: <Target className="w-6 h-6" />, title: 'Instant Delivery', desc: 'Start applying in seconds' },
                ].map((benefit, idx) => (
                  <div key={idx} className="flex flex-col items-center text-center p-6 rounded-2xl bg-background/[0.02] border border-foreground/5 hover:bg-background/[0.04] transition-colors">
                    <div className="p-3 rounded-full bg-[#1dff00]/10 text-[#1dff00] mb-3">
                      {benefit.icon}
                    </div>
                    <p className="font-bold text-foreground mb-1">{benefit.title}</p>
                    <p className="text-sm text-gray-400">{benefit.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Transaction History Tab */}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-foreground/10 bg-background/[0.02] backdrop-blur-md overflow-hidden">
                <CardHeader className="border-b border-foreground/10 bg-background/[0.02]">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                        Transaction History
                      </CardTitle>
                      <CardDescription className="text-gray-400 mt-1">
                        View all your credit transactions and usage history
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 border-foreground/10 bg-muted/50 hover:bg-muted text-gray-300 hover:text-foreground">
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <div className="p-4 rounded-full bg-muted/50 mb-4 border border-foreground/10">
                        <History className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-foreground font-medium text-lg mb-1">No transactions yet</p>
                      <p className="text-gray-500 text-sm max-w-xs">Your credit purchases and usage will appear here once you start using JobRaker.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {transactions.map((transaction, index) => {
                        const iconData = getTransactionIcon(transaction.transaction_type);
                        return (
                          <motion.div
                            key={transaction.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="p-4 sm:p-6 hover:bg-background/[0.02] transition-colors duration-200 flex items-center justify-between gap-4 group"
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className={`p-2.5 rounded-xl border ${iconData.color} group-hover:scale-110 transition-transform`}>
                                {iconData.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-foreground font-medium truncate mb-0.5">{transaction.description}</p>
                                <p className="text-xs text-gray-500 font-mono">{formatDate(transaction.created_at)}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`text-lg font-bold font-mono ${transaction.amount > 0 ? 'text-[#1dff00]' : 'text-foreground'
                                }`}>
                                {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                              </p>
                              <p className="text-xs text-gray-500">
                                Balance: {transaction.balance_after}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
