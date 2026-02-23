// Feature usage analytics and credit consumption tracking
import React, { useEffect, useState } from 'react';
import { CreditService } from '@/services/creditService';
import { FeatureUsage } from '@/types/credits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, TrendingUp, Zap, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface FeatureUsageAnalyticsProps {
  timeRange?: '7d' | '30d' | '90d' | '1y';
  showChart?: boolean;
}

export const FeatureUsageAnalytics: React.FC<FeatureUsageAnalyticsProps> = ({ 
  timeRange = '30d',
  showChart = true 
}) => {
  const { user } = useAuth();
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchUsage = async () => {
      setLoading(true);
      const usage = await CreditService.getFeatureUsage(user.id);
      setFeatureUsage(usage);
      setLoading(false);
    };

    fetchUsage();
  }, [user?.id, timeRange]);

  const chartData = featureUsage.map(usage => ({
    name: usage.featureName.replace(/_/g, ' '),
    credits: usage.totalCredits,
    usage: usage.usageCount
  }));

  const pieData = featureUsage.slice(0, 5).map((usage, index) => ({
    name: usage.featureName.replace(/_/g, ' '),
    value: usage.totalCredits,
    color: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'][index]
  }));

  const totalCreditsUsed = featureUsage.reduce((sum, usage) => sum + usage.totalCredits, 0);
  const totalUsageCount = featureUsage.reduce((sum, usage) => sum + usage.usageCount, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-blue-600 bg-blue-100 rounded-lg p-1" />
              <div>
                <p className="text-sm text-gray-600">Total Credits Used</p>
                <p className="text-xl font-bold text-gray-900">{totalCreditsUsed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-green-600 bg-green-100 rounded-lg p-1" />
              <div>
                <p className="text-sm text-gray-600">Feature Uses</p>
                <p className="text-xl font-bold text-gray-900">{totalUsageCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-purple-600 bg-purple-100 rounded-lg p-1" />
              <div>
                <p className="text-sm text-gray-600">Avg Credits/Use</p>
                <p className="text-xl font-bold text-gray-900">
                  {totalUsageCount > 0 ? (totalCreditsUsed / totalUsageCount).toFixed(1) : '0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Usage List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Feature Usage Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {featureUsage.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No feature usage data yet</p>
              <p className="text-sm text-gray-400">Start using features to see analytics here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {featureUsage.map((usage, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 capitalize">
                        {usage.featureName.replace(/_/g, ' ')}
                      </h4>
                      <Badge variant="secondary" className="text-xs">
                        {usage.featureType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{usage.usageCount} uses</span>
                      <span>•</span>
                      <span>{usage.totalCredits} credits</span>
                      <span>•</span>
                      <span>{usage.cost} credits each</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{usage.totalCredits}</p>
                    <p className="text-xs text-gray-500">
                      {usage.lastUsed ? new Date(usage.lastUsed).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      {showChart && featureUsage.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Credits by Feature</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="credits" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FeatureUsageAnalytics;