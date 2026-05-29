import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabaseClient";
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  Crown,
  Zap,
  Star,
  User,
  DollarSign,
  Users,
  Check,
  X,
  Eye,
  Copy,
  TrendingUp,
  Sparkles,
  FileText,
  MoreVertical,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  Mail,
  Calendar,
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-provider";
import { getCurrentUserAdminSubRole } from "../../../lib/adminUtils";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  credits_per_month: number;
  billing_cycle: string;
  features: string[];
  is_active: boolean;
  max_resumes?: number;
  max_cover_letters?: number;
  created_at: string;
  updated_at: string;
  subscriber_count?: number;
}

interface SubscriberInfo {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  plan_name: string;
  plan_id: string;
  status: string;
  created_at: string;
  current_period_end: string | null;
}

export default function AdminSubscriptions() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: showError } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    null,
  );
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({
    name: "",
    description: "",
    price: 0,
    credits_per_month: 0,
    billing_cycle: "monthly",
    features: [],
    is_active: true,
  });

  // Subscriber management state
  const [subscribers, setSubscribers] = useState<SubscriberInfo[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [subscriberPlanFilter, setSubscriberPlanFilter] =
    useState<string>("all");
  const [selectedSubscriber, setSelectedSubscriber] =
    useState<SubscriberInfo | null>(null);
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [subscriberActionLoading, setSubscriberActionLoading] = useState(false);
  const [callerSubRole, setCallerSubRole] = useState<'owner' | 'editor' | 'reader' | null>(null);

  useEffect(() => {
    const fetchCallerSubRole = async () => {
      const subRole = await getCurrentUserAdminSubRole();
      setCallerSubRole(subRole);
    };
    fetchCallerSubRole();
    fetchPlans();
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      setLoadingSubscribers(true);
      const { data: subs, error: subsError } = await supabase
        .from("user_subscriptions")
        .select(
          "id, user_id, subscription_plan_id, status, created_at, current_period_end, subscription_plans(name)",
        )
        .order("created_at", { ascending: false });

      if (subsError) throw subsError;

      // Fetch profile info for each subscriber
      const subscriberList: SubscriberInfo[] = await Promise.all(
        (subs || []).map(async (sub: any) => {
          let email = `user-${sub.user_id.substring(0, 8)}@jobraker.com`;
          let full_name: string | null = null;

          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", sub.user_id)
              .maybeSingle();
            if (profile) {
              full_name =
                [profile.first_name, profile.last_name]
                  .filter(Boolean)
                  .join(" ") || null;
            }
          } catch (e) {
            /* ignore */
          }

          try {
            const { data: userData } = await supabase
              .rpc("get_user_email", { user_id: sub.user_id })
              .single();
            if (userData && (userData as any).email)
              email = (userData as any).email;
          } catch (e) {
            /* RPC function doesn't exist */
          }

          const planName =
            sub.subscription_plans && !Array.isArray(sub.subscription_plans)
              ? (sub.subscription_plans as any).name
              : "Unknown";

          return {
            id: sub.id,
            user_id: sub.user_id,
            email,
            full_name,
            plan_name: planName,
            plan_id: sub.subscription_plan_id,
            status: sub.status,
            created_at: sub.created_at,
            current_period_end: sub.current_period_end,
          };
        }),
      );

      setSubscribers(subscriberList);
    } catch (err: any) {
      console.error("Error fetching subscribers:", err);
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const handleChangeSubscriberPlan = async (
    subscriber: SubscriberInfo,
    newPlanId: string,
    newPlanName: string,
  ) => {
    try {
      setSubscriberActionLoading(true);
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { error } = await supabase
        .from("user_subscriptions")
        .update({
          subscription_plan_id: newPlanId,
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriber.id);

      if (error) throw error;
      success(`Subscriber moved to ${newPlanName}`);
      setShowChangePlanDialog(false);
      setSelectedSubscriber(null);
      fetchSubscribers();
      fetchPlans();
    } catch (err: any) {
      showError("Failed to change plan: " + err.message);
    } finally {
      setSubscriberActionLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriber: SubscriberInfo) => {
    try {
      setSubscriberActionLoading(true);
      const { error } = await supabase
        .from("user_subscriptions")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("id", subscriber.id);

      if (error) throw error;
      success("Subscription canceled");
      setShowCancelDialog(false);
      setSelectedSubscriber(null);
      fetchSubscribers();
      fetchPlans();
    } catch (err: any) {
      showError("Failed to cancel: " + err.message);
    } finally {
      setSubscriberActionLoading(false);
    }
  };

  const filteredSubscribers = subscribers.filter((s) => {
    const matchesSearch =
      s.email.toLowerCase().includes(subscriberSearch.toLowerCase()) ||
      (s.full_name?.toLowerCase().includes(subscriberSearch.toLowerCase()) ??
        false);
    const matchesPlan =
      subscriberPlanFilter === "all" || s.plan_name === subscriberPlanFilter;
    return matchesSearch && matchesPlan;
  });

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price", { ascending: true });

      if (error) throw error;

      // Fetch subscriber counts for each plan
      const plansWithCounts = await Promise.all(
        (data || []).map(async (plan) => {
          let subscriberCount = 0;

          try {
            // Try to get count of active subscriptions for this plan
            const { count: activeCount, error: subsError } = await supabase
              .from("user_subscriptions")
              .select("*", { count: "exact", head: false })
              .eq("subscription_plan_id", plan.id)
              .eq("status", "active")
              .gt("current_period_end", new Date().toISOString());

            if (!subsError && activeCount) {
              subscriberCount = activeCount;
            }
          } catch (err) {
            console.warn("Could not fetch user_subscriptions:", err);
          }

          // Ensure features is always an array of strings
          const features = Array.isArray(plan.features)
            ? plan.features.map((f: any) =>
                typeof f === "string"
                  ? f
                  : f.name || f.value || JSON.stringify(f),
              )
            : [];

          return {
            ...plan,
            features,
            subscriber_count: subscriberCount,
          };
        }),
      );

      setPlans(plansWithCounts);
    } catch (err: any) {
      console.error("Error fetching plans:", err);
      showError("Failed to load subscription plans");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const { error } = await supabase
        .from("subscription_plans")
        .insert([formData]);

      if (error) throw error;

      success("Subscription plan created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
      fetchPlans();
    } catch (err: any) {
      console.error("Error creating plan:", err);
      showError("Failed to create plan: " + err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selectedPlan) return;

    try {
      // Remove subscriber_count and any other computed fields
      const { subscriber_count, created_at, updated_at, ...updateData } =
        formData;

      // Ensure features is properly formatted as an array
      const dataToUpdate = {
        ...updateData,
        features: Array.isArray(updateData.features) ? updateData.features : [],
      };

      console.log("Updating plan with data:", dataToUpdate);

      const { error, data } = await supabase
        .from("subscription_plans")
        .update(dataToUpdate)
        .eq("id", selectedPlan.id)
        .select();

      if (error) throw error;

      console.log("Update successful:", data);
      success("Subscription plan updated successfully");
      setIsEditDialogOpen(false);
      setSelectedPlan(null);
      resetForm();
      fetchPlans();
    } catch (err: any) {
      console.error("Error updating plan:", err);
      showError("Failed to update plan: " + err.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedPlan) return;

    try {
      const { error } = await supabase
        .from("subscription_plans")
        .delete()
        .eq("id", selectedPlan.id);

      if (error) throw error;

      success("Subscription plan deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedPlan(null);
      fetchPlans();
    } catch (err: any) {
      console.error("Error deleting plan:", err);
      showError("Failed to delete plan: " + err.message);
    }
  };

  const handleDuplicate = async (plan: SubscriptionPlan) => {
    const duplicated = {
      ...plan,
      name: `${plan.name} (Copy)`,
      id: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
    setFormData(duplicated);
    setIsCreateDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: 0,
      credits_per_month: 0,
      billing_cycle: "monthly",
      features: [],
      is_active: true,
    });
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    // Remove subscriber_count and ensure features is an array
    const { subscriber_count, ...planData } = plan;
    setFormData({
      ...planData,
      features: Array.isArray(plan.features) ? plan.features : [],
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setIsViewDialogOpen(true);
  };

  const openDeleteDialog = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setIsDeleteDialogOpen(true);
  };

  const getTierIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case "ultimate":
        return <Crown className='w-5 h-5 text-purple-400' />;
      case "pro":
        return <Zap className='w-5 h-5 text-blue-400' />;
      case "basics":
        return <Star className='w-5 h-5 text-brand' />;
      default:
        return <User className='w-5 h-5 text-gray-400' />;
    }
  };

  const getTierGradient = (name: string) => {
    switch (name.toLowerCase()) {
      case "ultimate":
        return "from-purple-500/20 to-pink-500/20 border-purple-500/30";
      case "pro":
        return "from-blue-500/20 to-brand/20 border-blue-500/30";
      case "basics":
        return "from-brand/20 to-brand/20 border-brand/30";
      default:
        return "from-gray-500/20 to-gray-600/20 border-gray-500/30";
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <div className='text-center'>
          <Loader2 className='w-12 h-12 text-brand animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-white mb-2'>
            Subscription Plans
          </h1>
          <p className='text-gray-400'>
            Manage pricing tiers and subscription offerings
          </p>
        </div>
        {callerSubRole !== "reader" && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              resetForm();
              setIsCreateDialogOpen(true);
            }}
            className='flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand to-background text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-brand/20 transition-all'
          >
            <Plus className='w-5 h-5' />
            Create Plan
          </motion.button>
        )}
      </div>

      {/* Stats Overview */}
      <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between mb-2'>
              <p className='text-sm text-gray-400'>Total Plans</p>
              <div className='w-10 h-10 rounded-lg bg-brand/20 flex items-center justify-center'>
                <Crown className='w-5 h-5 text-brand' />
              </div>
            </div>
            <p className='text-3xl font-bold text-white'>{plans.length}</p>
            <p className='text-xs text-gray-500 mt-1'>
              {plans.filter((p) => p.is_active).length} active
            </p>
          </CardContent>
        </Card>

        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between mb-2'>
              <p className='text-sm text-gray-400'>Avg. Price</p>
              <div className='w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center'>
                <DollarSign className='w-5 h-5 text-blue-400' />
              </div>
            </div>
            <p className='text-3xl font-bold text-white'>
              $
              {(
                plans.reduce((sum, p) => sum + p.price, 0) / plans.length || 0
              ).toFixed(0)}
            </p>
            <p className='text-xs text-gray-500 mt-1'>per month</p>
          </CardContent>
        </Card>

        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between mb-2'>
              <p className='text-sm text-gray-400'>Avg. Credits</p>
              <div className='w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center'>
                <Zap className='w-5 h-5 text-purple-400' />
              </div>
            </div>
            <p className='text-3xl font-bold text-white'>
              {Math.floor(
                plans.reduce((sum, p) => sum + p.credits_per_month, 0) /
                  plans.length || 0,
              )}
            </p>
            <p className='text-xs text-gray-500 mt-1'>per cycle</p>
          </CardContent>
        </Card>

        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between mb-2'>
              <p className='text-sm text-gray-400'>Total Subscribers</p>
              <div className='w-10 h-10 rounded-lg bg-brand/20 flex items-center justify-center'>
                <Users className='w-5 h-5 text-brand' />
              </div>
            </div>
            <p className='text-3xl font-bold text-white'>
              {plans.reduce((sum, p) => sum + (p.subscriber_count || 0), 0)}
            </p>
            <p className='text-xs text-gray-500 mt-1'>active users</p>
          </CardContent>
        </Card>

        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between mb-2'>
              <p className='text-sm text-gray-400'>MRR</p>
              <div className='w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center'>
                <TrendingUp className='w-5 h-5 text-green-400' />
              </div>
            </div>
            <p className='text-3xl font-bold text-white'>
              $
              {plans
                .reduce((sum, p) => {
                  const monthlyPrice =
                    p.billing_cycle === "yearly" ? p.price / 12 : p.price;
                  return sum + monthlyPrice * (p.subscriber_count || 0);
                }, 0)
                .toFixed(0)}
            </p>
            <p className='text-xs text-gray-500 mt-1'>monthly recurring</p>
          </CardContent>
        </Card>
      </div>

      {/* Plans Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={`group relative overflow-hidden bg-gradient-to-br ${getTierGradient(plan.name)} border transition-all hover:shadow-xl hover:shadow-brand/10 hover:-translate-y-1`}
            >
              <CardContent className='p-6'>
                {/* Header */}
                <div className='flex items-start justify-between mb-4'>
                  <div className='flex items-center gap-3'>
                    <div className='w-12 h-12 rounded-xl bg-background/30 flex items-center justify-center'>
                      {getTierIcon(plan.name)}
                    </div>
                    <div>
                      <h3 className='text-xl font-bold text-white'>
                        {plan.name}
                      </h3>
                      <p className='text-xs text-gray-400'>
                        {plan.billing_cycle}
                      </p>
                    </div>
                  </div>
                  {!plan.is_active && (
                    <span className='px-2 py-1 text-xs font-medium bg-brand/20 text-brand border border-brand/30 rounded-lg'>
                      Inactive
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className='mb-4'>
                  <div className='flex items-baseline gap-1'>
                    <span className='text-4xl font-bold text-white'>
                      ${plan.price}
                    </span>
                    <span className='text-gray-400'>
                      /{plan.billing_cycle === "monthly" ? "mo" : "yr"}
                    </span>
                  </div>
                  <p className='text-sm text-gray-400 mt-2 line-clamp-2'>
                    {plan.description}
                  </p>
                </div>

                {/* Credits */}
                <div className='flex items-center gap-2 p-3 bg-background/30 rounded-lg mb-4'>
                  <Zap className='w-4 h-4 text-brand' />
                  <span className='text-sm text-white font-medium'>
                    {plan.credits_per_month} credits
                  </span>
                  <span className='text-xs text-gray-500'>per cycle</span>
                </div>

                {/* Features */}
                <div className='space-y-2 mb-4'>
                  {plan.features?.slice(0, 3).map((feature, idx) => (
                    <div key={idx} className='flex items-start gap-2'>
                      <Check className='w-4 h-4 text-brand mt-0.5 flex-shrink-0' />
                      <span className='text-sm text-gray-300 line-clamp-1'>
                        {feature}
                      </span>
                    </div>
                  ))}
                  {(plan.features?.length || 0) > 3 && (
                    <p className='text-xs text-gray-500 pl-6'>
                      +{plan.features.length - 3} more features
                    </p>
                  )}
                </div>

                {/* Subscribers */}
                <div className='flex items-center gap-2 text-sm text-gray-400 mb-4'>
                  <Users className='w-4 h-4' />
                  <span>
                    {plan.subscriber_count || 0} subscriber
                    {plan.subscriber_count !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Actions */}
                <div className={`${callerSubRole === "reader" ? "flex justify-center" : "grid grid-cols-4"} gap-2`}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openViewDialog(plan)}
                    className={`p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex items-center justify-center ${callerSubRole === "reader" ? "w-full max-w-[120px]" : ""}`}
                    title='View Details'
                  >
                    <Eye className='w-4 h-4' />
                  </motion.button>
                  {callerSubRole !== "reader" && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openEditDialog(plan)}
                        className='p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center justify-center'
                        title='Edit'
                      >
                        <Edit className='w-4 h-4' />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleDuplicate(plan)}
                        className='p-2 bg-brand/20 hover:bg-brand/30 text-brand rounded-lg transition-colors flex items-center justify-center'
                        title='Duplicate'
                      >
                        <Copy className='w-4 h-4' />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openDeleteDialog(plan)}
                        className='p-2 bg-brand/20 hover:bg-brand/30 text-brand rounded-lg transition-colors flex items-center justify-center'
                        title='Delete'
                      >
                        <Trash2 className='w-4 h-4' />
                      </motion.button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className='text-center py-12'>
          <Crown className='w-16 h-16 text-gray-600 mx-auto mb-4' />
          <p className='text-gray-400 mb-4'>No subscription plans found</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              resetForm();
              setIsCreateDialogOpen(true);
            }}
            className='px-6 py-3 bg-gradient-to-r from-brand to-background text-black font-semibold rounded-xl'
          >
            Create Your First Plan
          </motion.button>
        </div>
      )}

      {/* ── Subscribers Table ── */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-2xl font-bold text-white'>
              Active Subscribers
            </h2>
            <p className='text-sm text-gray-400'>
              Manage individual user subscriptions
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              fetchSubscribers();
              fetchPlans();
            }}
            className='p-2.5 rounded-xl border border-brand/30 text-brand hover:bg-brand/10 transition-all'
            title='Refresh'
          >
            <RefreshCw className='w-5 h-5' />
          </motion.button>
        </div>

        {/* Subscriber Filters */}
        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20'>
          <CardContent className='p-4'>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  type='text'
                  placeholder='Search subscribers...'
                  value={subscriberSearch}
                  onChange={(e) => setSubscriberSearch(e.target.value)}
                  className='w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-brand focus:outline-none transition-colors'
                />
              </div>
              <div className='relative'>
                <Filter className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <select
                  value={subscriberPlanFilter}
                  onChange={(e) => setSubscriberPlanFilter(e.target.value)}
                  className='w-full pl-10 pr-10 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white appearance-none focus:border-brand focus:outline-none transition-colors cursor-pointer'
                >
                  <option value='all'>All Plans</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className='absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none' />
              </div>
              <div className='flex items-center gap-3 text-sm text-gray-400'>
                <Users className='w-4 h-4' />
                <span>
                  {filteredSubscribers.length} of {subscribers.length}{" "}
                  subscribers
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscribers Table */}
        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20 overflow-hidden'>
          {loadingSubscribers ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='w-8 h-8 text-brand animate-spin' />
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead className='bg-gray-800/50 border-b border-brand/20'>
                  <tr>
                    <th className='px-6 py-4 text-left text-sm font-semibold text-gray-300'>
                      <div className='flex items-center gap-2'>
                        <Mail className='w-4 h-4' /> User
                      </div>
                    </th>
                    <th className='px-6 py-4 text-left text-sm font-semibold text-gray-300'>
                      <div className='flex items-center gap-2'>
                        <Crown className='w-4 h-4' /> Plan
                      </div>
                    </th>
                    <th className='px-6 py-4 text-left text-sm font-semibold text-gray-300'>
                      Status
                    </th>
                    <th className='px-6 py-4 text-left text-sm font-semibold text-gray-300'>
                      <div className='flex items-center gap-2'>
                        <Calendar className='w-4 h-4' /> Subscribed
                      </div>
                    </th>
                    <th className='px-6 py-4 text-left text-sm font-semibold text-gray-300'>
                      Renews
                    </th>
                    <th className='px-4 py-4 text-center text-sm font-semibold text-gray-300'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-800'>
                  {filteredSubscribers.map((sub, idx) => (
                    <motion.tr
                      key={sub.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className='hover:bg-gray-800/30 transition-colors'
                    >
                      <td className='px-6 py-4'>
                        <div>
                          <p className='text-white font-medium'>{sub.email}</p>
                          {sub.full_name && (
                            <p className='text-sm text-gray-400'>
                              {sub.full_name}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className='px-6 py-4'>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-sm font-medium ${getPlanBadgeClass(sub.plan_name)}`}
                        >
                          {getPlanBadgeIcon(sub.plan_name)}
                          {sub.plan_name}
                        </span>
                      </td>
                      <td className='px-6 py-4'>
                        <span
                          className={`inline-flex px-3 py-1 rounded-lg border text-sm font-medium ${
                            sub.status === "active"
                              ? "bg-brand/20 text-brand border-brand/30"
                              : sub.status === "canceled"
                                ? "bg-brand/20 text-brand border-brand/30"
                                : "bg-brand/20 text-brand border-brand/30"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className='px-6 py-4 text-gray-400 text-sm'>
                        {new Date(sub.created_at).toLocaleDateString()}
                      </td>
                      <td className='px-6 py-4 text-gray-400 text-sm'>
                        {sub.current_period_end
                          ? new Date(
                              sub.current_period_end,
                            ).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className='px-4 py-4 text-center'>
                        {callerSubRole === "reader" ? (
                          <span className='text-xs text-gray-500 italic'>No actions</span>
                        ) : (
                          <SubscriberRowActions
                            onChangePlan={() => {
                              setSelectedSubscriber(sub);
                              setShowChangePlanDialog(true);
                            }}
                            onCancel={() => {
                              setSelectedSubscriber(sub);
                              setShowCancelDialog(true);
                            }}
                            isActive={sub.status === "active"}
                          />
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {filteredSubscribers.length === 0 && (
                <div className='py-12 text-center'>
                  <p className='text-gray-400'>No subscribers found</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* View Dialog */}
      <ViewPlanDialog
        plan={selectedPlan}
        isOpen={isViewDialogOpen}
        onClose={() => {
          setIsViewDialogOpen(false);
          setSelectedPlan(null);
        }}
      />

      {/* Create/Edit Dialog */}
      <PlanFormDialog
        isOpen={isCreateDialogOpen || isEditDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          setSelectedPlan(null);
          resetForm();
        }}
        formData={formData}
        setFormData={setFormData}
        onSave={isEditDialogOpen ? handleUpdate : handleCreate}
        isEdit={isEditDialogOpen}
      />

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        plan={selectedPlan}
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setSelectedPlan(null);
        }}
        onConfirm={handleDelete}
      />

      {/* Subscriber Change Plan Dialog */}
      <SubscriberChangePlanDialog
        subscriber={selectedSubscriber}
        isOpen={showChangePlanDialog}
        onClose={() => {
          setShowChangePlanDialog(false);
          setSelectedSubscriber(null);
        }}
        onConfirm={handleChangeSubscriberPlan}
        plans={plans}
        loading={subscriberActionLoading}
      />

      {/* Subscriber Cancel Dialog */}
      <SubscriberCancelDialog
        subscriber={selectedSubscriber}
        isOpen={showCancelDialog}
        onClose={() => {
          setShowCancelDialog(false);
          setSelectedSubscriber(null);
        }}
        onConfirm={() =>
          selectedSubscriber && handleCancelSubscription(selectedSubscriber)
        }
        loading={subscriberActionLoading}
      />
    </div>
  );
}

// View Plan Dialog Component
function ViewPlanDialog({
  plan,
  isOpen,
  onClose,
}: {
  plan: SubscriptionPlan | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!plan || !isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-50 flex items-center justify-center'
    >
      {/* Enhanced Backdrop with gradient */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className='absolute inset-0 bg-gradient-to-br from-black/90 via-purple-900/10 to-black/90 backdrop-blur-md'
        onClick={onClose}
      />

      {/* Dialog Content with glass morphism */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5 }}
        className='relative max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden rounded-3xl'
      >
        {/* Animated gradient border glow */}
        <div className='absolute -inset-1 bg-gradient-to-r from-brand/20 via-brand/20 to-purple-500/20 rounded-3xl blur-2xl animate-pulse' />

        <div className='relative bg-gradient-to-br from-background/95 via-[#111111]/95 to-background/95 backdrop-blur-xl border border-brand/20 rounded-3xl overflow-y-auto max-h-[90vh] shadow-2xl'>
          {/* Sticky Header with glass effect */}
          <div className='sticky top-0 z-10 bg-gradient-to-br from-background/98 via-[#111111]/98 to-background/98 backdrop-blur-xl border-b border-brand/20 p-6'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-4'>
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className='w-14 h-14 rounded-2xl bg-gradient-to-br from-brand/20 to-brand/20 flex items-center justify-center backdrop-blur-sm border border-brand/30 shadow-lg shadow-brand/20'
                >
                  <Crown className='w-7 h-7 text-brand' />
                </motion.div>
                <div>
                  <h2 className='text-3xl font-bold bg-gradient-to-r from-white via-brand to-brand bg-clip-text text-transparent'>
                    {plan.name}
                  </h2>
                  <p className='text-sm text-gray-400 flex items-center gap-2 mt-1'>
                    <Sparkles className='w-3 h-3 text-brand' />
                    Complete plan details and configuration
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className='p-2.5 hover:bg-foreground/5 rounded-xl transition-all duration-200 border border-transparent hover:border-brand/30 group'
              >
                <X className='w-5 h-5 group-hover:text-brand transition-colors' />
              </motion.button>
            </div>
          </div>

          <div className='p-8 space-y-6 text-white'>
            {/* Pricing Info with enhanced cards */}
            <div className='grid grid-cols-2 gap-4'>
              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                className='p-5 bg-gradient-to-br from-black/40 to-purple-900/20 rounded-2xl border border-purple-500/30 backdrop-blur-sm relative overflow-hidden group'
              >
                <div className='absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000' />
                <p className='text-sm text-gray-400 mb-1 flex items-center gap-2'>
                  <DollarSign className='w-4 h-4' />
                  Price
                </p>
                <p className='text-3xl font-bold text-white'>${plan.price}</p>
                <p className='text-xs text-gray-500 mt-1'>
                  {plan.billing_cycle}
                </p>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                className='p-5 bg-gradient-to-br from-black/40 to-brand/10 rounded-2xl border border-brand/30 backdrop-blur-sm relative overflow-hidden group'
              >
                <div className='absolute inset-0 bg-gradient-to-r from-transparent via-brand/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000' />
                <p className='text-sm text-gray-400 mb-1 flex items-center gap-2'>
                  <Zap className='w-4 h-4 text-brand' />
                  Credits
                </p>
                <p className='text-3xl font-bold text-brand'>
                  {plan.credits_per_month}
                </p>
                <p className='text-xs text-gray-500 mt-1'>per cycle</p>
              </motion.div>
            </div>

            {/* Description with enhanced styling */}
            <div className='p-5 bg-gradient-to-br from-black/30 to-blue-900/10 rounded-2xl border border-blue-500/20'>
              <h4 className='text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2'>
                <FileText className='w-4 h-4 text-blue-400' />
                Description
              </h4>
              <p className='text-white leading-relaxed'>{plan.description}</p>
            </div>

            {/* Features with enhanced styling */}
            <div>
              <h4 className='text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2'>
                <Sparkles className='w-4 h-4 text-brand' />
                Features Included
              </h4>
              <div className='grid grid-cols-1 gap-3'>
                {plan.features?.map((feature, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.02, x: 4 }}
                    className='flex items-start gap-3 p-3 bg-gradient-to-r from-black/40 to-brand/5 rounded-xl border border-brand/20 backdrop-blur-sm group'
                  >
                    <div className='w-5 h-5 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform'>
                      <Check className='w-3 h-3 text-brand' />
                    </div>
                    <span className='text-sm text-gray-200'>{feature}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Limits with enhanced cards */}
            {(plan.max_resumes || plan.max_cover_letters) && (
              <div>
                <h4 className='text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2'>
                  <TrendingUp className='w-4 h-4 text-brand' />
                  Usage Limits
                </h4>
                <div className='grid grid-cols-2 gap-4'>
                  {plan.max_resumes && (
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className='p-4 bg-gradient-to-br from-black/40 to-brand/20 rounded-xl border border-brand/30 backdrop-blur-sm'
                    >
                      <p className='text-xs text-gray-400 mb-2'>Max Resumes</p>
                      <p className='text-2xl font-bold text-brand'>
                        {plan.max_resumes}
                      </p>
                    </motion.div>
                  )}
                  {plan.max_cover_letters && (
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className='p-4 bg-gradient-to-br from-black/40 to-purple-900/20 rounded-xl border border-purple-500/30 backdrop-blur-sm'
                    >
                      <p className='text-xs text-gray-400 mb-2'>
                        Max Cover Letters
                      </p>
                      <p className='text-2xl font-bold text-purple-400'>
                        {plan.max_cover_letters}
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Status & Dates with enhanced styling */}
            <div className='grid grid-cols-2 gap-4 pt-6 border-t border-gray-700/50'>
              <div className='p-4 bg-gradient-to-br from-black/30 to-transparent rounded-xl border border-gray-700/30'>
                <p className='text-xs text-gray-400 mb-2'>Status</p>
                <div className='flex items-center gap-2'>
                  {plan.is_active ? (
                    <>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className='w-2.5 h-2.5 rounded-full bg-brand shadow-lg shadow-brand/50'
                      />
                      <span className='text-sm text-brand font-semibold'>
                        Active
                      </span>
                    </>
                  ) : (
                    <>
                      <div className='w-2.5 h-2.5 rounded-full bg-brand/100' />
                      <span className='text-sm text-brand font-semibold'>
                        Inactive
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className='p-4 bg-gradient-to-br from-black/30 to-transparent rounded-xl border border-gray-700/30'>
                <p className='text-xs text-gray-400 mb-2'>Created</p>
                <p className='text-sm text-white font-medium'>
                  {new Date(plan.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Close Button with enhanced styling */}
            {/* Close Button with enhanced styling */}
            <div className='flex justify-end pt-6 border-t border-gray-700/50'>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className='px-8 py-3.5 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-semibold transition-all duration-200 border border-gray-700 hover:border-gray-600 shadow-lg'
              >
                Close
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Plan Form Dialog Component
function PlanFormDialog({
  isOpen,
  onClose,
  formData,
  setFormData,
  onSave,
  isEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  formData: Partial<SubscriptionPlan>;
  setFormData: (data: Partial<SubscriptionPlan>) => void;
  onSave: () => void;
  isEdit: boolean;
}) {
  const [featureInput, setFeatureInput] = useState("");

  const addFeature = () => {
    if (featureInput.trim()) {
      const updatedFeatures = [
        ...(formData.features || []),
        featureInput.trim(),
      ];
      console.log("Adding feature, new features array:", updatedFeatures);
      setFormData({
        ...formData,
        features: updatedFeatures,
      });
      setFeatureInput("");
    }
  };

  const removeFeature = (index: number) => {
    const updatedFeatures = (formData.features || []).filter(
      (_, i) => i !== index,
    );
    console.log(
      "Removing feature at index",
      index,
      ", new features array:",
      updatedFeatures,
    );
    setFormData({
      ...formData,
      features: updatedFeatures,
    });
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-50 flex items-center justify-center'
    >
      {/* Enhanced Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className='absolute inset-0 bg-gradient-to-br from-black/90 via-blue-900/10 to-black/90 backdrop-blur-md'
        onClick={onClose}
      />

      {/* Dialog Content with animations */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5 }}
        className='relative max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden rounded-3xl'
      >
        {/* Animated gradient border glow */}
        <div className='absolute -inset-1 bg-gradient-to-r from-blue-500/30 via-brand/30 to-purple-500/30 rounded-3xl blur-2xl animate-pulse' />

        <div className='relative bg-gradient-to-br from-background/95 via-[#111111]/95 to-background/95 backdrop-blur-xl border border-blue-500/20 rounded-3xl overflow-y-auto max-h-[90vh] shadow-2xl'>
          {/* Enhanced Sticky Header */}
          <div className='sticky top-0 z-10 bg-gradient-to-br from-background/98 via-[#111111]/98 to-background/98 backdrop-blur-xl border-b border-blue-500/20 p-6'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-4'>
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className='w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-brand/20 flex items-center justify-center backdrop-blur-sm border border-blue-500/30 shadow-lg shadow-blue-500/20'
                >
                  {isEdit ? (
                    <Edit className='w-7 h-7 text-blue-400' />
                  ) : (
                    <Plus className='w-7 h-7 text-brand' />
                  )}
                </motion.div>
                <div>
                  <h2 className='text-3xl font-bold bg-gradient-to-r from-white via-blue-200 to-brand bg-clip-text text-transparent'>
                    {isEdit ? "Edit Subscription Plan" : "Create New Plan"}
                  </h2>
                  <p className='text-sm text-gray-400 flex items-center gap-2 mt-1'>
                    <Sparkles className='w-3 h-3' />
                    {isEdit
                      ? "Update plan details and configuration"
                      : "Configure a new subscription plan for your users"}
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className='p-2.5 hover:bg-foreground/5 rounded-xl transition-all duration-200 border border-transparent hover:border-blue-500/30 group'
              >
                <X className='w-5 h-5 group-hover:text-blue-400 transition-colors' />
              </motion.button>
            </div>
          </div>

          <div className='p-6 space-y-6'>
            {/* Basic Info */}
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-300 mb-2'>
                  Plan Name *
                </label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className='w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-brand focus:outline-none transition-colors'
                  placeholder='e.g., Pro, Ultimate'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-300 mb-2'>
                  Billing Cycle *
                </label>
                <select
                  value={formData.billing_cycle}
                  onChange={(e) =>
                    setFormData({ ...formData, billing_cycle: e.target.value })
                  }
                  className='w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-brand focus:outline-none transition-colors'
                >
                  <option value='monthly'>Monthly</option>
                  <option value='yearly'>Yearly</option>
                  <option value='lifetime'>Lifetime</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className='block text-sm font-medium text-gray-300 mb-2'>
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                className='w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-brand focus:outline-none transition-colors resize-none'
                placeholder='Brief description of the plan...'
              />
            </div>

            {/* Pricing & Credits */}
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-300 mb-2'>
                  Price ($) *
                </label>
                <input
                  type='number'
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price: parseFloat(e.target.value),
                    })
                  }
                  className='w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-brand focus:outline-none transition-colors'
                  placeholder='0.00'
                  step='0.01'
                  min='0'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-300 mb-2'>
                  Credits per Month *
                </label>
                <input
                  type='number'
                  value={formData.credits_per_month}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      credits_per_month: parseInt(e.target.value),
                    })
                  }
                  className='w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-brand focus:outline-none transition-colors'
                  placeholder='0'
                  min='0'
                />
              </div>
            </div>

            {/* Limits */}
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-300 mb-2'>
                  Max Resumes (optional)
                </label>
                <input
                  type='number'
                  value={formData.max_resumes || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_resumes: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  className='w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-brand focus:outline-none transition-colors'
                  placeholder='Unlimited'
                  min='0'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-300 mb-2'>
                  Max Cover Letters (optional)
                </label>
                <input
                  type='number'
                  value={formData.max_cover_letters || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_cover_letters: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  className='w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-brand focus:outline-none transition-colors'
                  placeholder='Unlimited'
                  min='0'
                />
              </div>
            </div>

            {/* Features */}
            <div>
              <label className='block text-sm font-medium text-gray-300 mb-2'>
                Features
              </label>
              <div className='flex gap-2 mb-3'>
                <input
                  type='text'
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addFeature())
                  }
                  className='flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-brand focus:outline-none transition-colors'
                  placeholder='Add a feature...'
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={addFeature}
                  className='px-6 py-3 bg-brand/20 text-brand border border-brand/30 rounded-lg font-medium hover:bg-brand/30 transition-colors'
                >
                  Add
                </motion.button>
              </div>
              <div className='space-y-2 max-h-40 overflow-y-auto'>
                {formData.features?.map((feature, idx) => (
                  <div
                    key={idx}
                    className='flex items-center justify-between p-3 bg-gray-800 rounded-lg group'
                  >
                    <div className='flex items-center gap-2'>
                      <Check className='w-4 h-4 text-brand' />
                      <span className='text-sm text-white'>{feature}</span>
                    </div>
                    <button
                      onClick={() => removeFeature(idx)}
                      className='opacity-0 group-hover:opacity-100 p-1 hover:bg-brand/20 rounded transition-all'
                    >
                      <X className='w-4 h-4 text-brand' />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className='flex items-center gap-3'>
              <input
                type='checkbox'
                id='is_active'
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className='w-5 h-5 rounded border-gray-700 bg-gray-800 text-brand focus:ring-brand focus:ring-offset-0'
              />
              <label
                htmlFor='is_active'
                className='text-sm font-medium text-gray-300 cursor-pointer'
              >
                Plan is active and available for subscription
              </label>
            </div>

            {/* Actions with enhanced buttons */}
            <div className='flex gap-4 pt-6 border-t border-blue-500/20'>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className='flex-1 px-8 py-3.5 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-semibold transition-all duration-200 border border-gray-700 hover:border-gray-600'
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{
                  scale: 1.02,
                  boxShadow: "0 0 30px rgba(29, 255, 0, 0.3)",
                }}
                whileTap={{ scale: 0.98 }}
                onClick={onSave}
                className='flex-1 px-8 py-3.5 bg-gradient-to-r from-brand to-background text-black rounded-xl font-bold hover:shadow-2xl hover:shadow-brand/30 transition-all duration-200 border border-brand/50'
              >
                {isEdit ? "Save Changes" : "Create Plan"}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Delete Confirmation Dialog
function DeleteConfirmDialog({
  plan,
  isOpen,
  onClose,
  onConfirm,
}: {
  plan: SubscriptionPlan | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!plan || !isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-50 flex items-center justify-center'
    >
      {/* Enhanced Backdrop with red tint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className='absolute inset-0 bg-gradient-to-br from-black/90 via-brand/10 to-black/90 backdrop-blur-md'
        onClick={onClose}
      />

      {/* Dialog Content with warning style */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5 }}
        className='relative max-w-md w-full mx-4 overflow-hidden rounded-3xl'
      >
        {/* Pulsing red border glow */}
        <div className='absolute -inset-1 bg-gradient-to-r from-brand/40 via-brand/40 to-brand/40 rounded-3xl blur-2xl animate-pulse' />

        <div className='relative bg-gradient-to-br from-background/95 via-[#1a0a0a]/95 to-background/95 backdrop-blur-xl border border-brand/30 rounded-3xl shadow-2xl'>
          <div className='p-8'>
            {/* Warning Header */}
            <div className='flex items-center gap-4 mb-6'>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className='w-16 h-16 rounded-2xl bg-gradient-to-br from-brand/20 to-brand/20 flex items-center justify-center backdrop-blur-sm border border-brand/30 shadow-lg shadow-brand/20'
              >
                <Trash2 className='w-8 h-8 text-brand' />
              </motion.div>
              <div>
                <h2 className='text-2xl font-bold bg-gradient-to-r from-brand to-brand bg-clip-text text-transparent'>
                  Delete Plan?
                </h2>
                <p className='text-gray-400 text-sm mt-1'>
                  This action cannot be undone
                </p>
              </div>
            </div>

            {/* Warning Message */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className='p-5 bg-gradient-to-br from-brand/10 to-brand/10 border border-brand/30 rounded-2xl mb-6 backdrop-blur-sm'
            >
              <p className='text-sm text-white mb-3 flex items-center gap-2'>
                <Crown className='w-4 h-4 text-brand' />
                Deleting:{" "}
                <span className='font-bold text-brand'>{plan.name}</span>
              </p>
              <p className='text-xs text-gray-300 leading-relaxed'>
                All users subscribed to this plan will need to be migrated to
                another plan. This will affect billing and access.
              </p>
            </motion.div>

            {/* Action Buttons */}
            <div className='flex gap-4'>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className='flex-1 px-6 py-3.5 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-semibold transition-all duration-200 border border-gray-700 hover:border-gray-600'
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{
                  scale: 1.02,
                  boxShadow: "0 0 30px rgba(29, 255, 0, 0.4)",
                }}
                whileTap={{ scale: 0.98 }}
                onClick={onConfirm}
                className='flex-1 px-6 py-3.5 bg-gradient-to-r from-brand to-brand hover:from-brand hover:to-brand text-white rounded-xl font-bold hover:shadow-2xl hover:shadow-brand/30 transition-all duration-200 border border-brand/50'
              >
                Delete Plan
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Subscriber Helpers ───────────────────────────────────────────────────
function getPlanBadgeClass(name: string) {
  switch (name) {
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

function getPlanBadgeIcon(name: string) {
  switch (name) {
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

// ─── Subscriber Row Actions ───────────────────────────────────────────────
function SubscriberRowActions({
  onChangePlan,
  onCancel,
  isActive,
}: {
  onChangePlan: () => void;
  onCancel: () => void;
  isActive: boolean;
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
                  onChangePlan();
                }}
                className='w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-foreground/5 transition-all'
              >
                <ArrowRightLeft className='w-4 h-4 text-brand' /> Change Plan
              </button>
              {isActive && (
                <>
                  <div className='border-t border-gray-700/50' />
                  <button
                    onClick={() => {
                      setOpen(false);
                      onCancel();
                    }}
                    className='w-full flex items-center gap-3 px-4 py-3 text-sm text-brand hover:text-brand hover:bg-brand/10 transition-all'
                  >
                    <Ban className='w-4 h-4' /> Cancel Subscription
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

// ─── Subscriber Change Plan Dialog ────────────────────────────────────────
function SubscriberChangePlanDialog({
  subscriber,
  isOpen,
  onClose,
  onConfirm,
  plans,
  loading,
}: {
  subscriber: SubscriberInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    subscriber: SubscriberInfo,
    planId: string,
    planName: string,
  ) => void;
  plans: SubscriptionPlan[];
  loading: boolean;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState("");

  useEffect(() => {
    setSelectedPlanId("");
  }, [isOpen]);

  if (!isOpen || !subscriber) return null;

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
          <div className='px-6 pt-6 pb-4 border-b border-brand/20'>
            <div className='flex items-center gap-3 mb-2'>
              <div className='w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center'>
                <ArrowRightLeft className='w-5 h-5 text-brand' />
              </div>
              <div>
                <h3 className='text-lg font-bold text-white'>Change Plan</h3>
                <p className='text-sm text-gray-400'>{subscriber.email}</p>
              </div>
            </div>
            <p className='text-sm text-gray-400'>
              Current:{" "}
              <span className='text-brand font-semibold'>
                {subscriber.plan_name}
              </span>
            </p>
          </div>

          <div className='p-6 space-y-3'>
            <label className='text-sm text-gray-400 block mb-1'>
              Select New Plan
            </label>
            {plans
              .filter((p) => p.is_active)
              .map((plan) => (
                <motion.button
                  key={plan.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all ${
                    selectedPlanId === plan.id
                      ? "bg-brand/10 border-brand shadow-lg shadow-brand/10"
                      : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedPlanId === plan.id
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
                      {plan.credits_per_month} credits/{plan.billing_cycle}
                    </p>
                  </div>
                  <p className='text-white font-bold'>${plan.price}</p>
                  {selectedPlanId === plan.id && (
                    <CheckCircle2 className='w-5 h-5 text-brand' />
                  )}
                </motion.button>
              ))}
          </div>

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
                const plan = plans.find((p) => p.id === selectedPlanId);
                if (plan) onConfirm(subscriber, plan.id, plan.name);
              }}
              disabled={loading || !selectedPlanId}
              className='flex-1 px-4 py-3 bg-gradient-to-r from-brand to-brand text-black font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2'
            >
              {loading ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                <ArrowRightLeft className='w-4 h-4' />
              )}
              Change Plan
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Subscriber Cancel Dialog ─────────────────────────────────────────────
function SubscriberCancelDialog({
  subscriber,
  isOpen,
  onClose,
  onConfirm,
  loading,
}: {
  subscriber: SubscriberInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  if (!isOpen || !subscriber) return null;

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
          <div className='px-6 pt-6 pb-4 border-b border-brand/20'>
            <div className='flex items-center gap-3'>
              <div className='w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center'>
                <AlertTriangle className='w-6 h-6 text-brand' />
              </div>
              <div>
                <h3 className='text-lg font-bold text-white'>
                  Cancel Subscription
                </h3>
                <p className='text-sm text-brand'>
                  This will revoke plan access
                </p>
              </div>
            </div>
          </div>

          <div className='p-6'>
            <div className='bg-brand/10 border border-brand/20 rounded-xl p-4'>
              <p className='text-sm text-gray-300'>
                Cancel subscription for{" "}
                <strong className='text-white'>{subscriber.email}</strong> on
                the{" "}
                <strong className='text-white'>{subscriber.plan_name}</strong>{" "}
                plan?
              </p>
              <p className='text-xs text-gray-400 mt-2'>
                The user will lose access to plan features but their credits and
                data will be preserved.
              </p>
            </div>
          </div>

          <div className='px-6 pb-6 flex gap-3'>
            <button
              onClick={onClose}
              className='flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-600 transition-all'
            >
              Keep Active
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onConfirm}
              disabled={loading}
              className='flex-1 px-4 py-3 bg-gradient-to-r from-brand to-brand text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2'
            >
              {loading ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                <Ban className='w-4 h-4' />
              )}
              Cancel Subscription
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
