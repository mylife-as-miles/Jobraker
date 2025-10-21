// Subscription plan cards for displaying and selecting plans
import React, { useEffect, useState } from 'react';
import { SubscriptionService } from '@/services/subscriptionService';
import { SubscriptionPlan, UserSubscription } from '@/types/credits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SubscriptionPlansProps {
  onPlanSelect?: (planId: string) => void;
  showCurrentPlan?: boolean;
}

export const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ 
  onPlanSelect,
  showCurrentPlan = true 
}) => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const [plansData, subscriptionData] = await Promise.all([
        SubscriptionService.getSubscriptionPlans(),
        user?.id ? SubscriptionService.getUserSubscription(user.id) : null
      ]);
      
      setPlans(plansData);
      setCurrentSubscription(subscriptionData);
      setLoading(false);
    };

    fetchData();
  }, [user?.id]);

  const handlePlanSelect = async (planId: string) => {
    if (!user?.id) return;
    
    setSubscribing(planId);
    
    try {
      if (onPlanSelect) {
        onPlanSelect(planId);
      } else {
        // Default behavior - create subscription
        await SubscriptionService.createSubscription(user.id, planId);
        // Refresh current subscription
        const updatedSubscription = await SubscriptionService.getUserSubscription(user.id);
        setCurrentSubscription(updatedSubscription);
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
    } finally {
      setSubscribing(null);
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'job seeker explorer':
        return <Star className="w-5 h-5 text-gray-600" />;
      case 'weekend searcher':
        return <Zap className="w-5 h-5 text-blue-600" />;
      case 'active job seeker':
        return <Crown className="w-5 h-5 text-green-600" />;
      case 'career changer':
        return <Crown className="w-5 h-5 text-orange-600" />;
      case 'aggressive applicant':
        return <Crown className="w-5 h-5 text-purple-600" />;
      case 'professional powerhouse':
        return <Crown className="w-5 h-5 text-red-600" />;
      case 'enterprise unlimited':
        return <Crown className="w-5 h-5 text-black" />;
      case 'custom solutions':
        return <Crown className="w-5 h-5 text-indigo-600" />;
      default:
        return <Star className="w-5 h-5" />;
    }
  };





  const isCurrentPlan = (planId: string) => {
    return currentSubscription?.planId === planId;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Choose Your Subscription Tier
        </h2>
        <p className="text-gray-600">
          Monthly billing • Cancel anytime • More applications = Better value per application
        </p>
      </div>

      {showCurrentPlan && currentSubscription && (
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getPlanIcon(currentSubscription.plan?.name || '')}
                <div>
                  <p className="font-semibold text-green-800">
                    Purchased: {currentSubscription.plan?.name}
                  </p>
                  <p className="text-sm text-green-600">
                    {currentSubscription.plan?.creditsPerCycle} credits purchased
                  </p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800">Owned</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrentPlan={isCurrentPlan(plan.id)}
            isLoading={subscribing === plan.id}
            onSelect={() => handlePlanSelect(plan.id)}
          />
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-2">💡 Subscription Benefits</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>✓ Monthly application allowance resets every billing cycle</li>
          <li>✓ Cancel anytime - no long-term commitments</li>
          <li>✓ Higher tiers offer better value per application</li>
          <li>✓ Instant access to all features upon subscription</li>
          <li>✓ Automatic feature upgrades included</li>
        </ul>
      </div>
    </div>
  );
};

interface PlanCardProps {
  plan: SubscriptionPlan;
  isCurrentPlan: boolean;
  isLoading: boolean;
  onSelect: () => void;
}

const PlanCard: React.FC<PlanCardProps> = ({ 
  plan, 
  isCurrentPlan, 
  isLoading, 
  onSelect 
}) => {
  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'free':
        return <Star className="w-5 h-5 text-gray-600" />;
      case 'starter':
        return <Zap className="w-5 h-5 text-blue-600" />;
      case 'pro':
        return <Crown className="w-5 h-5 text-green-600" />;
      case 'enterprise':
        return <Crown className="w-5 h-5 text-purple-600" />;
      default:
        return <Star className="w-5 h-5" />;
    }
  };

  const getPlanBorderColor = (planName: string) => {
    if (isCurrentPlan) return 'border-green-500 ring-2 ring-green-200';
    
    switch (planName.toLowerCase()) {
      case 'job seeker explorer':
        return 'border-gray-200 hover:border-gray-300';
      case 'weekend searcher':
        return 'border-blue-200 hover:border-blue-300';
      case 'active job seeker':
        return 'border-green-200 hover:border-green-300 shadow-md bg-gradient-to-b from-green-50 to-white';
      case 'career changer':
        return 'border-orange-200 hover:border-orange-300 shadow-md bg-gradient-to-b from-orange-50 to-white';
      case 'aggressive applicant':
        return 'border-purple-200 hover:border-purple-300';
      case 'professional powerhouse':
        return 'border-red-200 hover:border-red-300';
      case 'enterprise unlimited':
        return 'border-black hover:border-gray-700';
      case 'custom solutions':
        return 'border-indigo-200 hover:border-indigo-300';
      default:
        return 'border-gray-200 hover:border-gray-300';
    }
  };

  const formatPrice = (price: number, billingCycle: string, planName: string) => {
    if (planName.toLowerCase() === 'custom solutions') {
      return 'Custom Pricing';
    }
    
    if (price === 0) return 'Free';
    
    const cycleText = {
      monthly: '/month',
      quarterly: '/quarter',
      yearly: '/year'
    };

    return `$${price}${cycleText[billingCycle as keyof typeof cycleText] || ''}`;
  };

  return (
    <Card className={`relative transition-all duration-200 ${getPlanBorderColor(plan.name)}`}>
      {plan.name.toLowerCase() === 'active job seeker' && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-green-500 text-white">
            <Star className="w-3 h-3 mr-1" />
            Most Popular
          </Badge>
        </div>
      )}
      
      {plan.name.toLowerCase() === 'career changer' && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-orange-500 text-white">
            <Zap className="w-3 h-3 mr-1" />
            Best Value
          </Badge>
        </div>
      )}
      
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getPlanIcon(plan.name)}
          {plan.name}
        </CardTitle>
        {plan.description && (
          <p className="text-sm text-gray-600">{plan.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Pricing */}
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {formatPrice(plan.price, plan.billingCycle, plan.name)}
          </div>
          <div className="text-lg font-semibold text-blue-600 mt-1">
            {plan.name.toLowerCase() === 'custom solutions' 
              ? 'Unlimited applications'
              : `${plan.creditsPerCycle} applications/month`
            }
          </div>
          {plan.price > 0 && plan.name.toLowerCase() !== 'custom solutions' && (
            <div className="text-xs text-gray-500">
              ${(plan.price / plan.creditsPerCycle).toFixed(2)} per application
            </div>
          )}
          
          {/* Show value indicator for higher tiers */}
          {(() => {
            const costPerApp = plan.price > 0 ? plan.price / plan.creditsPerCycle : 0;
            const baseCostPerApp = 9 / 15; // Weekend Searcher baseline: $9/15 = $0.60
            
            if (plan.price === 0) {
              return (
                <div className="mt-2">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                    Free Tier
                  </Badge>
                </div>
              );
            }
            
            if (costPerApp < baseCostPerApp * 0.8) {
              return (
                <div className="mt-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                    Great Value
                  </Badge>
                </div>
              );
            }
            
            return null;
          })()}
        </div>

        {/* Features */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Features:</p>
          <ul className="space-y-1">
            {plan.features.slice(0, 4).map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          {plan.features.length > 4 && (
            <p className="text-xs text-gray-500">
              +{plan.features.length - 4} more features
            </p>
          )}
        </div>

        {/* Action Button */}
        <Button
          onClick={onSelect}
          disabled={isCurrentPlan || isLoading}
          className={`w-full ${
            isCurrentPlan 
              ? 'bg-green-500 text-white cursor-not-allowed' 
              : ''
          }`}
          variant={isCurrentPlan ? 'default' : 'outline'}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              Processing...
            </span>
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : plan.name.toLowerCase() === 'custom solutions' ? (
            'Contact Sales'
          ) : (
            plan.price === 0 ? 'Get Started Free' : 'Subscribe Now'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SubscriptionPlans;