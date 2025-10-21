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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Coins className="w-8 h-8 text-green-600" />
            <h1 className="text-4xl font-bold text-gray-900">Credit Pack System</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            One-time credit purchases with exceptional profit margins (33-57%)
          </p>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold text-blue-900">Mini Pack</div>
                <div className="text-blue-700">$7 • 10 credits</div>
                <Badge className="bg-blue-100 text-blue-800 text-xs">2.3x markup</Badge>
              </div>
              <div className="text-center">
                <div className="font-semibold text-blue-900">Starter Pack</div>
                <div className="text-blue-700">$16 • 25 credits</div>
                <Badge className="bg-blue-100 text-blue-800 text-xs">2.1x markup</Badge>
              </div>
              <div className="text-center border-2 border-green-300 bg-green-50 rounded-lg p-2">
                <div className="font-semibold text-green-900">Value Pack</div>
                <div className="text-green-700">$42 • 75 credits</div>
                <Badge className="bg-green-500 text-white text-xs">1.9x markup</Badge>
              </div>
              <div className="text-center">
                <div className="font-semibold text-blue-900">Power Pack</div>
                <div className="text-blue-700">$99 • 200 credits</div>
                <Badge className="bg-blue-100 text-blue-800 text-xs">1.7x markup</Badge>
              </div>
              <div className="text-center">
                <div className="font-semibold text-blue-900">Mega Pack</div>
                <div className="text-blue-700">$225 • 500 credits</div>
                <Badge className="bg-blue-100 text-blue-800 text-xs">1.5x markup</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="plans">Credit Packs</TabsTrigger>
            <TabsTrigger value="analytics">Usage Analytics</TabsTrigger>
            <TabsTrigger value="features">Feature Demo</TabsTrigger>
            <TabsTrigger value="admin">Admin Tools</TabsTrigger>
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
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button className="w-full" variant="outline">
                      <Coins className="w-4 h-4 mr-2" />
                      Buy Credits
                    </Button>
                    <Button className="w-full" variant="outline">
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade Plan
                    </Button>
                    <Button className="w-full" variant="outline">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  Subscription Plans
                </CardTitle>
                <p className="text-gray-600">
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
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold text-red-800 mb-2">{title}</h3>
            <p className="text-red-600 mb-4">{description}</p>
            <Badge className="bg-red-100 text-red-800">Insufficient Credits</Badge>
          </CardContent>
        </Card>
      }
    >
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <Zap className="w-12 h-12 text-green-600" />
          </div>
          <h3 className="font-semibold text-green-800 mb-2">{title}</h3>
          <p className="text-green-600 mb-4">{description}</p>
          <Badge className="bg-green-100 text-green-800">Feature Unlocked</Badge>
          <div className="mt-4 p-4 bg-white rounded border-2 border-dashed border-green-300">
            <p className="text-gray-600 text-sm">
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Credits Balance</span>
          <Badge className={credits.balance && credits.balance.balance > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
            {credits.loading ? '...' : credits.balance?.balance || 0}
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Subscription</span>
          <Badge className={subscription.subscription ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}>
            {subscription.loading ? '...' : subscription.subscription?.plan?.name || 'Free'}
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Feature Access</span>
          <Badge className="bg-green-100 text-green-800">
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
      <Card>
        <CardHeader>
          <CardTitle>Credit Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">Administrative tools for managing user credits</p>
          <div className="space-y-2">
            <Button className="w-full" variant="outline">Add Bonus Credits</Button>
            <Button className="w-full" variant="outline">Refund Transaction</Button>
            <Button className="w-full" variant="outline">View All Transactions</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">Overall system performance and usage statistics</p>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm">Total Users</span>
              <Badge>1,234</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Credits Allocated</span>
              <Badge>45,678</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Credits Consumed</span>
              <Badge>23,456</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Active Subscriptions</span>
              <Badge>567</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreditSystemDemo;