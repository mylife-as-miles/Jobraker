// Credit balance display component
import React, { useEffect, useState } from 'react';
import { CreditService } from '@/services/creditService';
import { CreditBalance, CreditTransaction } from '@/types/credits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Coins, History, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface CreditDisplayProps {
  showHistory?: boolean;
  compact?: boolean;
}

export const CreditDisplay: React.FC<CreditDisplayProps> = ({ 
  showHistory = false, 
  compact = false 
}) => {
  const { user } = useAuth();
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const fetchCredits = async () => {
      setLoading(true);
      const balance = await CreditService.getCreditBalance(user.id);
      setCredits(balance);
      setLoading(false);
    };

    fetchCredits();

    // Subscribe to real-time updates
    const subscription = CreditService.subscribeToCredits(user.id, (updatedCredits) => {
      if (updatedCredits) {
        setCredits({
          balance: updatedCredits.balance,
          totalEarned: updatedCredits.totalEarned,
          totalConsumed: updatedCredits.totalConsumed,
          lastResetAt: updatedCredits.lastResetAt
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  if (loading) {
    return (
      <Card className={compact ? "w-48" : "w-full"}>
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!credits) {
    return (
      <Card className={compact ? "w-48" : "w-full"}>
        <CardContent className="p-4">
          <p className="text-sm text-gray-500">Credits not available</p>
        </CardContent>
      </Card>
    );
  }

  const usagePercentage = credits.totalEarned > 0 
    ? (credits.totalConsumed / credits.totalEarned) * 100 
    : 0;

  if (compact) {
    return (
      <Card className="w-48 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Credits</span>
            </div>
            <span className="text-lg font-bold text-green-700">{credits.balance}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Coins className="w-5 h-5 text-green-600" />
          Credit Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-green-700">{credits.balance}</p>
            <p className="text-sm text-gray-500">Available Credits</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">
              {credits.totalEarned} earned
            </p>
            <p className="text-sm text-gray-500">
              {credits.totalConsumed} used
            </p>
          </div>
        </div>

        {/* Usage Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Usage</span>
            <span className="text-gray-600">{usagePercentage.toFixed(1)}%</span>
          </div>
          <Progress 
            value={usagePercentage} 
            className="h-2"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {showHistory && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              History
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Buy Credits
          </Button>
        </div>

        {/* Last Reset Info */}
        {credits.lastResetAt && (
          <p className="text-xs text-gray-500 pt-2 border-t">
            Last reset: {new Date(credits.lastResetAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>

      {/* History Modal */}
      {showHistoryModal && (
        <CreditHistoryModal
          userId={user?.id || ''}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </Card>
  );
};

// Credit History Modal Component
interface CreditHistoryModalProps {
  userId: string;
  onClose: () => void;
}

const CreditHistoryModal: React.FC<CreditHistoryModalProps> = ({ userId, onClose }) => {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const history = await CreditService.getCreditHistory(userId, 20);
      setTransactions(history);
      setLoading(false);
    };

    fetchHistory();
  }, [userId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md max-h-[80vh] overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>Credit History</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-y-auto max-h-96">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction: any) => (
                <div key={transaction.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium">
                      {transaction.description || transaction.type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`text-sm font-medium ${
                    transaction.type === 'earned' || transaction.type === 'bonus' || transaction.type === 'refunded'
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {(transaction.type === 'earned' || transaction.type === 'bonus' || transaction.type === 'refunded') ? '+' : '-'}{transaction.amount}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CreditDisplay;