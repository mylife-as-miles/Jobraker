// Credit system demo page to showcase all credit functionality
import React from 'react';
import { CreditDisplay } from '@/components/ui/CreditDisplay';
import { SubscriptionPlans } from '@/components/ui/SubscriptionPlans';
import { FeatureUsageAnalytics } from '@/components/ui/FeatureUsageAnalytics';
import { CreditGatedFeature } from '@/components/ui/CreditGatedFeature';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, Zap, TrendingUp, Crown } from 'lucide-react';
import { useCreditSystem } from '@/hooks/useCredits';

const CreditSystemDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Coins className="w-8 h-8 text-[#1dff00]" />
            <h1 className="text-4xl font-bold text-white">Simple Subscription Plans</h1>
          </div>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Three simple tiers - Free to get started, Pro for professionals, Ultimate for power users
          </p>
          <div className="mt-4 p-6 bg-blue-950/10 border border-blue-500/20 rounded-lg max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="font-bold text-white text-lg">FREE</div>
                <div className="text-gray-400 text-sm mb-2">Get Started</div>
                <div className="text-[#1dff00] font-bold text-2xl">$0/mo</div>
                <div className="text-gray-400 text-sm">10 applications</div>
                <div className="text-xs text-gray-500 mt-1">Perfect for exploring</div>
              </div>
              <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
                <div className="font-bold text-blue-100 text-lg">PRO</div>
                <div className="text-blue-300 text-sm mb-2">Most Popular</div>
                <div className="text-blue-400 font-bold text-2xl">$49/mo</div>
                <div className="text-blue-300 text-sm">200 applications</div>
                <div className="text-xs text-blue-400/70 mt-1">$0.25 per application</div>
              </div>
              <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                <div className="font-bold text-purple-100 text-lg">ULTIMATE</div>
                <div className="text-purple-300 text-sm mb-2">Best Value</div>
                <div className="text-purple-400 font-bold text-2xl">$199/mo</div>
                <div className="text-purple-300 text-sm">1,000 applications</div>
                <div className="text-xs text-purple-400/70 mt-1">$0.20 per application</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-white/5 border border-white/10">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[#1dff00] data-[state=active]:text-black">Overview</TabsTrigger>
            <TabsTrigger value="plans" className="data-[state=active]:bg-[#1dff00] data-[state=active]:text-black">Subscription Tiers</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-[#1dff00] data-[state=active]:text-black">Usage Analytics</TabsTrigger>
            <TabsTrigger value="features" className="data-[state=active]:bg-[#1dff00] data-[state=active]:text-black">Feature Demo</TabsTrigger>
            <TabsTrigger value="admin" className="data-[state=active]:bg-[#1dff00] data-[state=active]:text-black">Admin Tools</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Credit Balance */}
              <div className="lg:col-span-2">
                <CreditDisplay showHistory={true} />
              </div>

              {/* Quick Stats */}
              <div className="space-y-4">
                <Card className="bg-white/5 border-white/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-white">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button className="w-full border-white/10 hover:bg-white/10 text-white" variant="outline">
                      <Coins className="w-4 h-4 mr-2" />
                      Buy Credits
                    </Button>
                    <Button className="w-full border-white/10 hover:bg-white/10 text-white" variant="outline">
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade Plan
                    </Button>
                    <Button className="w-full border-white/10 hover:bg-white/10 text-white" variant="outline">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      View Analytics
                    </Button>
                  </CardContent>
                </Card>

                <SystemStatsCard />
              </div>
            </div>
          </TabsContent>

          {/* Subscription Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Crown className="w-5 h-5 text-[#1dff00]" />
                  Subscription Plans
                </CardTitle>
                <p className="text-gray-400">
                  Choose a plan that fits your needs and automatically receive credits each billing cycle.
                </p>
              </CardHeader>
              <CardContent>
                <SubscriptionPlans showCurrentPlan={true} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <FeatureUsageAnalytics showChart={true} />
          </TabsContent>

          {/* Feature Demo Tab */}
          <TabsContent value="features" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FeatureDemo 
                featureType="job_search"
                featureName="auto_apply"
                title="Auto Apply to Jobs"
                description="Let AI automatically apply to relevant job postings for you"
              />
              
              <FeatureDemo 
                featureType="resume"
                featureName="ai_optimization"
                title="AI Resume Optimization"
                description="Enhance your resume with AI-powered suggestions and improvements"
              />
              
              <FeatureDemo 
                featureType="cover_letter"
                featureName="ai_generation"
                title="AI Cover Letter Generator"
                description="Generate personalized cover letters for specific job applications"
              />
              
              <FeatureDemo 
                featureType="interview"
                featureName="mock_interview"
                title="Mock Interview Session"
                description="Practice interviews with AI-powered questions and feedback"
              />
            </div>
          </TabsContent>

          {/* Admin Tools Tab */}
          <TabsContent value="admin" className="space-y-6">
            <AdminTools />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Feature Demo Component
interface FeatureDemoProps {
  featureType: string;
  featureName: string;
  title: string;
  description: string;
}

const FeatureDemo: React.FC<FeatureDemoProps> = ({
  featureType,
  featureName,
  title,
  description
}) => {
  return (
    <CreditGatedFeature
      featureType={featureType}
      featureName={featureName}
      showPreview={true}
      fallback={
        <Card className="border-red-500/30 bg-red-900/10">
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold text-red-400 mb-2">{title}</h3>
            <p className="text-red-300 mb-4">{description}</p>
            <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Insufficient Credits</Badge>
          </CardContent>
        </Card>
      }
    >
      <Card className="border-green-500/30 bg-green-900/10">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <Zap className="w-12 h-12 text-[#1dff00]" />
          </div>
          <h3 className="font-semibold text-[#1dff00] mb-2">{title}</h3>
          <p className="text-green-300 mb-4">{description}</p>
          <Badge className="bg-[#1dff00]/20 text-[#1dff00] border-[#1dff00]/30">Feature Unlocked</Badge>
          <div className="mt-4 p-4 bg-black/40 rounded border-2 border-dashed border-[#1dff00]/30">
            <p className="text-gray-400 text-sm">
              🎉 This is where the {title.toLowerCase()} feature would be displayed
            </p>
          </div>
        </CardContent>
      </Card>
    </CreditGatedFeature>
  );
};

// System Stats Component
const SystemStatsCard: React.FC = () => {
  const { credits, subscription } = useCreditSystem();

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-white">
          <TrendingUp className="w-5 h-5 text-[#1dff00]" />
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Credits Balance</span>
          <Badge className={credits.balance && credits.balance.balance > 0 ? "bg-[#1dff00]/20 text-[#1dff00] border-[#1dff00]/30" : "bg-red-900/20 text-red-400 border-red-500/30"}>
            {credits.loading ? '...' : credits.balance?.balance || 0}
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Subscription</span>
          <Badge className={subscription.subscription ? "bg-blue-900/20 text-blue-400 border-blue-500/30" : "bg-white/10 text-gray-400 border-white/20"}>
            {subscription.loading ? '...' : subscription.subscription?.plan?.name || 'Free'}
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Feature Access</span>
          <Badge className="bg-[#1dff00]/20 text-[#1dff00] border-[#1dff00]/30">
            Active
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

// Admin Tools Component
const AdminTools: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Credit Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-400">Administrative tools for managing user credits</p>
          <div className="space-y-2">
            <Button className="w-full border-white/10 hover:bg-white/10 text-white" variant="outline">Add Bonus Credits</Button>
            <Button className="w-full border-white/10 hover:bg-white/10 text-white" variant="outline">Refund Transaction</Button>
            <Button className="w-full border-white/10 hover:bg-white/10 text-white" variant="outline">View All Transactions</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">System Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-400">Overall system performance and usage statistics</p>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Total Users</span>
              <Badge className="bg-white/10 text-white">1,234</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Credits Allocated</span>
              <Badge className="bg-white/10 text-white">45,678</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Credits Consumed</span>
              <Badge className="bg-white/10 text-white">23,456</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Active Subscriptions</span>
              <Badge className="bg-white/10 text-white">567</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreditSystemDemo;