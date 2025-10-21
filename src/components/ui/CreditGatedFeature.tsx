// Credit-gated feature wrapper component
import React, { useEffect, useState } from 'react';
import { CreditService } from '@/services/creditService';
import { FeatureAccess } from '@/types/credits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Coins, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface CreditGatedFeatureProps {
  featureType: string;
  featureName: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onUpgrade?: () => void;
  className?: string;
  showPreview?: boolean;
}

export const CreditGatedFeature: React.FC<CreditGatedFeatureProps> = ({
  featureType,
  featureName,
  children,
  fallback,
  onUpgrade,
  className = "",
  showPreview = false
}) => {
  const { user } = useAuth();
  const [access, setAccess] = useState<FeatureAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [consuming, setConsuming] = useState(false);
  const [hasConsumed, setHasConsumed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const checkAccess = async () => {
      setLoading(true);
      const accessInfo = await CreditService.checkFeatureAccess(
        user.id,
        featureType,
        featureName
      );
      setAccess(accessInfo);
      setLoading(false);
    };

    checkAccess();
  }, [user?.id, featureType, featureName]);

  const handleUseFeature = async () => {
    if (!user?.id || !access?.hasAccess) return;

    setConsuming(true);
    try {
      const success = await CreditService.consumeCredits(user.id, {
        featureType,
        featureName
      });
      
      if (success) {
        setHasConsumed(true);
        // Refresh access info
        const updatedAccess = await CreditService.checkFeatureAccess(
          user.id,
          featureType,
          featureName
        );
        setAccess(updatedAccess);
      }
    } catch (error) {
      console.error('Error using feature:', error);
    } finally {
      setConsuming(false);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <Card>
          <CardContent className="p-6">
            <div className="h-20 bg-gray-200 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!access) {
    return (
      <Alert className={className}>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          Unable to check feature access. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  // If user has access and has consumed credits, show the feature
  if (hasConsumed) {
    return <div className={className}>{children}</div>;
  }

  // If user has access but hasn't used the feature yet
  if (access.hasAccess) {
    return (
      <div className={className}>
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-blue-600" />
                <span>{access.featureName.replace(/_/g, ' ')}</span>
              </div>
              <Badge className="bg-blue-100 text-blue-800">
                {access.creditsRequired} credits
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {access.description && (
              <p className="text-sm text-gray-600">{access.description}</p>
            )}
            
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
              <div>
                <p className="text-sm font-medium">Current Balance</p>
                <p className="text-lg font-bold text-green-600">{access.currentBalance}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Cost</p>
                <p className="text-lg font-bold text-blue-600">{access.creditsRequired}</p>
              </div>
            </div>

            {showPreview && (
              <div className="relative">
                <div className="opacity-50 pointer-events-none">
                  {children}
                </div>
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                  <Lock className="w-8 h-8 text-gray-400" />
                </div>
              </div>
            )}

            <Button
              onClick={handleUseFeature}
              disabled={consuming}
              className="w-full"
            >
              {consuming ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Using Feature...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  Use Feature ({access.creditsRequired} credits)
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User doesn't have enough credits
  const defaultFallback = (
    <Card className={`border-red-200 bg-red-50 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-red-800">
          <Lock className="w-5 h-5" />
          Insufficient Credits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-red-200 bg-red-100">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">
            You need {access.creditsRequired} credits to use this feature. 
            You currently have {access.currentBalance} credits.
          </AlertDescription>
        </Alert>

        {access.description && (
          <p className="text-sm text-gray-600">{access.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-3 bg-white rounded-lg border">
            <p className="text-sm text-gray-500">Required</p>
            <p className="text-lg font-bold text-red-600">{access.creditsRequired}</p>
          </div>
          <div className="p-3 bg-white rounded-lg border">
            <p className="text-sm text-gray-500">Available</p>
            <p className="text-lg font-bold text-gray-600">{access.currentBalance}</p>
          </div>
        </div>

        {showPreview && (
          <div className="relative">
            <div className="opacity-30 pointer-events-none">
              {children}
            </div>
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
              <div className="text-center">
                <Lock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Locked Feature</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={onUpgrade}
            className="flex-1"
            variant="default"
          >
            Get More Credits
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return <>{fallback || defaultFallback}</>;
};

// Higher-order component for credit gating
export const withCreditGating = (
  featureType: string,
  featureName: string,
  options: {
    fallback?: React.ReactNode;
    onUpgrade?: () => void;
    showPreview?: boolean;
  } = {}
) => {
  return function <P extends object>(Component: React.ComponentType<P>) {
    return function CreditGatedComponent(props: P) {
      return (
        <CreditGatedFeature
          featureType={featureType}
          featureName={featureName}
          {...options}
        >
          <Component {...props} />
        </CreditGatedFeature>
      );
    };
  };
};

// Hook for checking feature access
export const useFeatureAccess = (featureType: string, featureName: string) => {
  const { user } = useAuth();
  const [access, setAccess] = useState<FeatureAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const checkAccess = async () => {
      setLoading(true);
      const accessInfo = await CreditService.checkFeatureAccess(
        user.id,
        featureType,
        featureName
      );
      setAccess(accessInfo);
      setLoading(false);
    };

    checkAccess();
  }, [user?.id, featureType, featureName]);

  const consumeCredits = async () => {
    if (!user?.id || !access?.hasAccess) return false;

    try {
      const success = await CreditService.consumeCredits(user.id, {
        featureType,
        featureName
      });
      
      if (success) {
        // Refresh access info
        const updatedAccess = await CreditService.checkFeatureAccess(
          user.id,
          featureType,
          featureName
        );
        setAccess(updatedAccess);
      }
      
      return success;
    } catch (error) {
      console.error('Error consuming credits:', error);
      return false;
    }
  };

  return {
    access,
    loading,
    consumeCredits,
    hasAccess: access?.hasAccess || false,
    creditsRequired: access?.creditsRequired || 0,
    currentBalance: access?.currentBalance || 0
  };
};

export default CreditGatedFeature;