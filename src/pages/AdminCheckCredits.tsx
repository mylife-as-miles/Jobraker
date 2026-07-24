import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabaseClient";
import { ShieldAlert } from "lucide-react";
import { formatCreditEntry } from "@/lib/creditFormatting";
import { CreditService } from "@/services/creditService";
import { RouteLoadingFallback } from "@/components/system/RouteLoadingFallback";

/**
 * Admin utility to check user credits by email
 * Navigate to this page and enter an email to see their credit balance
 */
export default function AdminCheckCredits() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("siscostarters@gmail.com");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const supabase = createClient();

  // Check admin status on mount
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const { isCurrentUserAdmin } = await import("@/lib/adminUtils");
        const admin = await isCurrentUserAdmin();
        setIsAdmin(admin);

        if (!admin) {
          // Redirect non-admin users to dashboard
          navigate("/dashboard", { replace: true });
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
        navigate("/dashboard", { replace: true });
      } finally {
        setChecking(false);
      }
    };

    checkAdminAccess();
  }, [navigate]);

  const checkCredits = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      // First, get the user by email from auth.users (requires admin access)
      // Since we can't query auth.users directly, we'll query profiles table
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("email", email)
        .single();

      if (profileError || !profileData) {
        setError(`User not found with email: ${email}`);
        setLoading(false);
        return;
      }

      const userId = profileData.id;

      // Get V2-first credits
      const balance = await CreditService.getCreditBalance(userId);
      const v2Balance = balance?.v2;

      // Get subscription
      const { data: subData, error: subError } = await supabase
        .from("user_subscriptions")
        .select(
          `
          *,
          subscription_plans(name, credits_per_month)
        `,
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("current_period_end", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get recent transactions via V2-first service
      const transactions = await CreditService.getCreditHistory(userId, 10);

      setResult({
        user: profileData,
        credits: balance,
        v2Credits: v2Balance,
        subscription: subData,
        transactions: transactions || [],
        errors: {
          creditsError: balance ? null : "Failed to fetch credit balance",
          subError: subError?.message,
          txError: transactions ? null : "Failed to fetch transaction history",
        },
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking admin status
  if (checking) {
    return <RouteLoadingFallback />;
  }

  // Show access denied if not admin
  if (isAdmin === false) {
    return (
      <div className='min-h-screen bg-gray-900 flex items-center justify-center p-6'>
        <div className='max-w-md w-full bg-brand/20 border border-brand/50 rounded-lg p-8 text-center'>
          <div className='w-20 h-20 rounded-full bg-brand/20 flex items-center justify-center mx-auto mb-6'>
            <ShieldAlert className='w-10 h-10 text-brand' />
          </div>
          <h1 className='text-2xl font-bold text-white mb-3'>Access Denied</h1>
          <p className='text-gray-400 mb-6'>
            Admin privileges required to access this tool.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className='bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium transition-colors'
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-900 p-8'>
      <div className='max-w-4xl mx-auto'>
        <h1 className='text-3xl font-bold text-white mb-8'>
          Admin: Check User Credits
        </h1>

        <div className='bg-gray-800 rounded-lg p-6 mb-6'>
          <label className='block text-gray-300 mb-2'>User Email</label>
          <div className='flex gap-4'>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className='flex-1 bg-gray-700 text-white rounded px-4 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none'
              placeholder='Enter user email'
            />
            <button
              onClick={checkCredits}
              disabled={loading || !email}
              className='bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded font-medium transition-colors'
            >
              {loading ? "Checking..." : "Check Credits"}
            </button>
          </div>
        </div>

        {error && (
          <div className='bg-brand/20 border border-brand rounded-lg p-4 mb-6'>
            <p className='text-brand'>{error}</p>
          </div>
        )}

        {result && (
          <div className='space-y-6'>
            {/* User Info */}
            <div className='bg-gray-800 rounded-lg p-6'>
              <h2 className='text-xl font-bold text-white mb-4'>
                User Information
              </h2>
              <div className='grid grid-cols-2 gap-4 text-sm'>
                <div>
                  <span className='text-gray-400'>Email:</span>
                  <p className='text-white font-medium'>{result.user.email}</p>
                </div>
                <div>
                  <span className='text-gray-400'>Name:</span>
                  <p className='text-white font-medium'>
                    {result.user.full_name || "N/A"}
                  </p>
                </div>
                <div>
                  <span className='text-gray-400'>User ID:</span>
                  <p className='text-white font-mono text-xs'>
                    {result.user.id}
                  </p>
                </div>
              </div>
            </div>

            {/* Credits */}
            <div className='bg-gray-800 rounded-lg p-6'>
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-xl font-bold text-white'>
                  Credit Balance
                </h2>
                {result.v2Credits && (
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    result.v2Credits.source === 'v2' 
                      ? 'bg-blue-900/40 text-blue-400 border border-blue-500/30' 
                      : 'bg-yellow-900/40 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    Source: {result.v2Credits.source.toUpperCase()}
                  </span>
                )}
              </div>
              {result.credits ? (
                <div className={`grid grid-cols-2 ${result.v2Credits ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4`}>
                  <div className='bg-gray-700 rounded p-4'>
                    <p className='text-gray-400 text-sm'>Available (Spendable)</p>
                    <p className='text-3xl font-bold text-green-400'>
                      {result.v2Credits ? result.v2Credits.available : result.credits.balance}
                    </p>
                  </div>
                  {result.v2Credits && (
                    <div className='bg-gray-700 rounded p-4'>
                      <p className='text-gray-400 text-sm'>Reserved (Holds)</p>
                      <p className='text-3xl font-bold text-yellow-400'>
                        {result.v2Credits.reserved}
                      </p>
                    </div>
                  )}
                  <div className='bg-gray-700 rounded p-4'>
                    <p className='text-gray-400 text-sm'>Total Balance</p>
                    <p className='text-3xl font-bold text-blue-400'>
                      {result.v2Credits ? result.v2Credits.total : result.credits.balance}
                    </p>
                  </div>
                  <div className='bg-gray-700 rounded p-4'>
                    <p className='text-gray-400 text-sm'>Total Earned</p>
                    <p className='text-2xl font-bold text-gray-300'>
                      {result.credits.totalEarned ?? 0}
                    </p>
                  </div>
                  <div className='bg-gray-700 rounded p-4'>
                    <p className='text-gray-400 text-sm'>Total Consumed</p>
                    <p className='text-2xl font-bold text-brand'>
                      {result.credits.totalConsumed ?? 0}
                    </p>
                  </div>
                </div>
              ) : (
                <p className='text-gray-400'>No credits data found</p>
              )}
            </div>

            {/* Subscription */}
            <div className='bg-gray-800 rounded-lg p-6'>
              <h2 className='text-xl font-bold text-white mb-4'>
                Active Subscription
              </h2>
              {result.subscription ? (
                <div className='space-y-2'>
                  <p className='text-gray-300'>
                    <span className='text-gray-400'>Plan:</span>{" "}
                    <span className='font-bold text-white'>
                      {result.subscription.subscription_plans?.name ||
                        "Unknown"}
                    </span>
                  </p>
                  <p className='text-gray-300'>
                    <span className='text-gray-400'>Monthly Credits:</span>{" "}
                    <span className='font-bold text-white'>
                      {result.subscription.subscription_plans
                        ?.credits_per_month || 0}
                    </span>
                  </p>
                  <p className='text-gray-300'>
                    <span className='text-gray-400'>Status:</span>{" "}
                    <span className='font-bold text-green-400'>
                      {result.subscription.status}
                    </span>
                  </p>
                </div>
              ) : (
                <p className='text-gray-400'>No active subscription</p>
              )}
            </div>

            {/* Recent Transactions */}
            <div className='bg-gray-800 rounded-lg p-6'>
              <h2 className='text-xl font-bold text-white mb-4'>
                Recent Transactions (Last 10)
              </h2>
              {result.transactions.length > 0 ? (
                <div className='overflow-x-auto'>
                  <table className='w-full text-sm'>
                    <thead className='text-gray-400 border-b border-gray-700'>
                      <tr>
                        <th className='text-left py-2'>Date</th>
                        <th className='text-left py-2'>Type</th>
                        <th className='text-right py-2'>Amount</th>
                        <th className='text-left py-2'>Description</th>
                        <th className='text-right py-2'>Balance After</th>
                      </tr>
                    </thead>
                    <tbody className='text-gray-300'>
                      {result.transactions.map((tx: any) => {
                        const formatted = formatCreditEntry(tx);
                        return (
                          <tr key={tx.id} className='border-b border-gray-700'>
                            <td className='py-2'>
                              {new Date(tx.createdAt || tx.created_at).toLocaleString()}
                            </td>
                            <td className='py-2'>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  formatted.semanticColor === "positive"
                                    ? "bg-green-900/30 text-green-400"
                                    : formatted.direction === "hold"
                                      ? "bg-yellow-900/30 text-yellow-400"
                                      : "bg-brand/30 text-brand"
                                }`}
                              >
                                {tx.type || tx.transaction_type}
                              </span>
                            </td>
                            <td
                              className={`py-2 text-right font-medium ${
                                formatted.semanticColor === "negative" || formatted.direction === "hold"
                                  ? "text-brand"
                                  : "text-green-400"
                              }`}
                            >
                              {formatted.formattedAmount}
                            </td>
                            <td className='py-2'>{tx.description}</td>
                            <td className='py-2 text-right font-bold'>
                              {tx.balanceAfter ?? tx.balance_after}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className='text-gray-400'>No transactions found</p>
              )}
            </div>

            {/* Debug Info */}
            {Object.values(result.errors).some((e) => e) && (
              <div className='bg-brand/20 border border-brand rounded-lg p-4'>
                <h3 className='text-brand font-bold mb-2'>Errors/Warnings</h3>
                <pre className='text-brand text-xs overflow-auto'>
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
