import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabaseClient';
import { 
  Coins, Crown, Zap, ArrowRight, Calendar, History, TrendingUp, 
  Sparkles, Package, Check, Star, Flame, ArrowUpRight, Download,
  Shield, Infinity, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

export const BillingPage = () => {
  const [currentCredits, setCurrentCredits] = useState(0);
  const [subscriptionTier, setSubscriptionTier] = useState<'Free' | 'Pro' | 'Ultimate'>('Free');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'subscription' | 'packs' | 'history'>('subscription');
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;

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

      if (plansData) {
        setPlans(plansData);
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
    } finally {
      setLoading(false);
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Pro':
        return <Zap className="w-5 h-5" />;
      case 'Ultimate':
        return <Crown className="w-5 h-5" />;
      default:
        return <Coins className="w-5 h-5" />;
    }
  };

  const getTierGradient = (tier: string) => {
    switch (tier) {
      case 'Pro':
        return 'from-blue-500 via-blue-600 to-blue-700';
      case 'Ultimate':
        return 'from-purple-500 via-purple-600 to-purple-700';
      default:
        return 'from-[#1dff00] via-[#0fc74f] to-[#0a8246]';
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'bonus':
        return { icon: <Sparkles className="w-4 h-4" />, color: 'text-yellow-400 bg-yellow-400/10' };
      case 'refill':
        return { icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-400 bg-green-400/10' };
      case 'spend':
        return { icon: <ArrowUpRight className="w-4 h-4" />, color: 'text-red-400 bg-red-400/10' };
      default:
        return { icon: <Coins className="w-4 h-4" />, color: 'text-gray-400 bg-gray-400/10' };
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
      <div className="min-h-screen bg-black p-6 space-y-6">
        <div className="h-8 w-48 bg-white/10 rounded-lg animate-pulse" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-black via-[#0a0a0a] to-black">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#1dff00]/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
              Billing & Credits
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Manage your subscription, purchase credit packs, and track your usage
            </p>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:gap-6 md:grid-cols-3 mb-8">
            {/* Current Balance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="relative overflow-hidden border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1dff00]/5 to-transparent" />
                <CardContent className="relative p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-[#1dff00]/10 border border-[#1dff00]/20">
                      <Coins className="w-6 h-6 text-[#1dff00]" />
                    </div>
                    <span className="text-xs font-semibold text-[#1dff00] bg-[#1dff00]/10 px-2 py-1 rounded-full">
                      BALANCE
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400">Current Credits</p>
                    <p className="text-4xl font-bold text-white">
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
              <Card className="relative overflow-hidden border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent">
                <div className={`absolute inset-0 bg-gradient-to-br ${getTierGradient(subscriptionTier)}/5`} />
                <CardContent className="relative p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${getTierGradient(subscriptionTier)}/10 border border-white/10`}>
                      {getTierIcon(subscriptionTier)}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      subscriptionTier === 'Pro' ? 'bg-blue-500/20 text-blue-300' :
                      subscriptionTier === 'Ultimate' ? 'bg-purple-500/20 text-purple-300' :
                      'bg-[#1dff00]/20 text-[#1dff00]'
                    }`}>
                      {subscriptionTier.toUpperCase()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400">Active Plan</p>
                    <p className="text-4xl font-bold text-white">
                      {subscriptionTier}
                    </p>
                    <p className="text-sm text-gray-400">
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
              <Card className="relative overflow-hidden border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
                <CardContent className="relative p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <Calendar className="w-6 h-6 text-blue-400" />
                    </div>
                    <span className="text-xs font-semibold text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full">
                      REFILL
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400">Next Credit Refill</p>
                    <p className="text-lg font-semibold text-white">
                      {currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not scheduled'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 mb-8 border-b border-white/10">
          {[
            { id: 'subscription', label: 'Subscription Plans', icon: <Star className="w-4 h-4" /> },
            { id: 'packs', label: 'Credit Packs', icon: <Package className="w-4 h-4" /> },
            { id: 'history', label: 'Transaction History', icon: <History className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all duration-200 border-b-2 ${
                activeTab === tab.id
                  ? 'text-[#1dff00] border-[#1dff00]'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Subscription Plans Tab */}
          {activeTab === 'subscription' && (
            <motion.div
              key="subscription"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="grid gap-6 lg:grid-cols-3">
                {plans.map((plan, index) => {
                  const isCurrentPlan = plan.name === subscriptionTier;
                  const isUltimate = plan.name === 'Ultimate';
                  
                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative"
                    >
                      {isUltimate && (
                        <div className="absolute -top-4 left-0 right-0 flex justify-center z-10">
                          <span className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                            <Flame className="w-3 h-3" />
                            MOST POPULAR
                          </span>
                        </div>
                      )}
                      
                      <Card className={`relative overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
                        isCurrentPlan 
                          ? 'border-[#1dff00] bg-gradient-to-br from-[#1dff00]/10 via-transparent to-transparent shadow-[0_0_50px_rgba(29,255,0,0.15)]' 
                          : isUltimate
                          ? 'border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent'
                          : 'border-white/10 bg-gradient-to-br from-white/5 to-transparent'
                      }`}>
                        {/* Glow effect */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${getTierGradient(plan.name)}/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                        
                        {isCurrentPlan && (
                          <div className="absolute top-4 right-4 z-10">
                            <span className="bg-[#1dff00] text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              ACTIVE
                            </span>
                          </div>
                        )}

                        <CardContent className="relative p-8 space-y-6">
                          {/* Header */}
                          <div className="space-y-4">
                            <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${getTierGradient(plan.name)}/10 border border-white/10`}>
                              {getTierIcon(plan.name)}
                            </div>
                            <div>
                              <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                              <p className="text-sm text-gray-400">{plan.description}</p>
                            </div>
                          </div>

                          {/* Pricing */}
                          <div className="py-4">
                            <div className="flex items-baseline gap-2">
                              <span className="text-5xl font-bold text-white">
                                ${plan.price}
                              </span>
                              {plan.price > 0 && (
                                <span className="text-lg text-gray-400">/month</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400 mt-2">
                              {plan.credits_per_month.toLocaleString()} credits per month
                            </p>
                          </div>

                          {/* Features */}
                          <div className="space-y-3 py-4">
                            {plan.features && Array.isArray(plan.features) && plan.features.map((feature: any, idx: number) => {
                              // Handle both old string format and new object format
                              const featureName = typeof feature === 'string' ? feature : feature.name;
                              const featureValue = typeof feature === 'object' ? feature.value : null;
                              const isIncluded = typeof feature === 'object' ? feature.included !== false : true;
                              
                              if (!isIncluded) return null;
                              
                              return (
                                <div key={idx} className="flex items-start gap-3">
                                  <div className={`mt-1 p-0.5 rounded-full bg-gradient-to-br ${getTierGradient(plan.name)}`}>
                                    <Check className="w-3 h-3 text-black" />
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-sm text-gray-300">
                                      {featureName}
                                      {featureValue && <span className="text-gray-400 ml-1">• {featureValue}</span>}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* CTA */}
                          <Button
                            className={`w-full h-12 font-semibold text-base transition-all duration-300 ${
                              isCurrentPlan
                                ? 'bg-white/10 text-white cursor-default'
                                : plan.name === 'Free'
                                ? 'bg-gradient-to-r from-[#1dff00] via-[#0fc74f] to-[#0a8246] text-black hover:opacity-90 hover:scale-105 shadow-lg'
                                : plan.name === 'Pro'
                                ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 text-white hover:opacity-90 hover:scale-105 shadow-lg'
                                : 'bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white hover:opacity-90 hover:scale-105 shadow-lg'
                            }`}
                            disabled={isCurrentPlan}
                          >
                            {isCurrentPlan ? 'Current Plan' : `Upgrade to ${plan.name}`}
                            {!isCurrentPlan && <ArrowRight className="ml-2 w-4 h-4" />}
                          </Button>
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
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">One-Time Credit Packs</h2>
                <p className="text-gray-300">Purchase additional credits anytime to boost your balance</p>
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
                        <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-black text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                          BEST VALUE
                        </span>
                      </div>
                    )}

                    <Card className={`relative overflow-hidden transition-all duration-300 hover:scale-105 ${
                      pack.popular
                        ? 'border-[#1dff00]/50 bg-gradient-to-br from-[#1dff00]/10 to-transparent shadow-[0_0_30px_rgba(29,255,0,0.1)]'
                        : 'border-white/10 bg-gradient-to-br from-white/5 to-transparent'
                    }`}>
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="p-2 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/20">
                            <Package className="w-5 h-5 text-[#1dff00]" />
                          </div>
                          {pack.bonus > 0 && (
                            <span className="text-xs font-semibold text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              +{pack.bonus} BONUS
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="text-4xl font-bold text-white mb-1">
                            {(pack.credits + pack.bonus).toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-300">
                            {pack.credits.toLocaleString()} credits
                            {pack.bonus > 0 && ` + ${pack.bonus} bonus`}
                          </p>
                        </div>

                        <div className="pt-2">
                          <p className="text-3xl font-bold text-white mb-1">${pack.price}</p>
                          <p className="text-xs text-gray-400">
                            ${(pack.price / (pack.credits + pack.bonus)).toFixed(3)} per credit
                          </p>
                        </div>

                        <Button
                          className={`w-full bg-gradient-to-r ${
                            pack.popular
                              ? 'from-[#1dff00] to-[#0a8246] text-black'
                              : 'from-white/10 to-white/5 text-white'
                          } hover:opacity-90 transition-all duration-300`}
                        >
                          Purchase
                          <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Benefits Section */}
              <div className="grid gap-4 sm:grid-cols-3 mt-12 pt-8 border-t border-white/10">
                {[
                  { icon: <Shield className="w-5 h-5" />, title: 'Secure Payment', desc: 'SSL encrypted checkout' },
                  { icon: <Infinity className="w-5 h-5" />, title: 'Never Expire', desc: 'Credits last forever' },
                  { icon: <Target className="w-5 h-5" />, title: 'Instant Delivery', desc: 'Credits added immediately' },
                ].map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="p-2 rounded-lg bg-[#1dff00]/10 text-[#1dff00]">
                      {benefit.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm mb-1">{benefit.title}</p>
                      <p className="text-xs text-gray-300">{benefit.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Transaction History Tab */}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Card className="border-white/10 bg-gradient-to-br from-white/5 to-transparent overflow-hidden">
                <CardHeader className="border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <History className="w-5 h-5 text-[#1dff00]" />
                      Transaction History
                    </CardTitle>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" />
                      Export
                    </Button>
                  </div>
                  <CardDescription className="text-gray-400">
                    View all your credit transactions and usage history
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="p-4 rounded-2xl bg-white/5 mb-4">
                        <History className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-300 text-lg mb-2">No transactions yet</p>
                      <p className="text-gray-400 text-sm">Your credit activity will appear here</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {transactions.map((transaction, index) => {
                        const iconData = getTransactionIcon(transaction.transaction_type);
                        return (
                          <motion.div
                            key={transaction.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="p-4 hover:bg-white/5 transition-colors duration-200 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className={`p-2 rounded-lg ${iconData.color}`}>
                                {iconData.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">{transaction.description}</p>
                                <p className="text-sm text-gray-400">{formatDate(transaction.created_at)}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`text-lg font-semibold ${
                                transaction.amount > 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                              </p>
                              <p className="text-xs text-gray-400">
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
