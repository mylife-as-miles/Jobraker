import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabaseClient';
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
  FileText
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast-provider';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  credits_per_cycle: number;
  billing_cycle: string;
  features: string[];
  is_active: boolean;
  max_resumes?: number;
  max_cover_letters?: number;
  created_at: string;
  updated_at: string;
  subscriber_count?: number;
}

export default function AdminSubscriptions() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: showError } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({
    name: '',
    description: '',
    price: 0,
    credits_per_cycle: 0,
    billing_cycle: 'monthly',
    features: [],
    is_active: true,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price', { ascending: true });

      if (error) throw error;
      
      // Fetch subscriber counts for each plan
      const plansWithCounts = await Promise.all(
        (data || []).map(async (plan) => {
          // Get count of active subscriptions for this plan
          const { count: activeCount } = await supabase
            .from('user_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('plan_id', plan.id)
            .eq('status', 'active');

          // Get count of users with this tier in profiles (fallback)
          const { count: profileCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('subscription_tier', plan.name);

          // Use the higher count (active subscriptions or profile tier)
          const subscriberCount = Math.max(activeCount || 0, profileCount || 0);

          // Ensure features is always an array of strings
          const features = Array.isArray(plan.features) 
            ? plan.features.map((f: any) => typeof f === 'string' ? f : (f.name || f.value || JSON.stringify(f)))
            : [];

          return {
            ...plan,
            features,
            subscriber_count: subscriberCount
          };
        })
      );
      
      setPlans(plansWithCounts);
    } catch (err: any) {
      console.error('Error fetching plans:', err);
      showError('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .insert([formData]);

      if (error) throw error;
      
      success('Subscription plan created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
      fetchPlans();
    } catch (err: any) {
      console.error('Error creating plan:', err);
      showError('Failed to create plan: ' + err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selectedPlan) return;

    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update(formData)
        .eq('id', selectedPlan.id);

      if (error) throw error;
      
      success('Subscription plan updated successfully');
      setIsEditDialogOpen(false);
      setSelectedPlan(null);
      resetForm();
      fetchPlans();
    } catch (err: any) {
      console.error('Error updating plan:', err);
      showError('Failed to update plan: ' + err.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedPlan) return;

    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', selectedPlan.id);

      if (error) throw error;
      
      success('Subscription plan deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedPlan(null);
      fetchPlans();
    } catch (err: any) {
      console.error('Error deleting plan:', err);
      showError('Failed to delete plan: ' + err.message);
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
      name: '',
      description: '',
      price: 0,
      credits_per_cycle: 0,
      billing_cycle: 'monthly',
      features: [],
      is_active: true,
    });
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setFormData(plan);
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
      case 'ultimate': return <Crown className="w-5 h-5 text-purple-400" />;
      case 'pro': return <Zap className="w-5 h-5 text-blue-400" />;
      case 'basics': return <Star className="w-5 h-5 text-yellow-400" />;
      default: return <User className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTierGradient = (name: string) => {
    switch (name.toLowerCase()) {
      case 'ultimate': return 'from-purple-500/20 to-pink-500/20 border-purple-500/30';
      case 'pro': return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30';
      case 'basics': return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30';
      default: return 'from-gray-500/20 to-gray-600/20 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#1dff00] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Subscription Plans</h1>
          <p className="text-gray-400">Manage pricing tiers and subscription offerings</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            resetForm();
            setIsCreateDialogOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-[#1dff00]/20 transition-all"
        >
          <Plus className="w-5 h-5" />
          Create Plan
        </motion.button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border-[#1dff00]/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">Total Plans</p>
              <div className="w-10 h-10 rounded-lg bg-[#1dff00]/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-[#1dff00]" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{plans.length}</p>
            <p className="text-xs text-gray-500 mt-1">{plans.filter(p => p.is_active).length} active</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border-[#1dff00]/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">Avg. Price</p>
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">
              ${(plans.reduce((sum, p) => sum + p.price, 0) / plans.length || 0).toFixed(0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">per month</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border-[#1dff00]/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">Avg. Credits</p>
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">
              {Math.floor(plans.reduce((sum, p) => sum + p.credits_per_cycle, 0) / plans.length || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">per cycle</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border-[#1dff00]/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">Total Subscribers</p>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">
              {plans.reduce((sum, p) => sum + (p.subscriber_count || 0), 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">active users</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border-[#1dff00]/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">MRR</p>
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">
              ${plans.reduce((sum, p) => {
                const monthlyPrice = p.billing_cycle === 'yearly' ? p.price / 12 : p.price;
                return sum + (monthlyPrice * (p.subscriber_count || 0));
              }, 0).toFixed(0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">monthly recurring</p>
          </CardContent>
        </Card>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`group relative overflow-hidden bg-gradient-to-br ${getTierGradient(plan.name)} border transition-all hover:shadow-xl hover:shadow-[#1dff00]/10 hover:-translate-y-1`}>
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-black/30 flex items-center justify-center">
                      {getTierIcon(plan.name)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                      <p className="text-xs text-gray-400">{plan.billing_cycle}</p>
                    </div>
                  </div>
                  {!plan.is_active && (
                    <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg">
                      Inactive
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">${plan.price}</span>
                    <span className="text-gray-400">/{plan.billing_cycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-2 line-clamp-2">{plan.description}</p>
                </div>

                {/* Credits */}
                <div className="flex items-center gap-2 p-3 bg-black/30 rounded-lg mb-4">
                  <Zap className="w-4 h-4 text-[#1dff00]" />
                  <span className="text-sm text-white font-medium">{plan.credits_per_cycle} credits</span>
                  <span className="text-xs text-gray-500">per cycle</span>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-4">
                  {plan.features?.slice(0, 3).map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#1dff00] mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-300 line-clamp-1">{feature}</span>
                    </div>
                  ))}
                  {(plan.features?.length || 0) > 3 && (
                    <p className="text-xs text-gray-500 pl-6">+{plan.features.length - 3} more features</p>
                  )}
                </div>

                {/* Subscribers */}
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                  <Users className="w-4 h-4" />
                  <span>{plan.subscriber_count || 0} subscriber{plan.subscriber_count !== 1 ? 's' : ''}</span>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-4 gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openViewDialog(plan)}
                    className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex items-center justify-center"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openEditDialog(plan)}
                    className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center justify-center"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDuplicate(plan)}
                    className="p-2 bg-[#1dff00]/20 hover:bg-[#1dff00]/30 text-[#1dff00] rounded-lg transition-colors flex items-center justify-center"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openDeleteDialog(plan)}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center justify-center"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12">
          <Crown className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No subscription plans found</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              resetForm();
              setIsCreateDialogOpen(true);
            }}
            className="px-6 py-3 bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-black font-semibold rounded-xl"
          >
            Create Your First Plan
          </motion.button>
        </div>
      )}

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
    </div>
  );
}

// View Plan Dialog Component
function ViewPlanDialog({ 
  plan, 
  isOpen, 
  onClose 
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
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Enhanced Backdrop with gradient */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-gradient-to-br from-black/90 via-purple-900/10 to-black/90 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Dialog Content with glass morphism */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="relative max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden rounded-3xl"
      >
        {/* Animated gradient border glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-[#1dff00]/20 via-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl animate-pulse" />
        
        <div className="relative bg-gradient-to-br from-[#0a0a0a]/95 via-[#111111]/95 to-[#0a0a0a]/95 backdrop-blur-xl border border-[#1dff00]/20 rounded-3xl overflow-y-auto max-h-[90vh] shadow-2xl">
          {/* Sticky Header with glass effect */}
          <div className="sticky top-0 z-10 bg-gradient-to-br from-[#0a0a0a]/98 via-[#111111]/98 to-[#0a0a0a]/98 backdrop-blur-xl border-b border-[#1dff00]/20 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1dff00]/20 to-cyan-500/20 flex items-center justify-center backdrop-blur-sm border border-[#1dff00]/30 shadow-lg shadow-[#1dff00]/20"
                >
                  <Crown className="w-7 h-7 text-[#1dff00]" />
                </motion.div>
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-[#1dff00] to-cyan-400 bg-clip-text text-transparent">
                    {plan.name}
                  </h2>
                  <p className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                    <Sparkles className="w-3 h-3 text-[#1dff00]" />
                    Complete plan details and configuration
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2.5 hover:bg-white/5 rounded-xl transition-all duration-200 border border-transparent hover:border-[#1dff00]/30 group"
              >
                <X className="w-5 h-5 group-hover:text-[#1dff00] transition-colors" />
              </motion.button>
            </div>
          </div>

          <div className="p-8 space-y-6 text-white">
          {/* Pricing Info with enhanced cards */}
          <div className="grid grid-cols-2 gap-4">
            <motion.div 
              whileHover={{ scale: 1.02, y: -2 }}
              className="p-5 bg-gradient-to-br from-black/40 to-purple-900/20 rounded-2xl border border-purple-500/30 backdrop-blur-sm relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <p className="text-sm text-gray-400 mb-1 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Price
              </p>
              <p className="text-3xl font-bold text-white">${plan.price}</p>
              <p className="text-xs text-gray-500 mt-1">{plan.billing_cycle}</p>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.02, y: -2 }}
              className="p-5 bg-gradient-to-br from-black/40 to-[#1dff00]/10 rounded-2xl border border-[#1dff00]/30 backdrop-blur-sm relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#1dff00]/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <p className="text-sm text-gray-400 mb-1 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#1dff00]" />
                Credits
              </p>
              <p className="text-3xl font-bold text-[#1dff00]">{plan.credits_per_cycle}</p>
              <p className="text-xs text-gray-500 mt-1">per cycle</p>
            </motion.div>
          </div>

          {/* Description with enhanced styling */}
          <div className="p-5 bg-gradient-to-br from-black/30 to-blue-900/10 rounded-2xl border border-blue-500/20">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Description
            </h4>
            <p className="text-white leading-relaxed">{plan.description}</p>
          </div>

          {/* Features with enhanced styling */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1dff00]" />
              Features Included
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {plan.features?.map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ scale: 1.02, x: 4 }}
                  className="flex items-start gap-3 p-3 bg-gradient-to-r from-black/40 to-[#1dff00]/5 rounded-xl border border-[#1dff00]/20 backdrop-blur-sm group"
                >
                  <div className="w-5 h-5 rounded-full bg-[#1dff00]/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                    <Check className="w-3 h-3 text-[#1dff00]" />
                  </div>
                  <span className="text-sm text-gray-200">{feature}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Limits with enhanced cards */}
          {(plan.max_resumes || plan.max_cover_letters) && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Usage Limits
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {plan.max_resumes && (
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="p-4 bg-gradient-to-br from-black/40 to-cyan-900/20 rounded-xl border border-cyan-500/30 backdrop-blur-sm"
                  >
                    <p className="text-xs text-gray-400 mb-2">Max Resumes</p>
                    <p className="text-2xl font-bold text-cyan-400">{plan.max_resumes}</p>
                  </motion.div>
                )}
                {plan.max_cover_letters && (
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="p-4 bg-gradient-to-br from-black/40 to-purple-900/20 rounded-xl border border-purple-500/30 backdrop-blur-sm"
                  >
                    <p className="text-xs text-gray-400 mb-2">Max Cover Letters</p>
                    <p className="text-2xl font-bold text-purple-400">{plan.max_cover_letters}</p>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* Status & Dates with enhanced styling */}
          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-700/50">
            <div className="p-4 bg-gradient-to-br from-black/30 to-transparent rounded-xl border border-gray-700/30">
              <p className="text-xs text-gray-400 mb-2">Status</p>
              <div className="flex items-center gap-2">
                {plan.is_active ? (
                  <>
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="w-2.5 h-2.5 rounded-full bg-[#1dff00] shadow-lg shadow-[#1dff00]/50" 
                    />
                    <span className="text-sm text-[#1dff00] font-semibold">Active</span>
                  </>
                ) : (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-sm text-red-400 font-semibold">Inactive</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-black/30 to-transparent rounded-xl border border-gray-700/30">
              <p className="text-xs text-gray-400 mb-2">Created</p>
              <p className="text-sm text-white font-medium">{new Date(plan.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          
          {/* Close Button with enhanced styling */}
          {/* Close Button with enhanced styling */}
          <div className="flex justify-end pt-6 border-t border-gray-700/50">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="px-8 py-3.5 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-semibold transition-all duration-200 border border-gray-700 hover:border-gray-600 shadow-lg"
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
  isEdit
}: {
  isOpen: boolean;
  onClose: () => void;
  formData: Partial<SubscriptionPlan>;
  setFormData: (data: Partial<SubscriptionPlan>) => void;
  onSave: () => void;
  isEdit: boolean;
}) {
  const [featureInput, setFeatureInput] = useState('');

  const addFeature = () => {
    if (featureInput.trim()) {
      setFormData({
        ...formData,
        features: [...(formData.features || []), featureInput.trim()]
      });
      setFeatureInput('');
    }
  };

  const removeFeature = (index: number) => {
    setFormData({
      ...formData,
      features: (formData.features || []).filter((_, i) => i !== index)
    });
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Enhanced Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-gradient-to-br from-black/90 via-blue-900/10 to-black/90 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Dialog Content with animations */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="relative max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden rounded-3xl"
      >
        {/* Animated gradient border glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/30 via-[#1dff00]/30 to-purple-500/30 rounded-3xl blur-2xl animate-pulse" />
        
        <div className="relative bg-gradient-to-br from-[#0a0a0a]/95 via-[#111111]/95 to-[#0a0a0a]/95 backdrop-blur-xl border border-blue-500/20 rounded-3xl overflow-y-auto max-h-[90vh] shadow-2xl">
          {/* Enhanced Sticky Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-br from-[#0a0a0a]/98 via-[#111111]/98 to-[#0a0a0a]/98 backdrop-blur-xl border-b border-blue-500/20 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div 
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-[#1dff00]/20 flex items-center justify-center backdrop-blur-sm border border-blue-500/30 shadow-lg shadow-blue-500/20"
                >
                  {isEdit ? <Edit className="w-7 h-7 text-blue-400" /> : <Plus className="w-7 h-7 text-[#1dff00]" />}
                </motion.div>
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-200 to-[#1dff00] bg-clip-text text-transparent">
                    {isEdit ? 'Edit Subscription Plan' : 'Create New Plan'}
                  </h2>
                  <p className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                    <Sparkles className="w-3 h-3" />
                    {isEdit ? 'Update plan details and configuration' : 'Configure a new subscription plan for your users'}
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2.5 hover:bg-white/5 rounded-xl transition-all duration-200 border border-transparent hover:border-blue-500/30 group"
              >
                <X className="w-5 h-5 group-hover:text-blue-400 transition-colors" />
              </motion.button>
            </div>
          </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Plan Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#1dff00] focus:outline-none transition-colors"
                placeholder="e.g., Pro, Ultimate"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Billing Cycle *</label>
              <select
                value={formData.billing_cycle}
                onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#1dff00] focus:outline-none transition-colors"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#1dff00] focus:outline-none transition-colors resize-none"
              placeholder="Brief description of the plan..."
            />
          </div>

          {/* Pricing & Credits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Price ($) *</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#1dff00] focus:outline-none transition-colors"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Credits per Cycle *</label>
              <input
                type="number"
                value={formData.credits_per_cycle}
                onChange={(e) => setFormData({ ...formData, credits_per_cycle: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#1dff00] focus:outline-none transition-colors"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Resumes (optional)</label>
              <input
                type="number"
                value={formData.max_resumes || ''}
                onChange={(e) => setFormData({ ...formData, max_resumes: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#1dff00] focus:outline-none transition-colors"
                placeholder="Unlimited"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Cover Letters (optional)</label>
              <input
                type="number"
                value={formData.max_cover_letters || ''}
                onChange={(e) => setFormData({ ...formData, max_cover_letters: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#1dff00] focus:outline-none transition-colors"
                placeholder="Unlimited"
                min="0"
              />
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Features</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#1dff00] focus:outline-none transition-colors"
                placeholder="Add a feature..."
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={addFeature}
                className="px-6 py-3 bg-[#1dff00]/20 text-[#1dff00] border border-[#1dff00]/30 rounded-lg font-medium hover:bg-[#1dff00]/30 transition-colors"
              >
                Add
              </motion.button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {formData.features?.map((feature, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg group">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#1dff00]" />
                    <span className="text-sm text-white">{feature}</span>
                  </div>
                  <button
                    onClick={() => removeFeature(idx)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                  >
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-[#1dff00] focus:ring-[#1dff00] focus:ring-offset-0"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-300 cursor-pointer">
              Plan is active and available for subscription
            </label>
          </div>

          {/* Actions with enhanced buttons */}
          <div className="flex gap-4 pt-6 border-t border-blue-500/20">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="flex-1 px-8 py-3.5 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-semibold transition-all duration-200 border border-gray-700 hover:border-gray-600"
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(29, 255, 0, 0.3)" }}
              whileTap={{ scale: 0.98 }}
              onClick={onSave}
              className="flex-1 px-8 py-3.5 bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-black rounded-xl font-bold hover:shadow-2xl hover:shadow-[#1dff00]/30 transition-all duration-200 border border-[#1dff00]/50"
            >
              {isEdit ? 'Save Changes' : 'Create Plan'}
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
  onConfirm
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
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Enhanced Backdrop with red tint */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-gradient-to-br from-black/90 via-red-900/10 to-black/90 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Dialog Content with warning style */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="relative max-w-md w-full mx-4 overflow-hidden rounded-3xl"
      >
        {/* Pulsing red border glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-red-500/40 via-orange-500/40 to-red-500/40 rounded-3xl blur-2xl animate-pulse" />
        
        <div className="relative bg-gradient-to-br from-[#0a0a0a]/95 via-[#1a0a0a]/95 to-[#0a0a0a]/95 backdrop-blur-xl border border-red-500/30 rounded-3xl shadow-2xl">
          <div className="p-8">
            {/* Warning Header */}
            <div className="flex items-center gap-4 mb-6">
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center backdrop-blur-sm border border-red-500/30 shadow-lg shadow-red-500/20"
              >
                <Trash2 className="w-8 h-8 text-red-400" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                  Delete Plan?
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  This action cannot be undone
                </p>
              </div>
            </div>

            {/* Warning Message */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-5 bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-2xl mb-6 backdrop-blur-sm"
            >
              <p className="text-sm text-white mb-3 flex items-center gap-2">
                <Crown className="w-4 h-4 text-red-400" />
                Deleting: <span className="font-bold text-red-300">{plan.name}</span>
              </p>
              <p className="text-xs text-gray-300 leading-relaxed">
                All users subscribed to this plan will need to be migrated to another plan. This will affect billing and access.
              </p>
            </motion.div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="flex-1 px-6 py-3.5 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-semibold transition-all duration-200 border border-gray-700 hover:border-gray-600"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(239, 68, 68, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                onClick={onConfirm}
                className="flex-1 px-6 py-3.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-bold hover:shadow-2xl hover:shadow-red-500/30 transition-all duration-200 border border-red-500/50"
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
