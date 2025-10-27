import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabaseClient';
import { Coins, Crown, Zap, ArrowRight, Calendar, CreditCard, History, TrendingUp, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

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

export const BillingPage = () => {
  const [currentCredits, setCurrentCredits] = useState(0);
  const [subscriptionTier, setSubscriptionTier] = useState<'Free' | 'Pro' | 'Ultimate'>('Free');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
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
        .limit(10);

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
        return <Zap className="w-5 h-5 text-blue-500" />;
      case 'Ultimate':
        return <Crown className="w-5 h-5 text-purple-500" />;
      default:
        return <Coins className="w-5 h-5 text-[#1dff00]" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Pro':
        return 'from-blue-500 to-blue-600';
      case 'Ultimate':
        return 'from-purple-500 to-purple-600';
      default:
        return 'from-[#1dff00] to-[#0a8246]';
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'bonus':
        return <Sparkles className="w-4 h-4 text-yellow-500" />;
      case 'refill':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'spend':
        return <ArrowRight className="w-4 h-4 text-red-500" />;
      default:
        return <Coins className="w-4 h-4 text-gray-500" />;
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
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Billing & Credits</h1>
          <p className="text-gray-400 mt-1">Manage your subscription and track credit usage</p>
        </div>
      </div>

      {/* Current Plan & Credits Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Current Credits */}
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#1dff00]" />
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white mb-2">
              {currentCredits.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400">Credits available</p>
          </CardContent>
        </Card>

        {/* Current Plan */}
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {getTierIcon(subscriptionTier)}
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-2">
              {subscriptionTier}
            </div>
            <p className="text-sm text-gray-400">
              {plans.find(p => p.name === subscriptionTier)?.credits_per_month || 0} credits/month
            </p>
          </CardContent>
        </Card>

        {/* Next Billing */}
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              Next Refill
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-white mb-2">
              {currentPeriodEnd ? formatDate(currentPeriodEnd) : 'Not available'}
            </div>
            <p className="text-sm text-gray-400">Monthly credit allocation</p>
          </CardContent>
        </Card>
      </div>

      {/* Available Plans */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-[#1dff00]" />
          Available Plans
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`relative overflow-hidden border ${
                plan.name === subscriptionTier 
                  ? 'border-[#1dff00] bg-gradient-to-br from-[#1dff00]/10 to-transparent' 
                  : 'border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02]'
              }`}>
                {plan.name === subscriptionTier && (
                  <div className="absolute top-3 right-3 bg-[#1dff00] text-black text-xs font-bold px-2 py-1 rounded-full">
                    CURRENT
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      {getTierIcon(plan.name)}
                      {plan.name}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-gray-400 mt-2">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold text-white">
                      ${plan.price}
                      {plan.price > 0 && <span className="text-lg text-gray-400">/mo</span>}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      {plan.credits_per_month.toLocaleString()} credits/month
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    {plan.features && plan.features.map((feature: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                        <div className="w-1 h-1 rounded-full bg-[#1dff00] mt-2 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    className={`w-full bg-gradient-to-r ${getTierColor(plan.name)} text-${plan.name === 'Free' ? 'black' : 'white'} hover:opacity-90 transition-all duration-300`}
                    disabled={plan.name === subscriptionTier}
                  >
                    {plan.name === subscriptionTier ? 'Current Plan' : `Upgrade to ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-[#1dff00]" />
          Recent Transactions
        </h2>
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10">
          <CardContent className="p-0">
            <div className="divide-y divide-white/10">
              {transactions.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  No transactions yet
                </div>
              ) : (
                transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="p-4 hover:bg-white/5 transition-colors duration-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {getTransactionIcon(transaction.transaction_type)}
                      <div>
                        <p className="text-white font-medium">{transaction.description}</p>
                        <p className="text-sm text-gray-400">{formatDate(transaction.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        transaction.amount > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                      </p>
                      <p className="text-sm text-gray-400">
                        Balance: {transaction.balance_after}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
