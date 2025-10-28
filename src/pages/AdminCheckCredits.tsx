import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

/**
 * Admin utility to check user credits by email
 * Navigate to this page and enter an email to see their credit balance
 */
export default function AdminCheckCredits() {
  const [email, setEmail] = useState('siscostarters@gmail.com');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  const checkCredits = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      // First, get the user by email from auth.users (requires admin access)
      // Since we can't query auth.users directly, we'll query profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', email)
        .single();

      if (profileError || !profileData) {
        setError(`User not found with email: ${email}`);
        setLoading(false);
        return;
      }

      const userId = profileData.id;

      // Get credits
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Get subscription
      const { data: subData, error: subError } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans(name, credits_per_month)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get recent transactions
      const { data: transactions, error: txError } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      setResult({
        user: profileData,
        credits: creditsData,
        subscription: subData,
        transactions: transactions || [],
        errors: {
          creditsError: creditsError?.message,
          subError: subError?.message,
          txError: txError?.message,
        }
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Admin: Check User Credits</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <label className="block text-gray-300 mb-2">User Email</label>
          <div className="flex gap-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-gray-700 text-white rounded px-4 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="Enter user email"
            />
            <button
              onClick={checkCredits}
              disabled={loading || !email}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded font-medium transition-colors"
            >
              {loading ? 'Checking...' : 'Check Credits'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* User Info */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">User Information</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Email:</span>
                  <p className="text-white font-medium">{result.user.email}</p>
                </div>
                <div>
                  <span className="text-gray-400">Name:</span>
                  <p className="text-white font-medium">{result.user.full_name || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-400">User ID:</span>
                  <p className="text-white font-mono text-xs">{result.user.id}</p>
                </div>
              </div>
            </div>

            {/* Credits */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Credit Balance</h2>
              {result.credits ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-700 rounded p-4">
                    <p className="text-gray-400 text-sm">Current Balance</p>
                    <p className="text-3xl font-bold text-green-400">{result.credits.balance}</p>
                  </div>
                  <div className="bg-gray-700 rounded p-4">
                    <p className="text-gray-400 text-sm">Total Earned</p>
                    <p className="text-2xl font-bold text-blue-400">{result.credits.total_earned}</p>
                  </div>
                  <div className="bg-gray-700 rounded p-4">
                    <p className="text-gray-400 text-sm">Total Consumed</p>
                    <p className="text-2xl font-bold text-red-400">{result.credits.total_consumed}</p>
                  </div>
                  <div className="bg-gray-700 rounded p-4">
                    <p className="text-gray-400 text-sm">Last Reset</p>
                    <p className="text-sm text-gray-300">{new Date(result.credits.last_reset_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400">No credits data found</p>
              )}
            </div>

            {/* Subscription */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Active Subscription</h2>
              {result.subscription ? (
                <div className="space-y-2">
                  <p className="text-gray-300">
                    <span className="text-gray-400">Plan:</span>{' '}
                    <span className="font-bold text-white">{result.subscription.subscription_plans?.name || 'Unknown'}</span>
                  </p>
                  <p className="text-gray-300">
                    <span className="text-gray-400">Monthly Credits:</span>{' '}
                    <span className="font-bold text-white">{result.subscription.subscription_plans?.credits_per_month || 0}</span>
                  </p>
                  <p className="text-gray-300">
                    <span className="text-gray-400">Status:</span>{' '}
                    <span className="font-bold text-green-400">{result.subscription.status}</span>
                  </p>
                </div>
              ) : (
                <p className="text-gray-400">No active subscription</p>
              )}
            </div>

            {/* Recent Transactions */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Recent Transactions (Last 10)</h2>
              {result.transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-gray-400 border-b border-gray-700">
                      <tr>
                        <th className="text-left py-2">Date</th>
                        <th className="text-left py-2">Type</th>
                        <th className="text-right py-2">Amount</th>
                        <th className="text-left py-2">Description</th>
                        <th className="text-right py-2">Balance After</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      {result.transactions.map((tx: any) => (
                        <tr key={tx.id} className="border-b border-gray-700">
                          <td className="py-2">{new Date(tx.created_at).toLocaleString()}</td>
                          <td className="py-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              tx.type === 'earned' || tx.type === 'bonus' ? 'bg-green-900/30 text-green-400' :
                              tx.type === 'refund' ? 'bg-blue-900/30 text-blue-400' :
                              'bg-red-900/30 text-red-400'
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className={`py-2 text-right font-medium ${
                            tx.type === 'consumed' ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {tx.type === 'consumed' ? '-' : '+'}{tx.amount}
                          </td>
                          <td className="py-2">{tx.description}</td>
                          <td className="py-2 text-right font-bold">{tx.balance_after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400">No transactions found</p>
              )}
            </div>

            {/* Debug Info */}
            {Object.values(result.errors).some(e => e) && (
              <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
                <h3 className="text-yellow-400 font-bold mb-2">Errors/Warnings</h3>
                <pre className="text-yellow-300 text-xs overflow-auto">
                  {JSON.stringify(result.errors, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
