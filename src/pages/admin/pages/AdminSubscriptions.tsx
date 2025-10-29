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
  TrendingUp
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog Content */}
      <div className="relative max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/30 rounded-2xl text-white shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border-b border-[#1dff00]/20 p-6 z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-[#1dff00]/20 flex items-center justify-center">
              <Crown className="w-6 h-6 text-[#1dff00]" />
            </div>
            <h2 className="text-2xl font-bold">{plan.name}</h2>
          </div>
          <p className="text-gray-400 text-sm">View complete plan details and configuration</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Pricing Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-black/30 rounded-lg border border-gray-800">
              <p className="text-sm text-gray-400 mb-1">Price</p>
              <p className="text-2xl font-bold text-white">${plan.price}</p>
              <p className="text-xs text-gray-500">{plan.billing_cycle}</p>
            </div>
            <div className="p-4 bg-black/30 rounded-lg border border-gray-800">
              <p className="text-sm text-gray-400 mb-1">Credits</p>
              <p className="text-2xl font-bold text-[#1dff00]">{plan.credits_per_cycle}</p>
              <p className="text-xs text-gray-500">per cycle</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-sm font-semibold text-gray-400 mb-2">Description</h4>
            <p className="text-white">{plan.description}</p>
          </div>

          {/* Features */}
          <div>
            <h4 className="text-sm font-semibold text-gray-400 mb-3">Features</h4>
            <div className="grid grid-cols-1 gap-2">
              {plan.features?.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-black/20 rounded-lg">
                  <Check className="w-4 h-4 text-[#1dff00] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Limits */}
          {(plan.max_resumes || plan.max_cover_letters) && (
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-3">Limits</h4>
              <div className="grid grid-cols-2 gap-4">
                {plan.max_resumes && (
                  <div className="p-3 bg-black/30 rounded-lg border border-gray-800">
                    <p className="text-xs text-gray-500 mb-1">Max Resumes</p>
                    <p className="text-lg font-bold text-white">{plan.max_resumes}</p>
                  </div>
                )}
                {plan.max_cover_letters && (
                  <div className="p-3 bg-black/30 rounded-lg border border-gray-800">
                    <p className="text-xs text-gray-500 mb-1">Max Cover Letters</p>
                    <p className="text-lg font-bold text-white">{plan.max_cover_letters}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status & Dates */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <div className="flex items-center gap-2">
                {plan.is_active ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-[#1dff00]" />
                    <span className="text-sm text-[#1dff00] font-medium">Active</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-sm text-red-400 font-medium">Inactive</span>
                  </>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Created</p>
              <p className="text-sm text-white">{new Date(plan.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          
          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t border-gray-800">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="px-6 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              Close
            </motion.button>
          </div>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog Content */}
      <div className="relative max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/30 rounded-2xl text-white shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border-b border-[#1dff00]/20 p-6 z-10">
          <h2 className="text-2xl font-bold mb-2">
            {isEdit ? 'Edit Subscription Plan' : 'Create New Plan'}
          </h2>
          <p className="text-gray-400 text-sm">
            {isEdit ? 'Update plan details and configuration' : 'Configure a new subscription plan for your users'}
          </p>
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

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-800">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSave}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-black rounded-lg font-semibold hover:shadow-lg hover:shadow-[#1dff00]/20 transition-all"
            >
              {isEdit ? 'Save Changes' : 'Create Plan'}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog Content */}
      <div className="relative max-w-md w-full mx-4 bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-red-500/30 rounded-2xl text-white shadow-2xl">
        <div className="p-6">
          <h2 className="text-xl font-bold text-red-400 mb-2">Delete Subscription Plan</h2>
          <p className="text-gray-400 text-sm mb-6">
            This action cannot be undone
          </p>

          <div className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-white mb-2">
              You are about to delete <span className="font-bold">{plan.name}</span>
            </p>
            <p className="text-xs text-gray-400">
              All users subscribed to this plan will need to be migrated to another plan.
            </p>
          </div>

                    <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onConfirm}
              className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
            >
              Delete Plan
            </motion.button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
