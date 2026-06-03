import { useState, useEffect } from "react";
import { useUserActivities } from "../hooks/useAdminStats";
import { useAdminActions } from "../hooks/useAdminActions";
import {
  Search,
  Filter,
  Download,
  Loader2,
  ChevronDown,
  Crown,
  Zap,
  Star,
  User,
  Mail,
  Calendar,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  Plus,
  Trash2,
  Eye,
  X,
  Coins,
  Shield,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { CreditTransaction } from "../types";
import { getCurrentUserAdminSubRole } from "../../../lib/adminUtils";
import { Card, CardContent } from "../../../components/ui/card";

function renderUserRoleBadges(user: any) {
  const badges: React.ReactNode[] = [];
  
  const adminRole = user.user_roles?.find((r: any) => r.role === 'admin');
  if (adminRole) {
    badges.push(
      <span key="admin" className='inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand/20 text-brand border border-brand/30 uppercase tracking-wider'>
        <Shield className='w-3 h-3' />
        Admin ({adminRole.admin_sub_role || 'reader'})
      </span>
    );
  }
  
  const hasCreatorRole = user.roles?.includes('creator') || user.user_roles?.some((r: any) => r.role === 'creator');
  if (hasCreatorRole) {
    badges.push(
      <span key="creator" className='inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30 uppercase tracking-wider'>
        <Crown className='w-3 h-3' />
        Creator
      </span>
    );
  }
  
  return badges;
}

type SortField =
  | "email"
  | "updated_at"
  | "credits_balance"
  | "credits_consumed"
  | "job_searches"
  | "auto_applies";
type SortOrder = "asc" | "desc";

// ─── User Detail Slide-Over Panel ─────────────────────────────────────────
function UserDetailPanel({
  user,
  isOpen,
  onClose,
  onTopUp,
  onChangePlan,
  onDelete,
  onManageRole,
  isOwner,
  isReader,
  transactions,
  loadingTransactions,
}: {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onTopUp: () => void;
  onChangePlan: () => void;
  onDelete: () => void;
  onManageRole: () => void;
  isOwner: boolean;
  isReader: boolean;
  transactions: CreditTransaction[];
  loadingTransactions: boolean;
}) {
  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 bg-background/60 backdrop-blur-sm z-50'
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className='fixed right-0 top-0 bottom-0 w-full max-w-lg bg-gradient-to-b from-background via-background to-background border-l border-brand/20 z-50 overflow-y-auto'
          >
            {/* Header */}
            <div className='sticky top-0 bg-background/95 backdrop-blur-xl border-b border-brand/20 px-6 py-4 flex items-center justify-between z-10'>
              <h2 className='text-xl font-bold text-white'>User Details</h2>
              <button
                onClick={onClose}
                className='text-gray-400 hover:text-white transition-colors p-2 hover:bg-foreground/5 rounded-lg'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            <div className='p-6 space-y-6'>
              {/* User Identity */}
              <div className='flex items-center gap-4'>
                <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-brand/20 to-background/10 border border-brand/30 flex items-center justify-center'>
                  <User className='w-8 h-8 text-brand' />
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-white'>
                    {user.full_name || "No Name"}
                  </h3>
                  <p className='text-sm text-gray-400 flex items-center gap-1.5'>
                    <Mail className='w-3.5 h-3.5' />
                    {user.email}
                  </p>
                  <div className='flex items-center gap-2 mt-1'>
                    {renderUserRoleBadges(user)}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${getStatusBadgeClass(user.status)}`}
                    >
                      {user.status}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${getTierBadgeClass(user.subscription_tier)}`}
                    >
                      {getTierIcon(user.subscription_tier)}
                      {user.subscription_tier}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className='grid grid-cols-2 gap-3'>
                <StatMini
                  icon={<Coins className='w-4 h-4 text-brand' />}
                  label='Credits'
                  value={user.credits_balance}
                />
                <StatMini
                  icon={<Zap className='w-4 h-4 text-brand' />}
                  label='Used'
                  value={user.credits_consumed}
                />
                <StatMini
                  icon={<Search className='w-4 h-4 text-blue-400' />}
                  label='Searches'
                  value={user.job_searches}
                />
                <StatMini
                  icon={<ArrowUpRight className='w-4 h-4 text-purple-400' />}
                  label='Auto Applies'
                  value={user.auto_applies}
                />
              </div>

              {/* Quick Actions */}
              <div className='space-y-2'>
                <h4 className='text-sm font-semibold text-gray-400 uppercase tracking-wider'>
                  Actions
                </h4>
                <div className='grid grid-cols-1 gap-2'>
                  {!isReader && (
                    <>
                      <ActionButton
                        icon={<Plus className='w-4 h-4' />}
                        label='Top Up Credits'
                        onClick={onTopUp}
                        color='green'
                      />
                      <ActionButton
                        icon={<Crown className='w-4 h-4' />}
                        label='Change Subscription'
                        onClick={onChangePlan}
                        color='accent'
                      />
                    </>
                  )}
                  {isOwner && (
                    <>
                      <ActionButton
                        icon={<Shield className='w-4 h-4' />}
                        label='Manage Role'
                        onClick={onManageRole}
                        color='accent'
                      />
                      <ActionButton
                        icon={<Trash2 className='w-4 h-4' />}
                        label='Delete User'
                        onClick={onDelete}
                        color='danger'
                      />
                    </>
                  )}
                  {isReader && (
                    <p className='text-xs text-gray-500 italic'>No actions available as Reader</p>
                  )}
                </div>
              </div>

              {/* Transaction History */}
              <div className='space-y-3'>
                <h4 className='text-sm font-semibold text-gray-400 uppercase tracking-wider'>
                  Recent Transactions
                </h4>
                {loadingTransactions ? (
                  <div className='flex items-center justify-center py-8'>
                    <Loader2 className='w-6 h-6 text-brand animate-spin' />
                  </div>
                ) : transactions.length === 0 ? (
                  <p className='text-sm text-gray-500 py-4 text-center'>
                    No transactions found
                  </p>
                ) : (
                  <div className='space-y-2 max-h-64 overflow-y-auto pr-1'>
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className='bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 flex items-center justify-between'
                      >
                        <div className='flex items-center gap-3'>
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              tx.transaction_type === "bonus" ||
                              tx.transaction_type === "earn" ||
                              tx.transaction_type === "refill"
                                ? "bg-brand/20 text-brand"
                                : "bg-brand/20 text-brand"
                            }`}
                          >
                            {tx.transaction_type === "bonus" ||
                            tx.transaction_type === "earn" ||
                            tx.transaction_type === "refill" ? (
                              <ArrowUpRight className='w-4 h-4' />
                            ) : (
                              <ArrowDownRight className='w-4 h-4' />
                            )}
                          </div>
                          <div>
                            <p className='text-sm text-white font-medium'>
                              {tx.description || tx.transaction_type || tx.type}
                            </p>
                            <p className='text-xs text-gray-500'>
                              {new Date(tx.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className='text-right'>
                          <p
                            className={`text-sm font-bold ${
                              tx.transaction_type === "bonus" ||
                              tx.transaction_type === "earn" ||
                              tx.transaction_type === "refill"
                                ? "text-brand"
                                : "text-brand"
                            }`}
                          >
                            {tx.transaction_type === "bonus" ||
                            tx.transaction_type === "earn" ||
                            tx.transaction_type === "refill"
                              ? "+"
                              : "-"}
                            {tx.amount}
                          </p>
                          <p className='text-xs text-gray-500'>
                            Bal: {tx.balance_after}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatMini({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className='bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 flex items-center gap-3'>
      <div className='w-9 h-9 rounded-lg bg-gray-700/50 flex items-center justify-center'>
        {icon}
      </div>
      <div>
        <p className='text-xs text-gray-400'>{label}</p>
        <p className='text-lg font-bold text-white'>{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: "green" | "accent" | "danger";
}) {
  const colorClasses = {
    green: "border-brand/30 hover:border-brand hover:bg-brand/10 text-brand",
    accent: "border-brand/30 hover:border-brand hover:bg-brand/10 text-brand",
    danger: "border-brand/30 hover:border-brand hover:bg-brand/10 text-brand",
  };
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-transparent transition-all ${colorClasses[color]}`}
    >
      {icon}
      <span className='text-sm font-medium'>{label}</span>
    </motion.button>
  );
}

// ─── Top Up Credits Dialog ────────────────────────────────────────────────
function TopUpDialog({
  user,
  isOpen,
  onClose,
  onConfirm,
  loading,
}: {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number, description: string) => void;
  loading: boolean;
}) {
  const [amount, setAmount] = useState(100);
  const [description, setDescription] = useState("");
  const quickAmounts = [50, 100, 250, 500, 1000];

  if (!isOpen || !user) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='fixed inset-0 bg-background/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4'
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className='bg-gradient-to-br from-background via-[#111111] to-background border border-brand/30 rounded-2xl w-full max-w-md shadow-2xl shadow-brand/10'
        >
          {/* Header */}
          <div className='px-6 pt-6 pb-4 border-b border-brand/20'>
            <div className='flex items-center gap-3 mb-2'>
              <div className='w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center'>
                <Coins className='w-5 h-5 text-brand' />
              </div>
              <div>
                <h3 className='text-lg font-bold text-white'>Top Up Credits</h3>
                <p className='text-sm text-gray-400'>{user.email}</p>
              </div>
            </div>
            <p className='text-sm text-gray-400'>
              Current balance:{" "}
              <span className='text-brand font-semibold'>
                {user.credits_balance}
              </span>{" "}
              credits
            </p>
          </div>

          {/* Body */}
          <div className='p-6 space-y-4'>
            {/* Quick Amount Buttons */}
            <div>
              <label className='text-sm text-gray-400 block mb-2'>
                Quick Select
              </label>
              <div className='flex flex-wrap gap-2'>
                {quickAmounts.map((qa) => (
                  <button
                    key={qa}
                    onClick={() => setAmount(qa)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      amount === qa
                        ? "bg-brand/20 border-brand text-brand"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-brand/50"
                    }`}
                  >
                    +{qa}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div>
              <label className='text-sm text-gray-400 block mb-2'>Amount</label>
              <input
                type='number'
                value={amount}
                onChange={(e) =>
                  setAmount(Math.max(1, parseInt(e.target.value) || 0))
                }
                min={1}
                className='w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-brand focus:outline-none transition-colors text-lg font-bold'
              />
            </div>

            {/* Description */}
            <div>
              <label className='text-sm text-gray-400 block mb-2'>
                Reason (optional)
              </label>
              <input
                type='text'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='e.g. Promotional bonus, Support credit'
                className='w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-brand focus:outline-none transition-colors'
              />
            </div>

            {/* Preview */}
            <div className='bg-brand/5 border border-brand/20 rounded-xl p-4'>
              <div className='flex justify-between text-sm'>
                <span className='text-gray-400'>Current Balance</span>
                <span className='text-white'>{user.credits_balance}</span>
              </div>
              <div className='flex justify-between text-sm mt-1'>
                <span className='text-gray-400'>Top Up Amount</span>
                <span className='text-brand font-semibold'>+{amount}</span>
              </div>
              <div className='border-t border-brand/20 my-2' />
              <div className='flex justify-between text-sm font-bold'>
                <span className='text-white'>New Balance</span>
                <span className='text-brand'>
                  {user.credits_balance + amount}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className='px-6 pb-6 flex gap-3'>
            <button
              onClick={onClose}
              className='flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-600 transition-all'
            >
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onConfirm(amount, description)}
              disabled={loading || amount < 1}
              className='flex-1 px-4 py-3 bg-gradient-to-r from-brand to-background text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-brand/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2'
            >
              {loading ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                <Plus className='w-4 h-4' />
              )}
              Add {amount} Credits
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Change Subscription Dialog ───────────────────────────────────────────
function ChangePlanDialog({
  user,
  isOpen,
  onClose,
  onConfirm,
  plans,
  loading,
}: {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (planId: string, planName: string) => void;
  plans: any[];
  loading: boolean;
}) {
  const [selectedPlan, setSelectedPlan] = useState<string>("");

  useEffect(() => {
    setSelectedPlan("");
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const planIcons: Record<string, React.ReactNode> = {
    Free: <User className='w-5 h-5 text-gray-400' />,
    Basics: <Star className='w-5 h-5 text-brand' />,
    Pro: <Zap className='w-5 h-5 text-blue-400' />,
    Ultimate: <Crown className='w-5 h-5 text-purple-400' />,
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='fixed inset-0 bg-background/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4'
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className='bg-gradient-to-br from-background via-[#111111] to-background border border-brand/30 rounded-2xl w-full max-w-md shadow-2xl shadow-brand/10'
        >
          {/* Header */}
          <div className='px-6 pt-6 pb-4 border-b border-brand/20'>
            <div className='flex items-center gap-3 mb-2'>
              <div className='w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center'>
                <Crown className='w-5 h-5 text-brand' />
              </div>
              <div>
                <h3 className='text-lg font-bold text-white'>
                  Change Subscription
                </h3>
                <p className='text-sm text-gray-400'>{user.email}</p>
              </div>
            </div>
            <p className='text-sm text-gray-400'>
              Current plan:{" "}
              <span className='text-brand font-semibold'>
                {user.subscription_tier}
              </span>
            </p>
          </div>

          {/* Body */}
          <div className='p-6 space-y-3'>
            <label className='text-sm text-gray-400 block mb-1'>
              Select New Plan
            </label>
            {plans.length === 0 ? (
              <div className='text-center py-6 text-gray-500'>
                <Loader2 className='w-6 h-6 animate-spin mx-auto mb-2' />
                Loading plans...
              </div>
            ) : (
              plans.map((plan) => (
                <motion.button
                  key={plan.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all ${
                    selectedPlan === plan.id
                      ? "bg-brand/10 border-brand shadow-lg shadow-brand/10"
                      : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedPlan === plan.id
                        ? "bg-brand/20"
                        : "bg-gray-700/50"
                    }`}
                  >
                    {planIcons[plan.name] || (
                      <Star className='w-5 h-5 text-gray-400' />
                    )}
                  </div>
                  <div className='flex-1 text-left'>
                    <p className='text-white font-medium'>{plan.name}</p>
                    <p className='text-xs text-gray-400'>
                      {plan.credits_per_cycle} credits/{plan.billing_cycle}
                    </p>
                  </div>
                  <p className='text-white font-bold'>${plan.price}</p>
                  {selectedPlan === plan.id && (
                    <CheckCircle2 className='w-5 h-5 text-brand' />
                  )}
                </motion.button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className='px-6 pb-6 flex gap-3'>
            <button
              onClick={onClose}
              className='flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-600 transition-all'
            >
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const plan = plans.find((p) => p.id === selectedPlan);
                if (plan) onConfirm(plan.id, plan.name);
              }}
              disabled={loading || !selectedPlan}
              className='flex-1 px-4 py-3 bg-gradient-to-r from-brand to-brand text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-brand/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2'
            >
              {loading ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                <Crown className='w-4 h-4' />
              )}
              Update Plan
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Delete User Confirmation Dialog ──────────────────────────────────────
function DeleteUserDialog({
  user,
  isOpen,
  onClose,
  onConfirm,
  loading,
}: {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [confirmEmail, setConfirmEmail] = useState("");

  useEffect(() => {
    setConfirmEmail("");
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const canDelete = confirmEmail === user.email;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='fixed inset-0 bg-background/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4'
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className='bg-gradient-to-br from-background via-[#111111] to-background border border-brand/30 rounded-2xl w-full max-w-md shadow-2xl shadow-brand/10'
        >
          {/* Header */}
          <div className='px-6 pt-6 pb-4 border-b border-brand/20'>
            <div className='flex items-center gap-3 mb-3'>
              <div className='w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center'>
                <AlertTriangle className='w-6 h-6 text-brand' />
              </div>
              <div>
                <h3 className='text-lg font-bold text-white'>Delete User</h3>
                <p className='text-sm text-brand'>
                  This action cannot be undone
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className='p-6 space-y-4'>
            <div className='bg-brand/10 border border-brand/20 rounded-xl p-4'>
              <p className='text-sm text-gray-300 mb-2'>
                You are about to permanently delete the user{" "}
                <strong className='text-white'>{user.email}</strong> and all
                their data:
              </p>
              <ul className='text-sm text-gray-400 space-y-1 ml-4 list-disc'>
                <li>Profile information</li>
                <li>Credit balance ({user.credits_balance} credits)</li>
                <li>Subscription ({user.subscription_tier})</li>
                <li>All transaction history</li>
                <li>All job applications</li>
              </ul>
            </div>

            <div>
              <label className='text-sm text-gray-400 block mb-2'>
                Type <span className='text-brand font-mono'>{user.email}</span>{" "}
                to confirm
              </label>
              <input
                type='text'
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder='Enter email to confirm'
                className='w-full px-4 py-3 bg-gray-800 border border-brand/30 rounded-xl text-white placeholder-gray-500 focus:border-brand focus:outline-none transition-colors'
              />
            </div>
          </div>

          {/* Footer */}
          <div className='px-6 pb-6 flex gap-3'>
            <button
              onClick={onClose}
              className='flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-600 transition-all'
            >
              Cancel
            </button>
            <motion.button
              whileHover={canDelete ? { scale: 1.02 } : {}}
              whileTap={canDelete ? { scale: 0.98 } : {}}
              onClick={onConfirm}
              disabled={loading || !canDelete}
              className='flex-1 px-4 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/20 transition-all disabled:opacity-30 disabled:hover:bg-red-500 flex items-center justify-center gap-2 border border-red-500/50'
            >
              {loading ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                <Trash2 className='w-4 h-4' />
              )}
              Delete Forever
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Manage Role Dialog ───────────────────────────────────────────────────
function ManageRoleDialog({
  user,
  isOpen,
  onClose,
  onConfirm,
  loading,
}: {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (role: "admin" | "user" | "creator", subRole: "owner" | "editor" | "reader" | null) => void;
  loading: boolean;
}) {
  const [role, setRole] = useState<"admin" | "user" | "creator">("user");
  const [subRole, setSubRole] = useState<"owner" | "editor" | "reader">("reader");

  useEffect(() => {
    if (user) {
      const adminRole = user.user_roles?.find((r: any) => r.role === 'admin');
      const hasCreator = user.roles?.includes('creator') || user.user_roles?.some((r: any) => r.role === 'creator');
      
      if (adminRole) {
        setRole("admin");
        setSubRole(adminRole.admin_sub_role || "reader");
      } else if (hasCreator) {
        setRole("creator");
        setSubRole("reader");
      } else {
        setRole("user");
        setSubRole("reader");
      }
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='fixed inset-0 bg-background/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4'
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className='bg-gradient-to-br from-background via-[#111111] to-background border border-brand/30 rounded-2xl w-full max-w-md shadow-2xl shadow-brand/10'
        >
          {/* Header */}
          <div className='px-6 pt-6 pb-4 border-b border-brand/20'>
            <div className='flex items-center gap-3 mb-2'>
              <div className='w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center'>
                <Shield className='w-5 h-5 text-brand' />
              </div>
              <div>
                <h3 className='text-lg font-bold text-white'>Manage User Role</h3>
                <p className='text-sm text-gray-400'>{user.email}</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className='p-6 space-y-4'>
            <div>
              <label className='text-sm text-gray-400 block mb-2'>Select Role</label>
              <div className='grid grid-cols-3 gap-2'>
                {(['user', 'creator', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold border uppercase tracking-wider transition-all ${
                      role === r
                        ? "bg-brand/20 border-brand text-brand font-bold"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-brand/30"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {role === "admin" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2 border-t border-brand/10 pt-4"
              >
                <label className='text-sm text-gray-400 block mb-2'>Select Admin Sub-Role</label>
                <div className='grid grid-cols-3 gap-2'>
                  {(['owner', 'editor', 'reader'] as const).map((sr) => (
                    <button
                      key={sr}
                      type="button"
                      onClick={() => setSubRole(sr)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border uppercase tracking-wider transition-all ${
                        subRole === sr
                          ? "bg-brand/20 border-brand text-brand font-bold"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-brand/30"
                      }`}
                    >
                      {sr}
                    </button>
                  ))}
                </div>
                <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 text-xs text-gray-400 mt-2 space-y-1">
                  {subRole === "owner" && (
                    <p><strong>Owner:</strong> Full database query access, role management, maintenance mode toggles, and deletion authority.</p>
                  )}
                  {subRole === "editor" && (
                    <p><strong>Editor:</strong> Manage user profiles, credits, subscriptions, and provider credit balances. Cannot manage roles, run DB scripts, toggle maintenance mode, or delete users.</p>
                  )}
                  {subRole === "reader" && (
                    <p><strong>Reader:</strong> Read-only access to all dashboards and panels. No write or mutation privileges.</p>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className='px-6 pb-6 flex gap-3'>
            <button
              onClick={onClose}
              className='flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-600 transition-all'
            >
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onConfirm(role, role === 'admin' ? subRole : null)}
              disabled={loading}
              className='flex-1 px-4 py-3 bg-gradient-to-r from-brand to-brand text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-brand/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2'
            >
              {loading ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                <CheckCircle2 className='w-4 h-4' />
              )}
              Save Changes
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Row Actions Dropdown ─────────────────────────────────────────────────
function RowActions({
  onView,
  onTopUp,
  onChangePlan,
  onDelete,
  onManageRole,
  isOwner,
  isReader,
}: {
  onView: () => void;
  onTopUp: () => void;
  onChangePlan: () => void;
  onDelete: () => void;
  onManageRole: () => void;
  isOwner: boolean;
  isReader: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className='relative'>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className='p-2 rounded-lg text-gray-400 hover:text-white hover:bg-foreground/5 transition-all'
      >
        <MoreVertical className='w-4 h-4' />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div
              className='fixed inset-0 z-40'
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              className='absolute right-0 top-full mt-1 w-48 bg-background border border-brand/20 rounded-xl shadow-2xl z-50 overflow-hidden'
            >
              <button
                onClick={() => {
                  setOpen(false);
                  onView();
                }}
                className='w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-foreground/5 transition-all'
              >
                <Eye className='w-4 h-4 text-blue-400' /> View Details
              </button>

              {!isReader && (
                <>
                  <button
                    onClick={() => {
                      setOpen(false);
                      onTopUp();
                    }}
                    className='w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-foreground/5 transition-all'
                  >
                    <Plus className='w-4 h-4 text-brand' /> Top Up Credits
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false);
                      onChangePlan();
                    }}
                    className='w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-foreground/5 transition-all'
                  >
                    <Crown className='w-4 h-4 text-brand' /> Change Plan
                  </button>
                </>
              )}

              {isOwner && (
                <>
                  <button
                    onClick={() => {
                      setOpen(false);
                      onManageRole();
                    }}
                    className='w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-foreground/5 transition-all'
                  >
                    <Shield className='w-4 h-4 text-blue-400' /> Manage Role
                  </button>
                  <div className='border-t border-gray-700/50' />
                  <button
                    onClick={() => {
                      setOpen(false);
                      onDelete();
                    }}
                    className='w-full flex items-center gap-3 px-4 py-3 text-sm text-brand hover:text-brand hover:bg-brand/10 transition-all'
                  >
                    <Trash2 className='w-4 h-4' /> Delete User
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Helper Functions ─────────────────────────────────────────────────────
function getTierIcon(tier: string) {
  switch (tier) {
    case "Ultimate":
      return <Crown className='w-4 h-4 text-purple-400' />;
    case "Pro":
      return <Zap className='w-4 h-4 text-blue-400' />;
    case "Basics":
      return <Star className='w-4 h-4 text-brand' />;
    default:
      return <User className='w-4 h-4 text-gray-400' />;
  }
}

function getTierBadgeClass(tier: string) {
  switch (tier) {
    case "Ultimate":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "Pro":
      return "bg-brand/20 text-brand border-brand/30";
    case "Basics":
      return "bg-brand/20 text-brand border-brand/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "bg-brand/20 text-brand border-brand/30";
    case "inactive":
      return "bg-red-500/20 text-red-500 border-red-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function AdminUsers() {
  const { activities, loading, error, refetch } = useUserActivities();
  const {
    topUpCredits,
    changeSubscription,
    deleteUser,
    updateUserRole,
    removeUserRole,
    fetchPlans,
    fetchUserTransactions,
  } = useAdminActions();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterTier, setFilterTier] = useState<
    "all" | "Free" | "Basics" | "Pro" | "Ultimate"
  >("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Dialog states
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showManageRole, setShowManageRole] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [callerSubRole, setCallerSubRole] = useState<'owner' | 'editor' | 'reader' | null>(null);

  // Fetch current admin's subrole on mount
  useEffect(() => {
    const fetchCallerSubRole = async () => {
      const subRole = await getCurrentUserAdminSubRole();
      setCallerSubRole(subRole);
    };
    fetchCallerSubRole();
  }, []);

  // Data for dialogs
  const [plans, setPlans] = useState<any[]>([]);
  const [userTransactions, setUserTransactions] = useState<CreditTransaction[]>(
    [],
  );
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const openManageRole = (user: any) => {
    setSelectedUser(user);
    setShowManageRole(true);
  };

  const handleManageRoleConfirm = async (
    role: "admin" | "user" | "creator",
    subRole: "owner" | "editor" | "reader" | null
  ) => {
    if (!selectedUser) return;
    setActionLoading(true);
    const result = await updateUserRole(selectedUser.id, role, subRole);
    setActionLoading(false);
    if (result.success) {
      setShowManageRole(false);
      refetch();
    }
  };

  // Filter and sort data
  const filteredActivities = activities
    .filter((user) => {
      const matchesSearch =
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ??
          false);
      const matchesTier =
        filterTier === "all" || user.subscription_tier === filterTier;
      const matchesStatus =
        filterStatus === "all" || user.status === filterStatus;
      return matchesSearch && matchesTier && matchesStatus;
    })
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const modifier = sortOrder === "asc" ? 1 : -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal) * modifier;
      }
      return ((aVal as number) - (bVal as number)) * modifier;
    });

  // Open user detail panel with transaction loading
  const openUserDetail = async (user: any) => {
    setSelectedUser(user);
    setShowDetail(true);
    setLoadingTransactions(true);
    const txs = await fetchUserTransactions(user.id);
    setUserTransactions(txs);
    setLoadingTransactions(false);
  };

  // Open top up dialog
  const openTopUp = (user: any) => {
    setSelectedUser(user);
    setShowTopUp(true);
  };

  // Open change plan dialog
  const openChangePlan = async (user: any) => {
    setSelectedUser(user);
    setShowChangePlan(true);
    if (plans.length === 0) {
      const p = await fetchPlans();
      setPlans(p);
    }
  };

  // Open delete confirmation
  const openDelete = (user: any) => {
    setSelectedUser(user);
    setShowDeleteConfirm(true);
  };

  // Handle top up confirm
  const handleTopUpConfirm = async (amount: number, description: string) => {
    if (!selectedUser) return;
    setActionLoading(true);
    const result = await topUpCredits(selectedUser.id, amount, description);
    setActionLoading(false);
    if (result.success) {
      setShowTopUp(false);
      setShowDetail(false);
      refetch();
    }
  };

  // Handle change plan confirm
  const handleChangePlanConfirm = async (planId: string, planName: string) => {
    if (!selectedUser) return;
    setActionLoading(true);
    const result = await changeSubscription(selectedUser.id, planId, planName);
    setActionLoading(false);
    if (result.success) {
      setShowChangePlan(false);
      setShowDetail(false);
      refetch();
    }
  };

  // Handle delete confirm
  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    const result = await deleteUser(selectedUser.id);
    setActionLoading(false);
    if (result.success) {
      setShowDeleteConfirm(false);
      setShowDetail(false);
      refetch();
    }
  };

  // CSV export
  const exportCSV = () => {
    const headers = [
      "Email",
      "Name",
      "Tier",
      "Status",
      "Credits",
      "Used",
      "Searches",
      "Auto Applies",
      "Last Updated",
    ];
    const rows = filteredActivities.map((u) => [
      u.email,
      u.full_name || "",
      u.subscription_tier,
      u.status,
      u.credits_balance,
      u.credits_consumed,
      u.job_searches,
      u.auto_applies,
      new Date(u.updated_at).toLocaleDateString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobraker-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <div className='text-center'>
          <Loader2 className='w-12 h-12 text-brand animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-brand/20 border border-brand rounded-xl p-6'>
        <p className='text-brand'>Error loading users: {error}</p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-white mb-2'>
            User Management
          </h1>
          <p className='text-gray-400'>Manage and analyze user accounts</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => refetch()}
          className='p-2.5 rounded-xl border border-brand/30 text-brand hover:bg-brand/10 transition-all'
          title='Refresh'
        >
          <RefreshCw className='w-5 h-5' />
        </motion.button>
      </div>

      {/* Filters Bar */}
      <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20'>
        <CardContent className='p-6'>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            {/* Search */}
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
              <input
                type='text'
                placeholder='Search users...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-brand focus:outline-none transition-colors'
              />
            </div>

            {/* Tier Filter */}
            <div className='relative'>
              <Filter className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
              <select
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value as any)}
                className='w-full pl-10 pr-10 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white appearance-none focus:border-brand focus:outline-none transition-colors cursor-pointer'
              >
                <option value='all'>All Tiers</option>
                <option value='Free'>Free</option>
                <option value='Basics'>Basics</option>
                <option value='Pro'>Pro</option>
                <option value='Ultimate'>Ultimate</option>
              </select>
              <ChevronDown className='absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none' />
            </div>

            {/* Status Filter */}
            <div className='relative'>
              <Filter className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className='w-full pl-10 pr-10 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white appearance-none focus:border-brand focus:outline-none transition-colors cursor-pointer'
              >
                <option value='all'>All Status</option>
                <option value='active'>Active</option>
                <option value='inactive'>Inactive</option>
              </select>
              <ChevronDown className='absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none' />
            </div>

            {/* Export Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={exportCSV}
              className='flex items-center justify-center gap-2 px-4 py-3 bg-brand text-black font-medium rounded-xl hover:brightness-110 hover:shadow-lg hover:shadow-brand/20 transition-all'
            >
              <Download className='w-5 h-5' />
              Export CSV
            </motion.button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20'>
          <CardContent className='p-4'>
            <p className='text-sm text-gray-400 mb-1'>Total Users</p>
            <p className='text-2xl font-bold text-white'>{activities.length}</p>
          </CardContent>
        </Card>
        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20'>
          <CardContent className='p-4'>
            <p className='text-sm text-gray-400 mb-1'>Active Users</p>
            <p className='text-2xl font-bold text-brand'>
              {activities.filter((u) => u.status === "active").length}
            </p>
          </CardContent>
        </Card>
        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20'>
          <CardContent className='p-4'>
            <p className='text-sm text-gray-400 mb-1'>Paid Users</p>
            <p className='text-2xl font-bold text-brand'>
              {activities.filter((u) => u.subscription_tier !== "Free").length}
            </p>
          </CardContent>
        </Card>
        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20'>
          <CardContent className='p-4'>
            <p className='text-sm text-gray-400 mb-1'>Showing</p>
            <p className='text-2xl font-bold text-white'>
              {filteredActivities.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20 overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead className='bg-gray-800/50 border-b border-brand/20'>
              <tr>
                <th
                  onClick={() => handleSort("email")}
                  className='px-6 py-4 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors'
                >
                  <div className='flex items-center gap-2'>
                    <Mail className='w-4 h-4' />
                    User
                    {sortField === "email" &&
                      (sortOrder === "asc" ? (
                        <TrendingUp className='w-4 h-4' />
                      ) : (
                        <TrendingDown className='w-4 h-4' />
                      ))}
                  </div>
                </th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-gray-300'>
                  <div className='flex items-center gap-2'>
                    <Crown className='w-4 h-4' />
                    Tier
                  </div>
                </th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-gray-300'>
                  Status
                </th>
                <th
                  onClick={() => handleSort("credits_balance")}
                  className='px-6 py-4 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors'
                >
                  <div className='flex items-center justify-end gap-2'>
                    Credits
                    {sortField === "credits_balance" &&
                      (sortOrder === "asc" ? (
                        <TrendingUp className='w-4 h-4' />
                      ) : (
                        <TrendingDown className='w-4 h-4' />
                      ))}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("job_searches")}
                  className='px-6 py-4 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors'
                >
                  <div className='flex items-center justify-end gap-2'>
                    Searches
                    {sortField === "job_searches" &&
                      (sortOrder === "asc" ? (
                        <TrendingUp className='w-4 h-4' />
                      ) : (
                        <TrendingDown className='w-4 h-4' />
                      ))}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("auto_applies")}
                  className='px-6 py-4 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors'
                >
                  <div className='flex items-center justify-end gap-2'>
                    Auto Applies
                    {sortField === "auto_applies" &&
                      (sortOrder === "asc" ? (
                        <TrendingUp className='w-4 h-4' />
                      ) : (
                        <TrendingDown className='w-4 h-4' />
                      ))}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("updated_at")}
                  className='px-6 py-4 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors'
                >
                  <div className='flex items-center gap-2'>
                    <Calendar className='w-4 h-4' />
                    Last Updated
                    {sortField === "updated_at" &&
                      (sortOrder === "asc" ? (
                        <TrendingUp className='w-4 h-4' />
                      ) : (
                        <TrendingDown className='w-4 h-4' />
                      ))}
                  </div>
                </th>
                <th className='px-4 py-4 text-center text-sm font-semibold text-gray-300'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-800'>
              {filteredActivities.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className='hover:bg-gray-800/30 transition-colors cursor-pointer group'
                  onClick={() => openUserDetail(user)}
                >
                  <td className='px-6 py-4'>
                    <div>
                      <div className='flex items-center gap-2'>
                        <p className='text-white font-medium group-hover:text-brand transition-colors'>
                          {user.email}
                        </p>
                      </div>
                      <div className='flex flex-wrap gap-1 mt-1'>
                        {renderUserRoleBadges(user)}
                      </div>
                      {user.full_name && (
                        <p className='text-sm text-gray-400 mt-1'>
                          {user.full_name}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className='px-6 py-4'>
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-sm font-medium ${getTierBadgeClass(user.subscription_tier)}`}
                    >
                      {getTierIcon(user.subscription_tier)}
                      {user.subscription_tier}
                    </div>
                  </td>
                  <td className='px-6 py-4'>
                    <span
                      className={`inline-flex px-3 py-1 rounded-lg border text-sm font-medium ${getStatusBadgeClass(user.status)}`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className='px-6 py-4 text-right'>
                    <p className='text-white font-medium'>
                      {user.credits_balance}
                    </p>
                    <p className='text-xs text-gray-400'>
                      {user.credits_consumed} used
                    </p>
                  </td>
                  <td className='px-6 py-4 text-right text-white font-medium'>
                    {user.job_searches}
                  </td>
                  <td className='px-6 py-4 text-right text-white font-medium'>
                    {user.auto_applies}
                  </td>
                  <td className='px-6 py-4 text-gray-400 text-sm'>
                    {new Date(user.updated_at).toLocaleDateString()}
                  </td>
                  <td
                    className='px-4 py-4 text-center'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowActions
                      onView={() => openUserDetail(user)}
                      onTopUp={() => openTopUp(user)}
                      onChangePlan={() => openChangePlan(user)}
                      onDelete={() => openDelete(user)}
                      onManageRole={() => openManageRole(user)}
                      isOwner={callerSubRole === "owner"}
                      isReader={callerSubRole === "reader"}
                    />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredActivities.length === 0 && (
          <div className='py-12 text-center'>
            <p className='text-gray-400'>
              No users found matching your filters
            </p>
          </div>
        )}
      </Card>

      {/* ── Dialogs & Panels ── */}
      <UserDetailPanel
        user={selectedUser}
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        onTopUp={() => {
          setShowDetail(false);
          setTimeout(() => openTopUp(selectedUser), 200);
        }}
        onChangePlan={() => {
          setShowDetail(false);
          setTimeout(() => openChangePlan(selectedUser), 200);
        }}
        onDelete={() => {
          setShowDetail(false);
          setTimeout(() => openDelete(selectedUser), 200);
        }}
        onManageRole={() => {
          setShowDetail(false);
          setTimeout(() => openManageRole(selectedUser), 200);
        }}
        isOwner={callerSubRole === "owner"}
        isReader={callerSubRole === "reader"}
        transactions={userTransactions}
        loadingTransactions={loadingTransactions}
      />

      <TopUpDialog
        user={selectedUser}
        isOpen={showTopUp}
        onClose={() => setShowTopUp(false)}
        onConfirm={handleTopUpConfirm}
        loading={actionLoading}
      />

      <ChangePlanDialog
        user={selectedUser}
        isOpen={showChangePlan}
        onClose={() => setShowChangePlan(false)}
        onConfirm={handleChangePlanConfirm}
        plans={plans}
        loading={actionLoading}
      />

      <DeleteUserDialog
        user={selectedUser}
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        loading={actionLoading}
      />

      <ManageRoleDialog
        user={selectedUser}
        isOpen={showManageRole}
        onClose={() => setShowManageRole(false)}
        onConfirm={handleManageRoleConfirm}
        loading={actionLoading}
      />
    </div>
  );
}
