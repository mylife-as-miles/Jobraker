import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { motion } from "framer-motion";
import { LogOut, User, Bell, Shield, Palette, Globe, CreditCard, Upload, Trash2, Save, RefreshCw, Eye, EyeOff, Download, Settings as SettingsIcon, Plus, Link, Search, Briefcase, ToggleLeft, ToggleRight, Building, Users, Coffee, Car, Rss, GripVertical, Sparkles, Mail, Zap, Crown, Check, ArrowRight, FileText, Clock, Database, Cookie, MapPin, Activity, Share2, AlertTriangle, History, X, TrendingUp, BarChart3, PlayCircle, PauseCircle, MoreVertical, Edit2, ExternalLink } from "lucide-react";
import { useProfileSettings } from "../../../hooks/useProfileSettings";
import { useNotificationSettings } from "../../../hooks/useNotificationSettings";
import { usePrivacySettings } from "../../../hooks/usePrivacySettings";
import { useSecuritySettings } from "../../../hooks/useSecuritySettings";
import { createClient } from "../../../lib/supabaseClient";
import { useAppearanceSettings } from "../../../hooks/useAppearanceSettings";
import { useToast } from "../../../components/ui/toast";
import Modal from "../../../components/ui/modal";
import { validatePassword } from "../../../utils/password";
import { CheckCircle2, XCircle, Linkedin, Github } from "lucide-react";
// Lazy-load ResumeChecker to prevent hook order issues
const ResumeChecker = lazy(() => import("../../../client/components/ResumeChecker").then(module => ({ default: module.ResumeChecker })));
// Lazy-load qrcode to avoid bundler resolution issues during build
let QRCodeLib: any | null = null;
async function getQRCode() {
  if (QRCodeLib) return QRCodeLib;
  QRCodeLib = await import('qrcode');
  return QRCodeLib;
}

export const SettingsPage = (): JSX.Element => {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [showPassword, setShowPassword] = useState(false);
  const defaultJobSources = useMemo(() => ([
    { id: 1, type: "remotive", query: "software engineer", enabled: true },
    { id: 2, type: "remoteok", query: "", enabled: true },
    { id: 3, type: "arbeitnow", query: "typescript", enabled: false },
    { id: 4, type: "linkedin", query: "full stack developer", enabled: true },
    { id: 5, type: "indeed", query: "react developer", enabled: false },
    { id: 6, type: "trulyremote", query: "backend engineer", enabled: false },
  ]), []);
  const [jobSources, setJobSources] = useState(defaultJobSources);
  const { profile, updateProfile, createProfile, refresh: refreshProfile, loading: profileLoading } = useProfileSettings();
  const { settings: notif, updateSettings, createSettings, refresh: refreshNotif, loading: notifLoading } = useNotificationSettings() as any;
  const { 
    settings: privacy, 
    createSettings: createPrivacy, 
    updateSettings: updatePrivacy, 
    refresh: refreshPrivacy, 
    loading: privacyLoading,
    auditLogs: privacyAuditLogs,
    deletionRequests: privacyDeletionRequests,
    createDeletionRequest,
    updateGDPRConsent,
    logPrivacyAction
  } = usePrivacySettings();
  const security = useSecuritySettings();
  const appearance = useAppearanceSettings();
  const appearanceSettings = (appearance as any).settings;
  const appearanceLoading = (appearance as any).loading || false;
  const {
    settings: sec,
    updateSecurity,
    createSecurity,
    refresh: refreshSec,
    enrollTotp,
    verifyTotp,
    disableTotp,
    // extras
    backupCodes,
    generateBackupCodes,
    devices,
    trustDevice,
    revokeDevice,
    // Active sessions
    activeSessions,
    listActiveSessions,
    revokeSession,
    revokeAllOtherSessions,
    // Audit log
    auditLogs,
    listAuditLogs,
    // API keys
    apiKeys,
    createApiKey,
    revokeApiKey,
    deleteApiKey,
  } = security as any;
  const securityLoading = (security as any).loading || false;
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    avatar_url: "",
  });

  // 2FA modal state
  const [open2FA, setOpen2FA] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | undefined>();
  const [totpFactorId, setTotpFactorId] = useState<string | undefined>();
  const [totpCode, setTotpCode] = useState<string>("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  // API Key state
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [newApiKeyExpiry, setNewApiKeyExpiry] = useState<number | undefined>();
  const [newApiKeyIpRestrictions, setNewApiKeyIpRestrictions] = useState<string>("");
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  // IP Management state
  const [newAllowedIp, setNewAllowedIp] = useState("");
  const [newBlockedIp, setNewBlockedIp] = useState("");
  // Backup codes state
  const [generatedBackupCodes, setGeneratedBackupCodes] = useState<string[] | null>(null);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  // Privacy modals state
  const [showDeletionRequestModal, setShowDeletionRequestModal] = useState(false);
  const [deletionRequestType, setDeletionRequestType] = useState<'full_deletion' | 'partial_deletion' | 'anonymization'>('partial_deletion');
  const [deletionRequestReason, setDeletionRequestReason] = useState("");
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([]);
  // Account deletion modal state
  const [showAccountDeletionModal, setShowAccountDeletionModal] = useState(false);
  const [accountDeletionEmail, setAccountDeletionEmail] = useState("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  // Job sources domain state
  const [enabledDefaultDomains, setEnabledDefaultDomains] = useState<Set<string>>(new Set(['remote.co', 'remotive.com', 'remoteok.com', 'jobicy.com', 'levels.fyi']));
  const [userCustomDomains, setUserCustomDomains] = useState<string>("");
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [savingDomains, setSavingDomains] = useState(false);
  const passwordCheck = useMemo(() => validatePassword(formData.newPassword, formData.email), [formData.newPassword, formData.email]);

  // Get user email for account deletion confirmation
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user?.email) {
          setUserEmail(data.user.email);
        }
      } catch (e) {
        console.error('Failed to get user email:', e);
      }
    })();
  }, [supabase]);

  const handleConnectGmail = async () => {
    try {
      const composioConfigId = import.meta.env.VITE_COMPOSIO_GMAIL_CONFIG_ID;
      if (!composioConfigId) {
        toastError("Gmail integration is not configured. Please contact support.");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toastError("Please sign in to connect your Gmail account.");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "composio-gmail-auth",
        {
          body: {
            userId: user.id,
            authConfigId: composioConfigId,
            action: "initiate",
          },
        }
      );

      if (error) {
        throw error;
      }

      const { connectionId, redirectUrl } = data;
      localStorage.setItem("composio-connection-id", connectionId);
      window.open(redirectUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      const errorMessage =
        error.details || (error as Error).message || "An unknown error occurred.";
      toastError("Failed to connect Gmail", errorMessage);
    }
  };

  useEffect(() => {
    const checkGmailConnection = async () => {
      try {
        const composioConfigId = import.meta.env.VITE_COMPOSIO_GMAIL_CONFIG_ID;
        if (!composioConfigId) {
          // Gmail integration not configured - silently skip
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          return;
        }

          const { data, error } = await supabase.functions.invoke(
            "composio-gmail-auth",
            {
              body: {
                userId: user.id,
                authConfigId: composioConfigId,
                action: "status",
              },
            }
          );

          if (error) {
          // Check if it's the "Invalid action" error (means deployed version doesn't support status yet)
          if (error.message?.includes("Invalid action") || error.message?.includes("400")) {
            // Silently fail - the deployed function doesn't support status check yet
            // User will just see the "Connect" button instead of connection status
            return;
          }
            throw error;
          }

        if (data?.isConnected !== undefined) {
          setIsGmailConnected(data.isConnected);
        }
      } catch (error: any) {
        // Only log unexpected errors, not the expected "Invalid action" error
        if (!error.message?.includes("Invalid action") && !error.message?.includes("400")) {
        console.error("Failed to check Gmail connection status:", error);
        }
        // It's okay if this fails, the user will just see the "Connect" button
      }
    };

    checkGmailConnection();
  }, [supabase]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data === "gmail-auth-success") {
        const connectionId = localStorage.getItem("composio-connection-id");
        if (connectionId) {
          try {
            const composioConfigId = import.meta.env.VITE_COMPOSIO_GMAIL_CONFIG_ID;
            if (!composioConfigId) {
              toastError("Gmail integration is not configured. Please contact support.");
              localStorage.removeItem("composio-connection-id");
              return;
            }

            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
              toastError("Please sign in to connect your Gmail account.");
              return;
            }

            await supabase.functions.invoke("composio-gmail-auth", {
              body: {
                userId: user.id,
                authConfigId: composioConfigId,
                action: "verify",
                connectionId: connectionId,
              },
            });
            setIsGmailConnected(true);
            success("Gmail connected successfully!");
            localStorage.removeItem("composio-connection-id");
          } catch (error: any) {
            const errorMessage =
              error.details ||
              (error as Error).message ||
              "An unknown error occurred.";
            toastError("Failed to verify Gmail connection", errorMessage);
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [supabase, success, toastError]);

  const initials = useMemo(() => {
    const a = (formData.firstName || '').trim();
    const b = (formData.lastName || '').trim();
    if (a || b) return `${a.charAt(0) || ''}${b.charAt(0) || ''}`.toUpperCase() || 'U';
    const email = formData.email || '';
    return (email.charAt(0) || 'U').toUpperCase();
  }, [formData.firstName, formData.lastName, formData.email]);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [groupEnabledFirst, setGroupEnabledFirst] = useState(true);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  
  // Billing state
  const [currentCredits, setCurrentCredits] = useState(0);
  const [billingSubscriptionTier, setBillingSubscriptionTier] = useState<'Free' | 'Basics' | 'Pro' | 'Ultimate'>('Free');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);
  
  // Small helper for URL validation (used for Custom JSON)
  const isValidUrl = (value: string) => {
    try { new URL(value); return true; } catch { return false; }
  };

  // Persist job sources locally so settings survive refreshes
  useEffect(() => {
    try {
      const raw = localStorage.getItem('jobSources');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setJobSources(parsed);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem('jobSources', JSON.stringify(jobSources)); } catch { /* ignore */ }
  }, [jobSources]);

  // Try loading job sources from backend table if present; fallback to local
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = (auth as any)?.user?.id;
        if (!uid) return;
        const { data: rows, error } = await (supabase as any)
          .from('job_source_settings')
          .select('sources')
          .eq('id', uid)
          .maybeSingle();
        if (!error && rows && Array.isArray((rows as any).sources)) {
          setJobSources((rows as any).sources);
        }
      } catch { /* ignore */ }
    })();
  }, [supabase]);

  const displayedSources = useMemo(() => {
    if (!groupEnabledFirst) return jobSources;
    const arr = [...jobSources];
    arr.sort((a, b) => Number(b.enabled) - Number(a.enabled));
    return arr;
  }, [jobSources, groupEnabledFirst]);

  const moveItem = (list: any[], fromId: number, toId: number) => {
    if (fromId === toId) return list;
    const srcIdx = list.findIndex((s) => s.id === fromId);
    const dstIdx = list.findIndex((s) => s.id === toId);
    if (srcIdx < 0 || dstIdx < 0) return list;
    const copy = [...list];
    const [item] = copy.splice(srcIdx, 1);
    copy.splice(dstIdx, 0, item);
    return copy;
  };
  useEffect(() => {
    let active = true;
    const load = async () => {
      const path = formData.avatar_url;
      if (!path) { setAvatarUrl(null); return; }
      try {
        const { data, error } = await (supabase as any).storage.from('avatars').createSignedUrl(path, 60 * 10);
        if (error) throw error;
        if (active) setAvatarUrl(data?.signedUrl || null);
      } catch {
        if (active) setAvatarUrl(null);
      }
    };
    load();
    const id = setInterval(load, 1000 * 60 * 8); // refresh before expiry
    return () => { active = false; clearInterval(id); };
  }, [supabase, formData.avatar_url]);

  // Hydrate from realtime-backed hooks
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = (data as any)?.user?.email ?? "";
      setFormData((prev) => ({
        ...prev,
        email,
        firstName: profile?.first_name || "",
        lastName: profile?.last_name || "",
        phone: (profile as any)?.phone || "",
        location: profile?.location || "",
        avatar_url: (profile as any)?.avatar_url || "",
      }));
    })();
  }, [profile, supabase]);

  // Fetch billing data
  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) return;

        // Fetch current credits
        const { data: creditsData } = await supabase
          .from('user_credits')
          .select('balance')
          .eq('user_id', userId)
          .single();

        if (creditsData) {
          setCurrentCredits(creditsData.balance);
        }

        // Fetch subscription
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('subscription_plans(name, credits_per_month), current_period_end')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single();

        if (subscription) {
          const planName = (subscription as any)?.subscription_plans?.name;
          setBillingSubscriptionTier(planName || 'Free');
          setCurrentPeriodEnd((subscription as any).current_period_end);
        }

        // Fetch all subscription plans
        const { data: plansData } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('price', { ascending: true });

        if (plansData) {
          setSubscriptionPlans(plansData);
        }
      } catch (error) {
        console.error('Error fetching billing data:', error);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    // ensure settings exist lazily on first toggle
    void refreshSec();
  }, [refreshSec]);

  // Load job source domain settings when job-sources tab is active
  useEffect(() => {
    if (activeTab !== 'job-sources') return;
    
    (async () => {
      setLoadingDomains(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = (auth as any)?.user?.id;
        if (!uid) { setLoadingDomains(false); return; }
        const { data } = await (supabase as any)
          .from('job_source_settings')
          .select('allowed_domains')
          .eq('id', uid)
          .maybeSingle();
        if (data && Array.isArray(data.allowed_domains)) {
          const savedDomains = data.allowed_domains.map((d: string) => d.toLowerCase().trim());
          const defaultJobSourceDomains = [
            { domain: 'remote.co' },
            { domain: 'remotive.com' },
            { domain: 'remoteok.com' },
            { domain: 'jobicy.com' },
            { domain: 'levels.fyi' },
          ];
          // Check which default domains are enabled
          const enabledDefaults = new Set<string>();
          defaultJobSourceDomains.forEach(source => {
            if (savedDomains.includes(source.domain)) {
              enabledDefaults.add(source.domain);
            }
          });
          setEnabledDefaultDomains(enabledDefaults);
          // Extract user custom domains (not in default list)
          const customDomains = savedDomains.filter((d: string) => 
            !defaultJobSourceDomains.some(s => s.domain === d)
          );
          setUserCustomDomains(customDomains.join(', '));
        }
      } catch (e: any) { console.warn(e); }
      setLoadingDomains(false);
    })();
  }, [activeTab, supabase]);

  const tabs = [
    { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "security", label: "Security", icon: <Shield className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
    { id: "privacy", label: "Privacy", icon: <Globe className="w-4 h-4" /> },
    { id: "resume-checker", label: "Resume Checker", icon: <Sparkles className="w-4 h-4" /> },
    { id: "job-sources", label: "Job Sources", icon: <SettingsIcon className="w-4 h-4" /> },
    { id: "integrations", label: "Integrations", icon: <Link className="w-4 h-4" /> },
    { id: "billing", label: "Billing", icon: <CreditCard className="w-4 h-4" /> }
  ];

  useRegisterCoachMarks({
    page: 'settings',
    marks: [
      { id: 'settings-tab-profile', selector: '#settings-tab-btn-profile', title: 'Profile Settings', body: 'Manage your personal information, contact details, and avatar here.', condition: { type: 'click', autoNext: true }, next: 'settings-tab-notifications' },
      { id: 'settings-tab-notifications', selector: '#settings-tab-btn-notifications', title: 'Notifications', body: 'Control which updates you receive via email, push, or desktop notifications. Configure granular preferences for each notification type.', condition: { type: 'click', autoNext: true }, next: 'settings-tab-security' },
      { id: 'settings-tab-security', selector: '#settings-tab-btn-security', title: 'Security', body: 'Update password, manage two-factor authentication, view active sessions, manage API keys, and configure enterprise-level security settings.', condition: { type: 'click', autoNext: true }, next: 'settings-tab-appearance' },
      { id: 'settings-tab-appearance', selector: '#settings-tab-btn-appearance', title: 'Appearance', body: 'Customize UI theme, color scheme, and visual preferences to match your style.', condition: { type: 'click', autoNext: true }, next: 'settings-tab-privacy' },
      { id: 'settings-tab-privacy', selector: '#settings-tab-btn-privacy', title: 'Privacy', body: 'Adjust visibility settings, data sharing preferences, and manage your privacy with realtime data controls and enterprise-level modifications.', condition: { type: 'click', autoNext: true }, next: 'settings-tab-job-sources' },
      { id: 'settings-tab-job-sources', selector: '#settings-tab-btn-job-sources', title: 'Job Sources', body: 'Configure and manage job ingestion sources. View stats, enable/disable sources, set search queries, and prioritize sources for automated job discovery.', condition: { type: 'click', autoNext: true }, next: 'settings-tab-integrations' },
      { id: 'settings-tab-integrations', selector: '#settings-tab-btn-integrations', title: 'Integrations', body: 'Connect your accounts from other services like Gmail, LinkedIn, and GitHub to enhance your job search workflow.', condition: { type: 'click', autoNext: true }, next: 'settings-tab-billing' },
      { id: 'settings-tab-billing', selector: '#settings-tab-btn-billing', title: 'Billing', body: 'Manage subscription plans, view credit balance, purchase credits, and review transaction history.', condition: { type: 'click', autoNext: true }, next: 'settings-tour-complete' },
      { id: 'settings-tour-complete', selector: '#settings-tablist', title: 'All Set', body: 'That\'s the settings navigation. You can restart this tour anytime from the tour menu.' }
    ]
  });

  const activeLoading = (
    (activeTab === 'profile' && profileLoading) ||
    (activeTab === 'notifications' && notifLoading) ||
    (activeTab === 'privacy' && privacyLoading) ||
    (activeTab === 'appearance' && appearanceLoading) ||
    (activeTab === 'security' && securityLoading)
  );

  const TabSkeleton = () => (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white/[0.02] border border-white/[0.06] p-6 rounded-xl">
          <div className="space-y-4">
            <Skeleton className="h-5 w-48 bg-white/[0.05]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="space-y-2">
                  <Skeleton className="h-3 w-24 bg-white/[0.05]" />
                  <Skeleton className="h-10 w-full bg-white/[0.05]" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-9 w-24 bg-white/[0.05]" />
              <Skeleton className="h-9 w-20 bg-white/[0.05]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ... existing rendering logic below will conditionally use activeLoading & TabSkeleton

  const handleNotificationChange = async (setting: string, value: boolean | string) => {
    try {
      // Handle push notification permission request
      if (setting === 'push_notifications' && value === true) {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          toastError('Push not supported', 'This browser does not support notifications');
          return;
        }
        if (Notification.permission === 'denied') {
          toastError('Notifications blocked', 'Allow notifications in your browser settings');
          return;
        }
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            toastError('Permission required', 'Enable notifications to turn this on');
            return;
          }
        }
      }

      // Handle desktop notifications permission
      if (setting === 'desktop_notifications' && value === true) {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          toastError('Desktop notifications not supported', 'This browser does not support desktop notifications');
          return;
        }
        if (Notification.permission === 'denied') {
          toastError('Notifications blocked', 'Allow notifications in your browser settings');
          return;
        }
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            toastError('Permission required', 'Enable notifications to turn this on');
            return;
          }
        }
      }

      // Update settings
      if (!notif) {
        await createSettings({ [setting as any]: value });
      } else {
        await updateSettings({ [setting as any]: value } as any);
      }
    } catch (e: any) {
      toastError('Update failed', e.message);
    }
  };

  const handleSaveProfile = async () => {
    // create or update
    if (!profile) {
      await createProfile({
        first_name: formData.firstName,
        last_name: formData.lastName,
        location: formData.location,
        phone: formData.phone as any,
        avatar_url: formData.avatar_url as any,
      } as any);
    } else {
      await updateProfile({
        first_name: formData.firstName,
        last_name: formData.lastName,
        location: formData.location,
        phone: formData.phone as any,
        avatar_url: formData.avatar_url as any,
      } as any);
    }
  };

  const handleResetForm = async () => {
    await refreshProfile();
    await refreshNotif();
  await refreshPrivacy();
    success("Form reset");
  };

  const handleExportData = async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = (u as any)?.user?.id;
      if (!uid) return toastError('Not signed in', 'Please sign in again');
      
      // Build promises (no .catch chaining on builders to avoid non-thenable issues)
      const profP = (supabase as any).from('profiles').select('*').eq('id', uid).maybeSingle();
      const notifP = (supabase as any).from('notification_settings').select('*').eq('id', uid).maybeSingle();
      const resumesP = (supabase as any).from('resumes').select('*').eq('user_id', uid).order('updated_at', { ascending: false });
      const privacyP = (supabase as any).from('privacy_settings').select('*').eq('id', uid).maybeSingle();
      const appsP = (supabase as any).from('applications').select('*').eq('user_id', uid).order('applied_date', { ascending: false });
      const jobsP = (supabase as any).from('jobs').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      const bookmarksP = (supabase as any).from('bookmarks').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      const creditTxP = (supabase as any).from('credit_transactions').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      const creditsP = (supabase as any).from('user_credits').select('*').eq('user_id', uid).maybeSingle();
      const subsP = (supabase as any).from('user_subscriptions').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      const notifsP = (supabase as any).from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      const eduP = (supabase as any).from('profile_education').select('*').eq('user_id', uid).order('start_date', { ascending: false });
      const expP = (supabase as any).from('profile_experiences').select('*').eq('user_id', uid).order('start_date', { ascending: false });
      const skillsP = (supabase as any).from('profile_skills').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      const appearanceP = (supabase as any).from('appearance_settings').select('*').eq('id', uid).maybeSingle();
      const securityP = (supabase as any).from('security_settings').select('*').eq('id', uid).maybeSingle();

      const [
        profRes,
        notifRes,
        resumesRes,
        privacyRes,
        appsRes,
        jobsRes,
        bookmarksRes,
        creditTxRes,
        creditsRes,
        subsRes,
        notifsRes,
        eduRes,
        expRes,
        skillsRes,
        appearanceRes,
        securityRes,
      ] = await Promise.all([
        profP, notifP, resumesP, privacyP, appsP, jobsP, bookmarksP, creditTxP, creditsP, subsP, notifsP, eduP, expP, skillsP, appearanceP, securityP
      ]);

      const prof = (profRes as any)?.data ?? null;
      const notifData = (notifRes as any)?.data ?? null;
      const resumes = (resumesRes as any)?.data ?? [];
      const privacyData = (privacyRes as any)?.data ?? null;
      const applications = (appsRes as any)?.data ?? [];
      const jobs = (jobsRes as any)?.data ?? [];
      const bookmarks = (bookmarksRes as any)?.data ?? [];
      const creditTransactions = (creditTxRes as any)?.data ?? [];
      const userCredits = (creditsRes as any)?.data ?? null;
      const userSubscriptions = (subsRes as any)?.data ?? [];
      const notifications = (notifsRes as any)?.data ?? [];
      const education = (eduRes as any)?.data ?? [];
      const experience = (expRes as any)?.data ?? [];
      const skills = (skillsRes as any)?.data ?? [];
      const appearanceSettings = (appearanceRes as any)?.data ?? null;
      const securitySettings = (securityRes as any)?.data ?? null;

      const payload = {
        exported_at: new Date().toISOString(),
        export_version: '2.0',
        user: { 
          id: uid, 
          email: (u as any)?.user?.email,
          created_at: (u as any)?.user?.created_at,
          last_sign_in_at: (u as any)?.user?.last_sign_in_at,
        },
        profile: prof || null,
  notification_settings: notifData || null,
  privacy_settings: privacyData || null,
        appearance_settings: appearanceSettings || null,
        security_settings: securitySettings || null,
        resumes: resumes || [],
        applications: applications || [],
        jobs: jobs || [],
        bookmarks: bookmarks || [],
        credit_transactions: creditTransactions || [],
        user_credits: userCredits || null,
        user_subscriptions: userSubscriptions || [],
        notifications: notifications || [],
        education: education || [],
        experience: experience || [],
        skills: skills || [],
        summary: {
          total_resumes: resumes?.length || 0,
          total_applications: applications?.length || 0,
          total_jobs: jobs?.length || 0,
          total_bookmarks: bookmarks?.length || 0,
          total_credit_transactions: creditTransactions?.length || 0,
          current_credits: userCredits?.balance || 0,
          active_subscriptions: userSubscriptions?.filter((s: any) => s.status === 'active').length || 0,
          total_notifications: notifications?.length || 0,
          unread_notifications: notifications?.filter((n: any) => !n.read).length || 0,
          education_records: education?.length || 0,
          experience_records: experience?.length || 0,
          skills_count: skills?.length || 0,
        },
      };
      
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jobraker-export-${uid}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success('Export started');
    } catch (e: any) {
      toastError('Export failed', e.message);
    }
  };

  const handleUploadAvatar = async () => {
    // Open file picker
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const { data: user } = await supabase.auth.getUser();
        const uid = (user as any)?.user?.id;
        if (!uid) return;
  const ext = file.name.split('.').pop() || 'png';
  const path = `${uid}/avatar_${Date.now()}.${ext}`;
  const { error: upErr } = await (supabase as any).storage.from('avatars').upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) throw upErr;
  // Store storage path; we'll resolve via signed URL when rendering
  setFormData((p) => ({ ...p, avatar_url: path }));
  await updateProfile({ avatar_url: path } as any);
        success('Avatar updated');
      } catch (e: any) {
        toastError('Avatar upload failed', e.message);
      }
    };
    input.click();
  };

  const handleRemoveAvatar = async () => {
    setFormData((p) => ({ ...p, avatar_url: "" }));
    await updateProfile({ avatar_url: null } as any);
  };

  const handleChangePassword = async () => {
    if (!formData.newPassword || formData.newPassword !== formData.confirmPassword) {
      toastError('Password mismatch', 'Please confirm your new password');
      return;
    }
    if (!passwordCheck.valid) {
      toastError('Weak password', 'Please choose a stronger password that meets the requirements.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toastError('Authentication error', 'Please sign in again');
      return;
    }
    
    const { error } = await supabase.auth.updateUser({ password: formData.newPassword });
    if (error) return toastError('Failed to update password', error.message);
    
    // Log security event
    try {
      const { logSecurityEvent } = await import('../../../utils/sessionManagement');
      await logSecurityEvent(
        user.id,
        'password_change',
        'User changed their password',
        'medium'
      );
      
      // Send notification if enabled
      const { data: secSettings } = await supabase
        .from('security_settings')
        .select('password_change_alerts')
        .eq('id', user.id)
        .maybeSingle();
      
      if (secSettings?.password_change_alerts !== false) {
        const { createNotification } = await import('../../../utils/notifications');
        createNotification({
          user_id: user.id,
          type: 'system',
          title: 'Password changed',
          message: 'Your password was successfully changed. If you did not make this change, please secure your account immediately.',
        });
      }
    } catch (e) {
      console.warn('Failed to log password change event:', e);
    }
    
    success('Password updated');
    setFormData((p) => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '' }));
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Pro':
        return <Zap className="w-5 h-5" />;
      case 'Ultimate':
        return <Crown className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  const getTierGradient = (tier: string) => {
    switch (tier) {
      case 'Pro':
        return 'from-blue-500 via-blue-600 to-blue-700';
      case 'Ultimate':
        return 'from-purple-500 via-purple-600 to-purple-700';
      default:
        return 'from-[#1dff00] via-[#0fc74f] to-[#0a8246]';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div id="settings-tab-profile" data-tour="settings-tab-profile" className="space-y-6">
            {/* Avatar Section */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white/95 mb-6">Profile Picture</h3>
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/90 font-semibold text-xl">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleUploadAvatar}
                    className="border-white/[0.08] text-white/70 hover:text-white/90 hover:bg-white/[0.03] hover:border-[#1dff00]/30 transition-all"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                  {avatarUrl && (
                    <Button
                      variant="outline"
                      onClick={handleRemoveAvatar}
                      className="border-white/[0.08] text-red-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white/95 mb-6">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">First Name</label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    className="bg-white/[0.02] border-white/[0.08] text-white/90 placeholder:text-white/30 focus:border-[#1dff00]/30 focus:bg-white/[0.04] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Last Name</label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    className="bg-white/[0.02] border-white/[0.08] text-white/90 placeholder:text-white/30 focus:border-[#1dff00]/30 focus:bg-white/[0.04] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="bg-white/[0.02] border-white/[0.08] text-white/90 placeholder:text-white/30 focus:border-[#1dff00]/30 focus:bg-white/[0.04] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Phone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    className="bg-white/[0.02] border-white/[0.08] text-white/90 placeholder:text-white/30 focus:border-[#1dff00]/30 focus:bg-white/[0.04] transition-all"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Location</label>
                  <Input
                    value={formData.location}
                    onChange={(e) => handleInputChange("location", e.target.value)}
                    className="bg-white/[0.02] border-white/[0.08] text-white/90 placeholder:text-white/30 focus:border-[#1dff00]/30 focus:bg-white/[0.04] transition-all"
                    placeholder="City, Country"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-6 mt-6 border-t border-white/[0.06]">
                <Button
                  onClick={handleSaveProfile}
                  className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 font-medium transition-all"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResetForm}
                  className="border-white/[0.08] text-white/70 hover:text-white/90 hover:bg-white/[0.03] transition-all"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        );

      case "notifications":
        return (
          <div id="settings-tab-notifications" data-tour="settings-tab-notifications" className="space-y-6">
            {/* General Notification Settings */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white/95 mb-6">General Settings</h3>
              <div className="space-y-3">
                {[
                  { key: "email_notifications", label: "Email Notifications", description: "Master toggle for all email notifications" },
                  { key: "push_notifications", label: "Push Notifications", description: "Master toggle for browser push notifications" },
                  { key: "desktop_notifications", label: "Desktop Notifications", description: "Show desktop/browser notifications" },
                  { key: "sound_enabled", label: "Sound Alerts", description: "Play sound when receiving notifications" }
                ].map((setting) => (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all"
                  >
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white/90">{setting.label}</h4>
                      <p className="text-xs text-white/50 mt-0.5">{setting.description}</p>
                    </div>
                    <button
                      onClick={() => handleNotificationChange(setting.key, !(notif as any)?.[setting.key])}
                      disabled={notifLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        (notif as any)?.[setting.key]
                          ? "bg-[#1dff00]"
                          : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          (notif as any)?.[setting.key] ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Type-Specific In-App Notifications */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white/95 mb-4">In-App Notifications</h3>
              <p className="text-xs text-white/50 mb-6">Control which notification types appear in your dashboard</p>
              <div className="space-y-3">
                {[
                  { key: "notify_interviews", label: "Interview Notifications", description: "Updates about interviews and scheduling" },
                  { key: "notify_applications", label: "Application Updates", description: "Status changes and updates on your applications" },
                  { key: "notify_company_updates", label: "Company Updates", description: "News and updates from companies" },
                  { key: "notify_system", label: "System Messages", description: "Important system notifications and alerts" }
                ].map((setting) => (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all"
                  >
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white/90">{setting.label}</h4>
                      <p className="text-xs text-white/50 mt-0.5">{setting.description}</p>
                    </div>
                    <button
                      onClick={() => handleNotificationChange(setting.key, !((notif as any)?.[setting.key] ?? true))}
                      disabled={notifLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        ((notif as any)?.[setting.key] ?? true)
                          ? "bg-[#1dff00]"
                          : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          ((notif as any)?.[setting.key] ?? true) ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Notification Settings */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white/95 mb-4">Email Notifications</h3>
              <p className="text-xs text-white/50 mb-6">Choose which updates you receive via email</p>
              <div className="space-y-3">
                {[
                  { key: "email_interviews", label: "Interview Emails", description: "Email notifications for interview-related updates" },
                  { key: "email_applications", label: "Application Emails", description: "Email notifications for application status changes" },
                  { key: "email_company_updates", label: "Company Update Emails", description: "Email notifications from companies" },
                  { key: "email_system", label: "System Emails", description: "Important system messages via email" },
                  { key: "job_alerts", label: "Job Alerts", description: "Get notified about new job opportunities matching your profile" },
                  { key: "weekly_digest", label: "Weekly Digest", description: "Weekly summary of your activity and progress" },
                  { key: "marketing_emails", label: "Marketing Emails", description: "Promotional emails and product updates" }
                ].map((setting) => (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all"
                  >
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white/90">{setting.label}</h4>
                      <p className="text-xs text-white/50 mt-0.5">{setting.description}</p>
                    </div>
                    <button
                      onClick={() => handleNotificationChange(setting.key, !((notif as any)?.[setting.key] ?? (setting.key === 'marketing_emails' ? false : true)))}
                      disabled={notifLoading || !(notif as any)?.email_notifications}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        ((notif as any)?.[setting.key] ?? (setting.key === 'marketing_emails' ? false : true))
                          ? "bg-[#1dff00]"
                          : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          ((notif as any)?.[setting.key] ?? (setting.key === 'marketing_emails' ? false : true)) ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Push Notification Settings */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white/95 mb-4">Push Notifications</h3>
              <p className="text-xs text-white/50 mb-6">Control browser push notifications by type</p>
              <div className="space-y-3">
                {[
                  { key: "push_interviews", label: "Interview Push Notifications", description: "Push notifications for interview updates" },
                  { key: "push_applications", label: "Application Push Notifications", description: "Push notifications for application changes" },
                  { key: "push_company_updates", label: "Company Update Push", description: "Push notifications from companies" },
                  { key: "push_system", label: "System Push Notifications", description: "Important system messages as push notifications" }
                ].map((setting) => (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all"
                  >
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white/90">{setting.label}</h4>
                      <p className="text-xs text-white/50 mt-0.5">{setting.description}</p>
                    </div>
                    <button
                      onClick={() => handleNotificationChange(setting.key, !((notif as any)?.[setting.key] ?? true))}
                      disabled={notifLoading || !(notif as any)?.push_notifications}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        ((notif as any)?.[setting.key] ?? true)
                          ? "bg-[#1dff00]"
                          : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          ((notif as any)?.[setting.key] ?? true) ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white/95 mb-4">Quiet Hours</h3>
              <p className="text-xs text-white/50 mb-6">Suppress notifications during specified hours</p>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-white/90">Enable Quiet Hours</h4>
                    <p className="text-xs text-white/50 mt-0.5">Pause notifications during your selected time</p>
                  </div>
                  <button
                    onClick={() => handleNotificationChange("quiet_hours_enabled", !((notif as any)?.quiet_hours_enabled ?? false))}
                    disabled={notifLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      ((notif as any)?.quiet_hours_enabled ?? false)
                        ? "bg-[#1dff00]"
                        : "bg-white/[0.1]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        ((notif as any)?.quiet_hours_enabled ?? false) ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {((notif as any)?.quiet_hours_enabled ?? false) && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                    <div>
                      <label className="block text-xs text-white/70 mb-2">Start Time</label>
                      <Input
                        type="time"
                        value={(notif as any)?.quiet_hours_start || '22:00'}
                        onChange={(e) => handleNotificationChange("quiet_hours_start", e.target.value)}
                        disabled={notifLoading}
                        className="bg-white/[0.05] border-white/[0.1] text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-2">End Time</label>
                      <Input
                        type="time"
                        value={(notif as any)?.quiet_hours_end || '08:00'}
                        onChange={(e) => handleNotificationChange("quiet_hours_end", e.target.value)}
                        disabled={notifLoading}
                        className="bg-white/[0.05] border-white/[0.1] text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case "security":
        return (
          <div id="settings-tab-security" data-tour="settings-tab-security" className="space-y-6">
            {/* Change Password */}
            <Card className="bg-card/10 border-border/20 hover:border-primary/50 transition-all duration-300">
              <CardContent className="p-4">
                <h3 className="text-foreground font-medium mb-4">Change Password</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Current Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={formData.currentPassword}
                        onChange={(e) => handleInputChange("currentPassword", e.target.value)}
                        className="bg-card/10 border-border/20 text-foreground focus:border-primary hover:border-border/30 pr-10 transition-all duration-300"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground hover:scale-110 transition-all duration-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">New Password</label>
                    <Input
                      type="password"
                      value={formData.newPassword}
                      onChange={(e) => handleInputChange("newPassword", e.target.value)}
                      aria-invalid={!!formData.newPassword && !passwordCheck.valid}
                      className="bg-card/10 border-border/20 text-foreground focus:border-primary hover:border-border/30 transition-all duration-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Confirm New Password</label>
                    <Input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      className="bg-card/10 border-border/20 text-foreground focus:border-primary hover:border-border/30 transition-all duration-300"
                    />
                  </div>
                  {/* Password rules & strength */}
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Strength</span>
                      <span className={`font-semibold ${passwordCheck.score >= 4 ? 'text-success' : passwordCheck.score >= 3 ? 'text-warning' : 'text-destructive'}`}>{passwordCheck.strength}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      {[
                        { ok: passwordCheck.lengthOk, label: '8+ characters' },
                        { ok: passwordCheck.hasUpper, label: 'Uppercase letter' },
                        { ok: passwordCheck.hasLower, label: 'Lowercase letter' },
                        { ok: passwordCheck.hasNumber, label: 'Number' },
                        { ok: passwordCheck.hasSymbol, label: 'Symbol' },
                        { ok: passwordCheck.noSpaces, label: 'No spaces' },
                      ].map((r, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {r.ok ? (
                            <CheckCircle2 className="w-4 h-4 text-success" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive" />
                          )}
                          <span className={r.ok ? 'text-foreground' : 'text-muted-foreground'}>{r.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    id="settings-security-update-password"
                    onClick={handleChangePassword}
                    disabled={!passwordCheck.valid || formData.newPassword !== formData.confirmPassword}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-all duration-300 disabled:opacity-60"
                  >
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Two-Factor Authentication */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-medium text-white/95">Two-Factor Authentication</h3>
                  <p className="text-xs text-white/50 mt-1">Add an extra layer of security to your account</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm px-3 py-1 rounded ${sec?.two_factor_enabled ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/50'}`}>
                    {sec?.two_factor_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <Button
                    variant={sec?.two_factor_enabled ? 'outline' : 'default'}
                    onClick={async () => {
                      try {
                        if (sec?.two_factor_enabled) {
                          if (!confirm('Disable two-factor authentication? This will reduce your account security.')) return;
                          await disableTotp();
                          return;
                        }
                        if (!sec) await createSecurity({});
                        const { factorId, uri } = await enrollTotp();
                        setTotpFactorId(factorId);
                        if (uri) {
                          try { const QR = await getQRCode(); setQrDataUrl(await QR.toDataURL(uri)); } catch { setQrDataUrl(undefined); }
                        }
                        setTotpCode("");
                        setOpen2FA(true);
                      } catch (e: any) {
                        toastError('2FA setup failed', e.message);
                      }
                    }}
                    className={sec?.two_factor_enabled ? "border-white/[0.1] text-white/70 hover:bg-white/[0.05]" : "bg-[#1dff00] text-black hover:bg-[#1dff00]/90"}
                  >
                    {sec?.two_factor_enabled ? 'Disable 2FA' : 'Enable 2FA'}
                  </Button>
                </div>
              </div>
              {sec?.two_factor_enabled && (
                <div className="space-y-3 pt-4 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white/90">Require 2FA for Login</p>
                      <p className="text-xs text-white/50 mt-0.5">Force 2FA verification on all login attempts</p>
                    </div>
                    <button
                      onClick={() => {
                        if (!sec) createSecurity({ require_2fa_for_login: !(sec?.require_2fa_for_login ?? false) });
                        else updateSecurity({ require_2fa_for_login: !(sec.require_2fa_for_login ?? false) });
                      }}
                      disabled={securityLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        (sec?.require_2fa_for_login ?? false) ? "bg-[#1dff00]" : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          (sec?.require_2fa_for_login ?? false) ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white/90">Require Backup Codes</p>
                      <p className="text-xs text-white/50 mt-0.5">Require backup codes to be generated before enabling 2FA</p>
                    </div>
                    <button
                      onClick={() => {
                        if (!sec) createSecurity({ backup_codes_required: !(sec?.backup_codes_required ?? true) });
                        else updateSecurity({ backup_codes_required: !(sec.backup_codes_required ?? true) });
                      }}
                      disabled={securityLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        (sec?.backup_codes_required ?? true) ? "bg-[#1dff00]" : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          (sec?.backup_codes_required ?? true) ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </Card>

            {/* Sign-in Alerts */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white/95 mb-4">Security Alerts</h3>
                <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-white/[0.1] transition-all">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/90">Login Alerts</p>
                    <p className="text-xs text-white/50 mt-0.5">Notify me when a new device signs in</p>
                  </div>
                  <button
                    onClick={() => {
                      if (!sec) createSecurity({ login_alerts_enabled: !(sec?.login_alerts_enabled ?? true) });
                      else updateSecurity({ login_alerts_enabled: !(sec.login_alerts_enabled ?? true) });
                    }}
                    disabled={securityLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                      (sec?.login_alerts_enabled ?? true) ? "bg-[#1dff00]" : "bg-white/[0.1]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (sec?.login_alerts_enabled ?? true) ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                    </div>
                <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-white/[0.1] transition-all">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/90">Suspicious Login Alerts</p>
                    <p className="text-xs text-white/50 mt-0.5">Alert on unusual login patterns or locations</p>
                  </div>
                  <button
                    onClick={() => {
                      if (!sec) createSecurity({ suspicious_login_alerts: !(sec?.suspicious_login_alerts ?? true) });
                      else updateSecurity({ suspicious_login_alerts: !(sec.suspicious_login_alerts ?? true) });
                    }}
                    disabled={securityLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                      (sec?.suspicious_login_alerts ?? true) ? "bg-[#1dff00]" : "bg-white/[0.1]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (sec?.suspicious_login_alerts ?? true) ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-white/[0.1] transition-all">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/90">Password Change Alerts</p>
                    <p className="text-xs text-white/50 mt-0.5">Notify when your password is changed</p>
                  </div>
                  <button
                    onClick={() => {
                      if (!sec) createSecurity({ password_change_alerts: !(sec?.password_change_alerts ?? true) });
                      else updateSecurity({ password_change_alerts: !(sec.password_change_alerts ?? true) });
                    }}
                    disabled={securityLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                      (sec?.password_change_alerts ?? true) ? "bg-[#1dff00]" : "bg-white/[0.1]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (sec?.password_change_alerts ?? true) ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </Card>

            {/* Backup Codes */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-medium text-white/95">Backup Codes</h3>
                  <p className="text-xs text-white/50 mt-1">One-time use codes for account recovery</p>
                </div>
                  <Button
                    variant="outline"
                  size="sm"
                  className="border-white/[0.1] text-white/70 hover:bg-white/[0.05] hover:border-white/[0.2]"
                    onClick={async () => {
                      try {
                        const codes = await generateBackupCodes(10);
                      if (codes && codes.length > 0) {
                        setGeneratedBackupCodes(codes);
                        setShowBackupCodesModal(true);
                        // Also download as backup
                        const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `jobraker-backup-codes-${new Date().toISOString().split('T')[0]}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }
                      } catch (e: any) {
                        toastError('Failed to generate codes', e.message);
                      }
                    }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Generate New Codes
                </Button>
                </div>
              <div className="space-y-2">
                {backupCodes && backupCodes.length > 0 ? (
                  <div className="border border-white/[0.06] rounded-lg overflow-hidden">
                    <div className="grid grid-cols-3 text-xs text-white/50 bg-white/[0.02] py-2 px-4 border-b border-white/[0.06]">
                    <div>ID</div>
                    <div>Status</div>
                      <div>Created</div>
                  </div>
                    <div className="divide-y divide-white/[0.06]">
                      {backupCodes.map((bc: any) => (
                        <div key={bc.id} className="grid grid-cols-3 items-center text-sm py-2 px-4 hover:bg-white/[0.02] transition-colors">
                          <div className="text-white/90 font-mono text-xs">#{bc.id}</div>
                          <div>
                            <span className={`text-xs px-2 py-1 rounded ${
                              bc.used 
                                ? 'bg-red-500/20 text-red-400' 
                                : 'bg-green-500/20 text-green-400'
                            }`}>
                              {bc.used ? 'Used' : 'Unused'}
                            </span>
                          </div>
                          <div className="text-xs text-white/50">
                            {bc.created_at ? new Date(bc.created_at).toLocaleDateString() : 'N/A'}
                        </div>
                        </div>
                      ))}
                    </div>
                  </div>
                    ) : (
                  <div className="text-sm text-white/50 py-8 text-center border border-white/[0.06] rounded-lg bg-white/[0.02]">
                    No backup codes generated yet. Click "Generate New Codes" to create your first set.
                  </div>
                    )}
                  </div>
            </Card>

            {/* Trusted Devices */}
            <Card className="bg-card/10 border-border/20 hover:border-primary/50 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-foreground font-medium">Trusted Devices</h3>
                  <Button
                    variant="outline"
                    className="border-border/20 text-foreground hover:bg-card/20 hover:border-primary/50"
                    onClick={async () => {
                      try {
                        const deviceId = crypto.getRandomValues(new Uint32Array(4)).join('-');
                        await trustDevice(deviceId, navigator.userAgent);
                        success('Current device trusted');
                      } catch (e: any) {
                        toastError('Failed to trust device', e.message);
                      }
                    }}
                  >Trust This Device</Button>
                </div>
                <p className="text-muted-foreground text-sm mb-3">Trusted devices skip some security prompts. Revoke lost or old devices.</p>
                <div className="mt-3 border border-border/10 rounded-md overflow-hidden">
                  <div className="grid grid-cols-4 text-xs text-muted-foreground bg-card/5 py-2 px-3">
                    <div>Device</div>
                    <div>Device ID</div>
                    <div>Last seen</div>
                    <div className="text-right">Actions</div>
                  </div>
                  <div className="divide-y divide-border/10">
                    {devices && devices.length > 0 ? (
                      devices.map((d: any) => (
                        <div key={d.device_id} className="grid grid-cols-4 items-center text-sm py-2 px-3">
                          <div className="truncate text-foreground" title={d.device_name || d.device_id}>{d.device_name || 'Unnamed device'}</div>
                          <div className="truncate text-muted-foreground" title={d.device_id}>{String(d.device_id).slice(0, 10)}…</div>
                          <div className="text-muted-foreground">{new Date(d.last_seen_at).toLocaleString()}</div>
                          <div className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                              onClick={async () => {
                                if (!confirm('Revoke this device?')) return;
                                try { await revokeDevice(d.device_id); } catch (e: any) { toastError('Failed to revoke', e.message); }
                              }}
                            >Revoke</Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground py-3 px-3">No trusted devices yet.</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Sessions */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-medium text-white/95">Active Sessions</h3>
                  <p className="text-xs text-white/50 mt-1">Manage your active login sessions</p>
                </div>
                {activeSessions && activeSessions.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!confirm('Revoke all other sessions? You will remain logged in on this device.')) return;
                      try {
                        await revokeAllOtherSessions();
                      } catch (e: any) {
                        toastError('Failed to revoke sessions', e.message);
                      }
                    }}
                    className="border-white/[0.1] text-white/70 hover:bg-white/[0.05] hover:border-white/[0.2]"
                  >
                    Revoke All Others
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {activeSessions && activeSessions.length > 0 ? (
                  activeSessions.map((session: any) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-white/[0.1] transition-all"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-white/90">
                            {session.device_name || session.device_type || 'Unknown Device'}
                          </p>
                          {session.is_current && (
                            <span className="text-xs px-2 py-0.5 rounded bg-[#1dff00]/20 text-[#1dff00]">Current</span>
                          )}
                        </div>
                        <div className="text-xs text-white/50 space-y-0.5">
                          {session.browser && <p>Browser: {session.browser}</p>}
                          {session.os && <p>OS: {session.os}</p>}
                          {session.ip_address && <p>IP: {session.ip_address}</p>}
                          {session.location && <p>Location: {session.location}</p>}
                          <p>Last active: {new Date(session.last_activity_at).toLocaleString()}</p>
                        </div>
                      </div>
                      {!session.is_current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!confirm('Revoke this session?')) return;
                            try {
                              await revokeSession(session.id);
                            } catch (e: any) {
                              toastError('Failed to revoke session', e.message);
                            }
                          }}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/50 py-4 text-center">No active sessions found</p>
                )}
              </div>
            </Card>

            {/* Security Audit Log */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-medium text-white/95">Security Audit Log</h3>
                  <p className="text-xs text-white/50 mt-1">View your account security events</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => listAuditLogs(100)}
                  className="border-white/[0.1] text-white/70 hover:bg-white/[0.05]"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs && auditLogs.length > 0 ? (
                  auditLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.06]"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-white/90">{log.event_type}</p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              log.risk_level === 'critical'
                                ? 'bg-red-500/20 text-red-400'
                                : log.risk_level === 'high'
                                ? 'bg-orange-500/20 text-orange-400'
                                : log.risk_level === 'medium'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-green-500/20 text-green-400'
                            }`}
                          >
                            {log.risk_level}
                          </span>
                        </div>
                        {log.event_description && (
                          <p className="text-xs text-white/50 mb-1">{log.event_description}</p>
                        )}
                        <div className="text-xs text-white/40 space-y-0.5">
                          {log.ip_address && <p>IP: {log.ip_address}</p>}
                          {log.location && <p>Location: {log.location}</p>}
                          <p>{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/50 py-4 text-center">No audit logs yet</p>
                )}
              </div>
            </Card>

            {/* API Keys */}
            {sec?.api_keys_enabled && (
              <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-medium text-white/95">API Keys</h3>
                    <p className="text-xs text-white/50 mt-1">Manage your API keys for programmatic access</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewApiKeyName("");
                      setNewApiKeyExpiry(undefined);
                      setNewApiKeyIpRestrictions("");
                      setCreatedApiKey(null);
                      setApiKeyModalOpen(true);
                    }}
                    className="border-white/[0.1] text-white/70 hover:bg-white/[0.05]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Key
                  </Button>
                </div>
                <div className="space-y-2">
                  {apiKeys && apiKeys.length > 0 ? (
                    apiKeys.map((key: any) => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06]"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-white/90">{key.key_name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded ${key.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                              {key.is_active ? 'Active' : 'Revoked'}
                            </span>
                          </div>
                          <div className="text-xs text-white/50 space-y-0.5">
                            <p>Prefix: {key.key_prefix}...</p>
                            {key.last_used_at && <p>Last used: {new Date(key.last_used_at).toLocaleString()}</p>}
                            {key.expires_at && <p>Expires: {new Date(key.expires_at).toLocaleString()}</p>}
                            {key.ip_restrictions && key.ip_restrictions.length > 0 && (
                              <p>IP Restrictions: {key.ip_restrictions.join(', ')}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {key.is_active ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (!confirm('Revoke this API key?')) return;
                                try {
                                  await revokeApiKey(key.id);
                                } catch (e: any) {
                                  toastError('Failed to revoke key', e.message);
                                }
                              }}
                              className="text-orange-400 hover:text-orange-300"
                            >
                              Revoke
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (!confirm('Permanently delete this API key? This action cannot be undone.')) return;
                              try {
                                await deleteApiKey(key.id);
                              } catch (e: any) {
                                toastError('Failed to delete key', e.message);
                              }
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-white/50 py-4 text-center">No API keys created yet</p>
                  )}
                </div>
              </Card>
            )}

            {/* Advanced Security Settings */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white/95 mb-4">Advanced Security</h3>
              <div className="space-y-4">
                {/* Session Management */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-white/80">Session Management</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white/90">Auto-logout Inactive Sessions</p>
                        <p className="text-xs text-white/50 mt-0.5">Automatically logout inactive sessions</p>
                      </div>
                      <button
                        onClick={() => {
                          if (!sec) createSecurity({ auto_logout_inactive: !(sec?.auto_logout_inactive ?? true) });
                          else updateSecurity({ auto_logout_inactive: !(sec.auto_logout_inactive ?? true) });
                        }}
                        disabled={securityLoading}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                          (sec?.auto_logout_inactive ?? true) ? "bg-[#1dff00]" : "bg-white/[0.1]"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            (sec?.auto_logout_inactive ?? true) ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-white/70 mb-2">Session Timeout (minutes)</label>
                        <Input
                          type="number"
                          value={sec?.session_timeout_minutes || 60}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 60;
                            if (!sec) createSecurity({ session_timeout_minutes: val });
                            else updateSecurity({ session_timeout_minutes: val });
                          }}
                          disabled={securityLoading}
                          className="bg-white/[0.05] border-white/[0.1] text-white"
                          min="0"
                        />
                    </div>
                      <div>
                        <label className="block text-xs text-white/70 mb-2">Max Concurrent Sessions</label>
                        <Input
                          type="number"
                          value={sec?.max_concurrent_sessions || 5}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 5;
                            if (!sec) createSecurity({ max_concurrent_sessions: val });
                            else updateSecurity({ max_concurrent_sessions: val });
                          }}
                          disabled={securityLoading}
                          className="bg-white/[0.05] border-white/[0.1] text-white"
                          min="1"
                        />
                </div>
                    </div>
                  </div>
                </div>

                {/* IP Security */}
                <div className="space-y-3 pt-4 border-t border-white/[0.06]">
                  <h4 className="text-sm font-medium text-white/80">IP Security</h4>
                  <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white/90">IP Whitelist</p>
                      <p className="text-xs text-white/50 mt-0.5">Restrict access to specific IP addresses</p>
                    </div>
                    <button
                      onClick={() => {
                        if (!sec) createSecurity({ ip_whitelist_enabled: !(sec?.ip_whitelist_enabled ?? false) });
                        else updateSecurity({ ip_whitelist_enabled: !(sec.ip_whitelist_enabled ?? false) });
                      }}
                      disabled={securityLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        (sec?.ip_whitelist_enabled ?? false) ? "bg-[#1dff00]" : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          (sec?.ip_whitelist_enabled ?? false) ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {(sec?.ip_whitelist_enabled ?? false) && (
                    <div className="space-y-2 p-3 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="Enter IP address"
                          value={newAllowedIp}
                          onChange={(e) => setNewAllowedIp(e.target.value)}
                          className="bg-white/[0.05] border-white/[0.1] text-white flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!newAllowedIp.trim()) return;
                            const current = sec?.allowed_ips || [];
                            const updated = [...current, newAllowedIp.trim()];
                            if (!sec) createSecurity({ allowed_ips: updated });
                            else updateSecurity({ allowed_ips: updated });
                            setNewAllowedIp("");
                          }}
                          className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                        >
                          Add
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {(sec?.allowed_ips || []).map((ip: string, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-sm text-white/70">
                            <span>{ip}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const current = sec?.allowed_ips || [];
                                const updated = current.filter((_, i) => i !== idx);
                                if (!sec) createSecurity({ allowed_ips: updated });
                                else updateSecurity({ allowed_ips: updated });
                              }}
                              className="text-red-400 hover:text-red-300 h-6 px-2"
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Additional Security */}
                <div className="space-y-3 pt-4 border-t border-white/[0.06]">
                  <h4 className="text-sm font-medium text-white/80">Additional Security</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white/90">API Keys</p>
                        <p className="text-xs text-white/50 mt-0.5">Enable API key management for programmatic access</p>
                      </div>
                      <button
                        onClick={() => {
                          if (!sec) createSecurity({ api_keys_enabled: !(sec?.api_keys_enabled ?? false) });
                          else updateSecurity({ api_keys_enabled: !(sec.api_keys_enabled ?? false) });
                        }}
                        disabled={securityLoading}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                          (sec?.api_keys_enabled ?? false) ? "bg-[#1dff00]" : "bg-white/[0.1]"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            (sec?.api_keys_enabled ?? false) ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );

      case "appearance":
        return (
          <div id="settings-tab-appearance" data-tour="settings-tab-appearance" className="space-y-6">
            {/* Theme Selection */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white/95 mb-6">Theme</h3>
              <div className="grid grid-cols-3 gap-3">
                {["Dark", "Light", "Auto"].map((theme) => (
                  <button
                    key={theme}
                    onClick={async () => {
                      const value = theme.toLowerCase() as 'dark' | 'light' | 'auto';
                      try {
                        if (!appearanceSettings) await (appearance as any).createSettings({ theme: value });
                        else await (appearance as any).updateSettings({ theme: value });
                      } catch (e: any) { toastError('Failed to set theme', e.message); }
                    }}
                    className={`p-4 rounded-lg border transition-all ${
                      (appearanceSettings?.theme || 'auto') === theme.toLowerCase()
                        ? "border-[#1dff00]/40 bg-[#1dff00]/[0.08]"
                        : "border-white/[0.08] hover:border-white/[0.12] hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="text-center">
                      <div className={`w-10 h-10 rounded-lg mx-auto mb-3 border border-white/[0.1] ${
                        theme === "Dark" ? "bg-zinc-900" : theme === "Light" ? "bg-zinc-100" : "bg-gradient-to-r from-zinc-900 to-zinc-100"
                      }`}></div>
                      <p className="text-white/90 text-sm font-medium">{theme}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white/95 mb-6">Accent Color</h3>
              <div className="grid grid-cols-6 gap-3">
                {["#1dff00", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981"].map((color) => (
                  <button
                    key={color}
                    onClick={async () => {
                      try {
                        if (!appearanceSettings) await (appearance as any).createSettings({ accent_color: color });
                        else await (appearance as any).updateSettings({ accent_color: color });
                      } catch (e: any) { toastError('Failed to set accent', e.message); }
                    }}
                    className={`w-12 h-12 rounded-xl cursor-pointer border-2 transition-all hover:scale-110 ${
                      (appearanceSettings?.accent_color || '#1dff00').toLowerCase() === color.toLowerCase()
                        ? "border-white/50 ring-2 ring-white/20"
                        : "border-transparent hover:border-white/20"
                    }`}
                    style={{ backgroundColor: color }}
                  ></button>
                ))}
              </div>
            </div>

            {/* Preferences */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white/95 mb-6">Preferences</h3>
              <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                <div>
                  <p className="text-sm font-medium text-white/90">Reduced Motion</p>
                  <p className="text-xs text-white/50 mt-0.5">Minimize animations and transitions</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      if (!appearanceSettings) await (appearance as any).createSettings({ reduce_motion: true });
                      else await (appearance as any).updateSettings({ reduce_motion: !(appearanceSettings.reduce_motion ?? false) });
                    } catch (e: any) { toastError('Failed to update motion preference', e.message); }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    (appearanceSettings?.reduce_motion ?? false)
                      ? "bg-[#1dff00]"
                      : "bg-white/[0.1]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      (appearanceSettings?.reduce_motion ?? false) ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div id="settings-tab-privacy" data-tour="settings-tab-privacy" className="space-y-6">
            {/* Profile Visibility */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-5 h-5 text-white/70" />
                <h3 className="text-base font-medium text-white/95">Profile Visibility</h3>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'is_profile_public', label: 'Public Profile', desc: 'Allow your profile to be visible to others', icon: Globe },
                  { key: 'show_email', label: 'Show Email', desc: 'Display your email address on your profile', icon: Mail },
                  { key: 'allow_profile_search', label: 'Profile Search', desc: 'Allow your profile to appear in search results', icon: Search },
                  { key: 'share_with_recruiters', label: 'Share with Recruiters', desc: 'Allow recruiters to view your profile', icon: Users },
                  { key: 'allow_company_access', label: 'Company Access', desc: 'Allow companies to access your profile data', icon: Building },
                  { key: 'show_application_status', label: 'Show Application Status', desc: 'Display application status to companies', icon: Briefcase }
                ].map((row: any) => (
                  <div key={row.key} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-white/[0.1] transition-all">
                    <div className="flex items-center gap-3 flex-1">
                      <row.icon className="w-4 h-4 text-white/50" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white/90">{row.label}</p>
                        <p className="text-xs text-white/50 mt-0.5">{row.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          if (!privacy) await createPrivacy({ [row.key]: !((privacy as any)?.[row.key] ?? false) } as any);
                          else await updatePrivacy({ [row.key]: !(privacy as any)[row.key] } as any);
                        } catch (e: any) { toastError('Failed to update privacy', e.message); }
                      }}
                      disabled={privacyLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        ((privacy as any)?.[row.key] ?? false) ? "bg-[#1dff00]" : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          ((privacy as any)?.[row.key] ?? false) ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Data Sharing & Analytics */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Share2 className="w-5 h-5 text-white/70" />
                <h3 className="text-base font-medium text-white/95">Data Sharing & Analytics</h3>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'share_analytics', label: 'Share Anonymized Analytics', desc: 'Help improve the product by sharing anonymized usage data', icon: Activity },
                  { key: 'allow_third_party_sharing', label: 'Third-Party Sharing', desc: 'Share data with third-party services and partners', icon: Share2 },
                  { key: 'allow_activity_tracking', label: 'Activity Tracking', desc: 'Track user activity for analytics and improvements', icon: Activity },
                  { key: 'allow_location_sharing', label: 'Location Sharing', desc: 'Share location data for job matching', icon: MapPin },
                  { key: 'allow_search_indexing', label: 'Search Engine Indexing', desc: 'Allow search engines to index your public profile', icon: Search }
                ].map((row: any) => (
                  <div key={row.key} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-white/[0.1] transition-all">
                    <div className="flex items-center gap-3 flex-1">
                      <row.icon className="w-4 h-4 text-white/50" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white/90">{row.label}</p>
                        <p className="text-xs text-white/50 mt-0.5">{row.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          if (!privacy) await createPrivacy({ [row.key]: !((privacy as any)?.[row.key] ?? false) } as any);
                          else await updatePrivacy({ [row.key]: !(privacy as any)[row.key] } as any);
                        } catch (e: any) { toastError('Failed to update privacy', e.message); }
                      }}
                      disabled={privacyLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        ((privacy as any)?.[row.key] ?? false) ? "bg-[#1dff00]" : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          ((privacy as any)?.[row.key] ?? false) ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Cookie Preferences */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Cookie className="w-5 h-5 text-white/70" />
                <h3 className="text-base font-medium text-white/95">Cookie Preferences</h3>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'allow_cookie_tracking', label: 'Cookie Tracking', desc: 'Allow cookie-based tracking and personalization', icon: Cookie },
                  { key: 'allow_functional_cookies', label: 'Functional Cookies', desc: 'Required for basic site functionality', icon: Check },
                  { key: 'allow_analytics_cookies', label: 'Analytics Cookies', desc: 'Help us understand how you use the platform', icon: Activity },
                  { key: 'allow_advertising_cookies', label: 'Advertising Cookies', desc: 'Used for personalized ads and marketing', icon: Zap },
                  { key: 'personalized_ads', label: 'Personalized Ads', desc: 'Use your data to personalize advertisements', icon: Sparkles }
                ].map((row: any) => (
                  <div key={row.key} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-white/[0.1] transition-all">
                    <div className="flex items-center gap-3 flex-1">
                      <row.icon className="w-4 h-4 text-white/50" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white/90">{row.label}</p>
                        <p className="text-xs text-white/50 mt-0.5">{row.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          if (!privacy) await createPrivacy({ [row.key]: !((privacy as any)?.[row.key] ?? false) } as any);
                          else await updatePrivacy({ [row.key]: !(privacy as any)[row.key] } as any);
                        } catch (e: any) { toastError('Failed to update privacy', e.message); }
                      }}
                      disabled={privacyLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        ((privacy as any)?.[row.key] ?? false) ? "bg-[#1dff00]" : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          ((privacy as any)?.[row.key] ?? false) ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Data Retention & Management */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-white/70" />
                <h3 className="text-base font-medium text-white/95">Data Retention & Management</h3>
              </div>
                <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/90 mb-1">Data Retention Period</p>
                    <p className="text-xs text-white/50">Number of days to retain your data (0 = indefinite)</p>
                      </div>
                  <Input
                    type="number"
                    min="0"
                    value={privacy?.data_retention_days ?? 365}
                    onChange={(e) => {
                      const days = parseInt(e.target.value) || 0;
                      if (!privacy) createPrivacy({ data_retention_days: days } as any);
                      else updatePrivacy({ data_retention_days: days } as any);
                    }}
                    className="w-24 bg-white/[0.05] border-white/[0.1] text-white"
                  />
                </div>
                {[
                  { key: 'auto_delete_inactive', label: 'Auto-Delete Inactive Accounts', desc: 'Automatically delete data for inactive accounts after retention period', icon: Trash2 },
                  { key: 'resume_default_public', label: 'Resumes Public by Default', desc: 'New resumes are public unless you change them', icon: FileText },
                  { key: 'allow_marketing_emails', label: 'Marketing Emails', desc: 'Receive marketing and promotional emails', icon: Mail }
                ].map((row: any) => (
                  <div key={row.key} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-white/[0.1] transition-all">
                    <div className="flex items-center gap-3 flex-1">
                      <row.icon className="w-4 h-4 text-white/50" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white/90">{row.label}</p>
                        <p className="text-xs text-white/50 mt-0.5">{row.desc}</p>
                      </div>
                    </div>
                    <button
                        onClick={async () => {
                          try {
                          if (!privacy) await createPrivacy({ [row.key]: !((privacy as any)?.[row.key] ?? false) } as any);
                            else await updatePrivacy({ [row.key]: !(privacy as any)[row.key] } as any);
                          } catch (e: any) { toastError('Failed to update privacy', e.message); }
                        }}
                      disabled={privacyLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        ((privacy as any)?.[row.key] ?? false) ? "bg-[#1dff00]" : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          ((privacy as any)?.[row.key] ?? false) ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            {/* GDPR Compliance */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-white/70" />
                <h3 className="text-base font-medium text-white/95">GDPR & Data Rights</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/90 mb-1">GDPR Consent</p>
                    <p className="text-xs text-white/50">
                      {privacy?.gdpr_consent_given 
                        ? `Given on ${privacy.gdpr_consent_date ? new Date(privacy.gdpr_consent_date).toLocaleDateString() : 'N/A'}`
                        : 'You have not given GDPR consent yet'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await updateGDPRConsent(!privacy?.gdpr_consent_given);
                      } catch (e: any) {
                        toastError('Failed to update consent', e.message);
                      }
                    }}
                    className="border-white/[0.1] text-white/70 hover:bg-white/[0.05]"
                  >
                    {privacy?.gdpr_consent_given ? 'Withdraw Consent' : 'Give Consent'}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={handleExportData}
                    className="border-white/[0.1] text-white/70 hover:bg-white/[0.05] justify-start"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export My Data
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowDeletionRequestModal(true)}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10 justify-start"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Request Data Deletion
                  </Button>
                </div>
              </div>
            </Card>

            {/* Privacy Audit Log */}
            <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <History className="w-5 h-5 text-white/70" />
                <h3 className="text-base font-medium text-white/95">Privacy Activity Log</h3>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {privacyAuditLogs && privacyAuditLogs.length > 0 ? (
                  privacyAuditLogs.slice(0, 10).map((log: any) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-white/90 capitalize">{log.action_type.replace(/_/g, ' ')}</p>
                        {log.setting_name && (
                          <p className="text-xs text-white/50 mt-0.5">
                            {log.setting_name}: {log.old_value} → {log.new_value}
                          </p>
                        )}
                        <p className="text-xs text-white/40 mt-1">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/50 py-4 text-center">
                    No privacy activity logged yet
                  </div>
                )}
              </div>
            </Card>

            {/* Data Deletion Requests */}
            {privacyDeletionRequests && privacyDeletionRequests.length > 0 && (
              <Card className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-base font-medium text-white/95">Active Deletion Requests</h3>
                </div>
                <div className="space-y-2">
                  {privacyDeletionRequests.filter((r: any) => r.status !== 'completed' && r.status !== 'cancelled').map((req: any) => (
                    <div key={req.id} className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-400 capitalize">{req.request_type.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-yellow-300/80 mt-1">Status: {req.status}</p>
                          {req.scheduled_deletion_date && (
                            <p className="text-xs text-yellow-300/80 mt-1">
                              Scheduled: {new Date(req.scheduled_deletion_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          req.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Account Deletion */}
            <Card className="bg-white/[0.02] border border-red-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h3 className="text-base font-medium text-red-400">Danger Zone</h3>
              </div>
                  <Button
                    variant="outline"
                onClick={() => {
                  setShowAccountDeletionModal(true);
                  setAccountDeletionEmail("");
                }}
                className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                Delete Account Permanently
                  </Button>
            </Card>
          </div>
        );

      case "job-sources":
        // Define the 5 default job source domains
        const defaultJobSourceDomains = [
          { id: 'remote.co', domain: 'remote.co', name: 'Remote.co', description: 'Remote.co job board', icon: Globe, color: 'blue' },
          { id: 'remotive.com', domain: 'remotive.com', name: 'Remotive', description: 'Remotive job board', icon: Search, color: 'green' },
          { id: 'remoteok.com', domain: 'remoteok.com', name: 'RemoteOK', description: 'RemoteOK job board', icon: Globe, color: 'purple' },
          { id: 'jobicy.com', domain: 'jobicy.com', name: 'Jobicy', description: 'Jobicy job board', icon: Briefcase, color: 'orange' },
          { id: 'levels.fyi', domain: 'levels.fyi', name: 'Levels.fyi', description: 'Levels.fyi (salary/compensation data)', icon: BarChart3, color: 'indigo' },
        ];

        const handleToggleDefaultDomain = (domain: string) => {
          setEnabledDefaultDomains(prev => {
            const next = new Set(prev);
            if (next.has(domain)) {
              next.delete(domain);
            } else {
              next.add(domain);
            }
            return next;
          });
        };

        const handleSaveDomains = async () => {
          setSavingDomains(true);
          try {
            const { data: auth } = await supabase.auth.getUser();
            const uid = (auth as any)?.user?.id;
            if (!uid) { setSavingDomains(false); return; }
            
            // Combine enabled default domains with user custom domains
            const enabledDefaults = Array.from(enabledDefaultDomains);
            const customDomains = userCustomDomains.split(',').map(s => s.trim()).filter(Boolean);
            const allDomains = [...enabledDefaults, ...customDomains];
            
            const payload = {
              id: uid,
              allowed_domains: allDomains,
              updated_at: new Date().toISOString(),
            };
            const { error } = await (supabase as any)
              .from('job_source_settings')
              .upsert(payload, { onConflict: 'id' });
            if (error) throw error;
            success('Job source domains saved', 'Your allowed domains configuration has been updated successfully');
          } catch (e: any) {
            toastError('Save failed', e.message || 'Failed to save domain settings');
          }
          setSavingDomains(false);
        };

        return (
          <div id="settings-tab-job-sources" data-tour="settings-tab-job-sources" className="space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold text-white/95 mb-2">Job Sources</h2>
              <p className="text-sm text-white/50">
                Configure allowed domains for job search. Toggle default job boards and add custom domains.
              </p>
            </div>

            {/* Available Job Sources */}
            <Card className="bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1] transition-all">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white/95 mb-4">Available Job Sources</h3>
                <div className="space-y-3">
                  {defaultJobSourceDomains.map((source) => {
                    const IconComponent = source.icon;
                    const isEnabled = enabledDefaultDomains.has(source.domain);
                    
                    return (
                      <div
                        key={source.id}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                          isEnabled 
                            ? 'bg-white/[0.05] border-white/[0.1] ring-1 ring-[#1dff00]/30' 
                            : 'bg-white/[0.02] border-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${
                            source.color === 'blue' ? 'from-blue-500/20 to-blue-500/10 border-blue-500/30' :
                            source.color === 'green' ? 'from-green-500/20 to-green-500/10 border-green-500/30' :
                            source.color === 'purple' ? 'from-purple-500/20 to-purple-500/10 border-purple-500/30' :
                            source.color === 'orange' ? 'from-orange-500/20 to-orange-500/10 border-orange-500/30' :
                            'from-indigo-500/20 to-indigo-500/10 border-indigo-500/30'
                          } border flex items-center justify-center`}>
                            <IconComponent className={`w-5 h-5 ${
                              source.color === 'blue' ? 'text-blue-400' :
                              source.color === 'green' ? 'text-green-400' :
                              source.color === 'purple' ? 'text-purple-400' :
                              source.color === 'orange' ? 'text-orange-400' :
                              'text-indigo-400'
                            }`} />
                          </div>
                          <div>
                            <h4 className="text-white/95 font-semibold">{source.name}</h4>
                            <p className="text-xs text-white/50 mt-0.5">{source.description}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleDefaultDomain(source.domain)}
                          disabled={loadingDomains}
                          className={`w-12 h-6 rounded-full transition-colors ${
                            isEnabled
                              ? 'bg-[#1dff00]'
                              : 'bg-white/10'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            isEnabled ? 'translate-x-6' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* User-Configurable Domains */}
            <Card className="bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1] transition-all">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white/95 mb-2">User-Configurable Domains</h3>
                <p className="text-sm text-white/50 mb-4">
                  Add custom domains to include in job search (comma-separated). These will be combined with enabled default sources above.
                </p>
                <Input
                  value={userCustomDomains}
                  onChange={(e) => setUserCustomDomains(e.target.value)}
                  placeholder="careers.google.com, amazon.jobs"
                  disabled={loadingDomains}
                  className="bg-white/[0.05] border-white/[0.1] text-white placeholder-white/40"
                />
                <p className="text-xs text-white/40 mt-2">
                  Format: comma-separated list (e.g., careers.google.com, amazon.jobs)
                </p>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSaveDomains}
                disabled={savingDomains || loadingDomains}
                className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 font-medium"
              >
                {savingDomains ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case "resume-checker":
        return (
          <div id="settings-tab-resume-checker" data-tour="settings-tab-resume-checker" className="space-y-8">
            <Suspense fallback={
              <Card className="bg-card/10 border-border/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-pulse text-white/50">Loading Resume Checker...</div>
                  </div>
                </CardContent>
              </Card>
            }>
            <ResumeChecker />
            </Suspense>
          </div>
        );

      case "integrations":
        return (
          <div id="settings-tab-integrations" data-tour="settings-tab-integrations" className="space-y-6">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 hover:border-white/[0.1] transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white/95">Gmail</h3>
                    <p className="text-xs text-white/50 mt-0.5">Connect to receive job alerts and schedule interviews</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className={`border-white/[0.08] transition-all ${
                    isGmailConnected
                      ? "text-[#1dff00] border-[#1dff00]/30 bg-[#1dff00]/[0.05]"
                      : "text-white/70 hover:text-white/90 hover:bg-white/[0.03]"
                  }`}
                  onClick={handleConnectGmail}
                  disabled={isGmailConnected}
                >
                  <Link className="w-4 h-4 mr-2" />
                  {isGmailConnected ? "Connected" : "Connect"}
                </Button>
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 hover:border-white/[0.1] transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
                    <Linkedin className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white/95">LinkedIn</h3>
                    <p className="text-xs text-white/50 mt-0.5">Connect to sync your profile and apply to jobs</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-white/[0.08] text-white/70 hover:text-white/90 hover:bg-white/[0.03]"
                >
                  <Link className="w-4 h-4 mr-2" />
                  Connect
                </Button>
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 hover:border-white/[0.1] transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-500/10 to-gray-500/5 border border-gray-500/20 flex items-center justify-center">
                    <Github className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white/95">GitHub</h3>
                    <p className="text-xs text-white/50 mt-0.5">Connect to showcase your projects</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-white/[0.08] text-white/70 hover:text-white/90 hover:bg-white/[0.03]"
                >
                  <Link className="w-4 h-4 mr-2" />
                  Connect
                </Button>
              </div>
            </div>
          </div>
        );

      case "billing":
        return (
          <div id="settings-tab-billing" data-tour="settings-tab-billing" className="space-y-6">
            {/* Current Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Credits Balance */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 hover:border-white/[0.1] transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-[#1dff00]/10 border border-[#1dff00]/20">
                    <Sparkles className="w-5 h-5 text-[#1dff00]" />
                  </div>
                  <span className="text-xs font-semibold text-[#1dff00] bg-[#1dff00]/10 px-2 py-1 rounded-full">
                    BALANCE
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-white/50 uppercase tracking-wider">Current Credits</p>
                  <p className="text-3xl font-bold text-white">
                    {currentCredits.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Active Plan */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 hover:border-white/[0.1] transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${getTierGradient(billingSubscriptionTier)}/10 border border-white/10`}>
                    {getTierIcon(billingSubscriptionTier)}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    billingSubscriptionTier === 'Pro' ? 'bg-blue-500/20 text-blue-300' :
                    billingSubscriptionTier === 'Ultimate' ? 'bg-purple-500/20 text-purple-300' :
                    'bg-[#1dff00]/20 text-[#1dff00]'
                  }`}>
                    {billingSubscriptionTier.toUpperCase()}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-white/50 uppercase tracking-wider">Active Plan</p>
                  <p className="text-3xl font-bold text-white">
                    {billingSubscriptionTier}
                  </p>
                  <p className="text-xs text-white/50">
                    {subscriptionPlans.find(p => p.name === billingSubscriptionTier)?.credits_per_month?.toLocaleString() || 0} credits/month
                  </p>
                </div>
              </div>

              {/* Next Refill */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 hover:border-white/[0.1] transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <CreditCard className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full">
                    REFILL
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-white/50 uppercase tracking-wider">Next Credit Refill</p>
                  <p className="text-sm font-semibold text-white">
                    {currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not scheduled'}
                  </p>
                </div>
              </div>
            </div>

            {/* Available Plans */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-medium text-white/95">Subscription Plans</h3>
                  <p className="text-sm text-white/50 mt-0.5">Choose the plan that fits your needs</p>
                </div>
                <Button
                  className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 font-medium transition-all"
                  onClick={() => { window.location.href = '/dashboard/billing'; }}
                >
                  View All Plans
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                {subscriptionPlans.slice(0, 4).map((plan) => {
                  const isCurrentPlan = plan.name === billingSubscriptionTier;
                  
                  return (
                    <div
                      key={plan.id}
                      className={`group relative p-5 rounded-xl border transition-all hover:shadow-lg hover:shadow-[#1dff00]/5 hover:-translate-y-0.5 ${
                        isCurrentPlan 
                          ? 'border-[#1dff00]/40 bg-gradient-to-br from-[#1dff00]/[0.08] to-transparent shadow-[0_0_20px_rgba(29,255,0,0.1)]' 
                          : 'border-white/[0.08] bg-gradient-to-br from-white/[0.02] to-transparent'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-lg bg-black/30 flex items-center justify-center">
                            {getTierIcon(plan.name)}
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-white">{plan.name}</h4>
                            <p className="text-xs text-gray-400">monthly</p>
                          </div>
                        </div>
                        {isCurrentPlan && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-[#1dff00] text-black border border-[#1dff00] rounded-md flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            ACTIVE
                          </span>
                        )}
                      </div>

                      {/* Price */}
                      <div className="mb-3">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-white">${plan.price}</span>
                          {plan.price > 0 && (
                            <span className="text-sm text-gray-400">/mo</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{plan.description}</p>
                      </div>

                      {/* Credits */}
                      <div className="flex items-center gap-2 p-2.5 bg-black/30 rounded-lg mb-3">
                        <Zap className="w-3.5 h-3.5 text-[#1dff00]" />
                        <span className="text-xs text-white font-medium">{plan.credits_per_month} credits</span>
                        <span className="text-xs text-gray-500">per cycle</span>
                      </div>

                      {/* Features */}
                      <div className="space-y-1.5 mb-4">
                        {plan.features && Array.isArray(plan.features) && plan.features.slice(0, 3).map((feature: any, idx: number) => {
                          const featureName = typeof feature === 'string' ? feature : feature.name;
                          const isIncluded = typeof feature === 'object' ? feature.included !== false : true;
                          
                          if (!isIncluded) return null;
                          
                          return (
                            <div key={idx} className="flex items-start gap-2">
                              <Check className="w-3.5 h-3.5 text-[#1dff00] mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-gray-300 line-clamp-1">{featureName}</span>
                            </div>
                          );
                        })}
                        {(plan.features?.length || 0) > 3 && (
                          <p className="text-xs text-gray-500 pl-5">+{plan.features.length - 3} more</p>
                        )}
                      </div>

                      {/* CTA */}
                      {!isCurrentPlan && (
                        <Button
                          className={`w-full h-9 font-medium text-xs transition-all ${
                            plan.name === 'Pro'
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:opacity-90 hover:scale-105'
                              : plan.name === 'Ultimate'
                              ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:opacity-90 hover:scale-105'
                              : 'bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-black hover:opacity-90 hover:scale-105'
                          }`}
                          onClick={() => { window.location.href = '/dashboard/billing'; }}
                        >
                          Upgrade to {plan.name}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white/95 mb-4">Quick Actions</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="justify-start border-white/[0.08] text-white/70 hover:text-white/90 hover:bg-white/[0.03] h-auto py-3"
                  onClick={() => { window.location.href = '/dashboard/billing'; }}
                >
                  <CreditCard className="w-4 h-4 mr-3" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Purchase Credits</div>
                    <div className="text-xs text-white/50">Buy one-time credit packs</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start border-white/[0.08] text-white/70 hover:text-white/90 hover:bg-white/[0.03] h-auto py-3"
                  onClick={() => { window.location.href = '/dashboard/billing'; }}
                >
                  <Download className="w-4 h-4 mr-3" />
                  <div className="text-left">
                    <div className="text-sm font-medium">View History</div>
                    <div className="text-xs text-white/50">See all transactions</div>
                  </div>
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 py-6">
        {/* Modern Header */}
        <div className="mb-8 border-b border-white/[0.06] pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-medium tracking-tight text-white/95 mb-1">Settings</h1>
              <p className="text-sm text-white/50">Manage your account preferences and configurations</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleResetForm}
                className="border-white/[0.08] text-white/70 hover:text-white/90 hover:bg-white/[0.03] hover:border-white/[0.12] transition-all"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button
                variant="outline"
                onClick={handleExportData}
                className="border-white/[0.08] text-white/70 hover:text-white/90 hover:bg-white/[0.03] hover:border-white/[0.12] transition-all"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Minimal Sidebar Navigation */}
          <div className="lg:col-span-1 space-y-1" id="settings-tablist" data-tour="settings-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  try { window.dispatchEvent(new CustomEvent('tour:event', { detail: { type: 'settings_tab_switch', tab: tab.id } })); } catch {}
                }}
                id={`settings-tab-btn-${tab.id}`}
                data-tour={`settings-tab-btn-${tab.id}`}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
                  activeTab === tab.id
                    ? "text-white/95 bg-white/[0.06] border border-white/[0.08]"
                    : "text-white/50 hover:text-white/80 hover:bg-white/[0.03]"
                }`}
              >
                <span className={activeTab === tab.id ? "text-[#1dff00]" : "text-white/40"}>
                  {tab.icon}
                </span>
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
            
            <div className="pt-4 mt-4 border-t border-white/[0.06]">
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = '/login';
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-4">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div id="settings-profile-form" data-tour="settings-profile-form">
                {activeLoading ? <TabSkeleton /> : renderTabContent()}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
    {/* 2FA Setup Modal */}
    <TwoFAModal />
    {/* Backup Codes Display Modal */}
    <Modal
      open={showBackupCodesModal}
      onClose={() => {
        setShowBackupCodesModal(false);
        setGeneratedBackupCodes(null);
      }}
      title="Your Backup Codes"
      size="lg"
      side="center"
    >
      {generatedBackupCodes && generatedBackupCodes.length > 0 ? (
        <div className="space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-sm text-yellow-400 font-medium mb-2">⚠️ Important: Save these codes now</p>
            <p className="text-xs text-yellow-300/80">
              These codes are shown only once. Store them in a safe place. Each code can only be used once.
              A file has been automatically downloaded to your device.
            </p>
          </div>
          <div className="bg-white/[0.05] border border-white/[0.1] rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3">
              {generatedBackupCodes.map((code, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-black/50 border border-white/[0.1] rounded font-mono text-sm text-white/90"
                >
                  <span>{code}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(code);
                      success(`Code ${index + 1} copied`);
                    }}
                    className="h-6 w-6 p-0 text-white/50 hover:text-white hover:bg-white/[0.1]"
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                const allCodes = generatedBackupCodes.join('\n');
                navigator.clipboard.writeText(allCodes);
                success('All codes copied to clipboard');
              }}
              className="flex-1 bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
            >
              Copy All Codes
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowBackupCodesModal(false);
                setGeneratedBackupCodes(null);
              }}
              className="border-white/[0.1] text-white/70 hover:bg-white/[0.05]"
            >
              I've Saved Them
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-white/70">No codes to display</p>
        </div>
      )}
    </Modal>
    {/* Data Deletion Request Modal */}
    <Modal
      open={showDeletionRequestModal}
      onClose={() => {
        setShowDeletionRequestModal(false);
        setDeletionRequestType('partial_deletion');
        setDeletionRequestReason("");
        setSelectedDataTypes([]);
      }}
      title="Request Data Deletion"
      size="lg"
      side="center"
    >
      <div className="space-y-4">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-sm text-yellow-400 font-medium mb-2">⚠️ Important Information</p>
          <p className="text-xs text-yellow-300/80">
            Data deletion requests are processed within 30 days. Once deleted, data cannot be recovered.
            You can cancel a pending request at any time before processing begins.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-white/90 mb-2">Deletion Type</label>
          <div className="space-y-2">
            {[
              { value: 'partial_deletion', label: 'Partial Deletion', desc: 'Delete specific data types only' },
              { value: 'anonymization', label: 'Anonymization', desc: 'Remove personally identifiable information' },
              { value: 'full_deletion', label: 'Full Account Deletion', desc: 'Delete all data and close account' }
            ].map((type) => (
              <label key={type.value} className="flex items-start gap-3 p-3 bg-white/[0.05] border border-white/[0.1] rounded-lg cursor-pointer hover:bg-white/[0.08] transition-colors">
                <input
                  type="radio"
                  name="deletionType"
                  value={type.value}
                  checked={deletionRequestType === type.value}
                  onChange={(e) => setDeletionRequestType(e.target.value as any)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white/90">{type.label}</p>
                  <p className="text-xs text-white/50 mt-0.5">{type.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        {deletionRequestType === 'partial_deletion' && (
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">Select Data Types to Delete</label>
            <div className="space-y-2">
              {['profile', 'applications', 'resumes', 'notifications', 'jobs', 'bookmarks', 'cover_letters'].map((type) => (
                <label key={type} className="flex items-center gap-3 p-2 bg-white/[0.05] border border-white/[0.1] rounded-lg cursor-pointer hover:bg-white/[0.08] transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedDataTypes.includes(type)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDataTypes([...selectedDataTypes, type]);
                      } else {
                        setSelectedDataTypes(selectedDataTypes.filter(t => t !== type));
                      }
                    }}
                  />
                  <span className="text-sm text-white/90 capitalize">{type.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-white/90 mb-2">Reason (Optional)</label>
          <textarea
            value={deletionRequestReason}
            onChange={(e) => setDeletionRequestReason(e.target.value)}
            placeholder="Tell us why you're requesting data deletion..."
            className="w-full p-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder-white/40 text-sm resize-none"
            rows={3}
          />
        </div>
        <div className="flex gap-3">
          <Button
            onClick={async () => {
              try {
                if (deletionRequestType === 'partial_deletion' && selectedDataTypes.length === 0) {
                  toastError('Validation Error', 'Please select at least one data type for partial deletion');
                  return;
                }
                await createDeletionRequest(
                  deletionRequestType,
                  deletionRequestType === 'partial_deletion' ? selectedDataTypes : undefined,
                  deletionRequestReason || undefined
                );
                success('Deletion request submitted');
                setShowDeletionRequestModal(false);
                setDeletionRequestType('partial_deletion');
                setDeletionRequestReason("");
                setSelectedDataTypes([]);
              } catch (e: any) {
                toastError('Failed to submit request', e.message);
              }
            }}
            className="flex-1 bg-red-500 text-white hover:bg-red-600"
          >
            Submit Request
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowDeletionRequestModal(false);
              setDeletionRequestType('partial_deletion');
              setDeletionRequestReason("");
              setSelectedDataTypes([]);
            }}
            className="border-white/[0.1] text-white/70 hover:bg-white/[0.05]"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
    {/* Account Deletion Confirmation Modal */}
    <Modal
      open={showAccountDeletionModal}
      onClose={() => {
        if (!isDeleting) {
          setShowAccountDeletionModal(false);
          setAccountDeletionEmail("");
        }
      }}
      title="Delete Account Permanently"
      size="lg"
      side="center"
    >
      <div className="space-y-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400 mb-2">⚠️ This action cannot be undone</p>
              <p className="text-xs text-red-300/80 leading-relaxed">
                Deleting your account will permanently remove all your data including:
              </p>
              <ul className="text-xs text-red-300/80 mt-2 space-y-1 list-disc list-inside">
                <li>Your profile and personal information</li>
                <li>All job applications and saved jobs</li>
                <li>Resumes, cover letters, and documents</li>
                <li>Notification and privacy settings</li>
                <li>Security settings and backup codes</li>
                <li>Credit balance and transaction history</li>
                <li>All other account-related data</li>
              </ul>
              <p className="text-xs text-red-300/80 mt-3 font-medium">
                This process is irreversible. Please ensure you have exported any data you wish to keep.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-sm text-yellow-400 font-medium mb-2">🔒 Security Confirmation Required</p>
          <p className="text-xs text-yellow-300/80">
            To confirm account deletion, please type your email address below:
          </p>
          <p className="text-xs text-yellow-300/60 mt-1 font-mono">
            {userEmail}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/90 mb-2">
            Type your email to confirm deletion
          </label>
          <Input
            type="email"
            value={accountDeletionEmail}
            onChange={(e) => setAccountDeletionEmail(e.target.value)}
            placeholder={userEmail || "your@email.com"}
            disabled={isDeleting}
            className="bg-white/[0.05] border-white/[0.1] text-white placeholder-white/40"
            autoComplete="off"
          />
          {accountDeletionEmail && accountDeletionEmail.toLowerCase().trim() !== userEmail.toLowerCase().trim() && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <X className="w-3 h-3" />
              Email does not match
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
          <input
            type="checkbox"
            id="confirm-deletion"
            className="mt-1"
            disabled={isDeleting}
          />
          <label htmlFor="confirm-deletion" className="text-xs text-white/70 cursor-pointer">
            I understand that this action is permanent and cannot be undone. I have exported any data I wish to keep.
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={async () => {
              const emailInput = accountDeletionEmail.toLowerCase().trim();
              const userEmailLower = userEmail.toLowerCase().trim();
              
              if (!emailInput) {
                toastError('Validation Error', 'Please enter your email address');
                return;
              }

              if (emailInput !== userEmailLower) {
                toastError('Validation Error', 'Email address does not match');
                return;
              }

              const checkbox = document.getElementById('confirm-deletion') as HTMLInputElement;
              if (!checkbox?.checked) {
                toastError('Validation Error', 'Please confirm that you understand this action is permanent');
                return;
              }

              setIsDeleting(true);
              try {
                const { data } = await supabase.auth.getUser();
                const uid = (data as any)?.user?.id;
                
                if (!uid) {
                  throw new Error('User not found');
                }

                // Log the deletion request with security audit
                await logPrivacyAction('account_deletion_confirmed', {
                  email_confirmed: true,
                  deletion_method: 'user_initiated'
                });

                // Create a deletion request record
                try {
                  await createDeletionRequest('full_deletion', undefined, 'User-initiated account deletion');
                } catch (e) {
                  console.warn('Failed to create deletion request record:', e);
                }

                // Delete all user data (RLS policies will ensure user can only delete their own data)
                const deletePromises = [
                  (supabase as any).from('profiles').delete().eq('id', uid),
                  (supabase as any).from('notification_settings').delete().eq('id', uid),
                  (supabase as any).from('security_settings').delete().eq('id', uid),
                  (supabase as any).from('security_backup_codes').delete().eq('user_id', uid),
                  (supabase as any).from('security_trusted_devices').delete().eq('user_id', uid),
                  (supabase as any).from('security_active_sessions').delete().eq('user_id', uid),
                  (supabase as any).from('security_api_keys').delete().eq('user_id', uid),
                  (supabase as any).from('privacy_settings').delete().eq('id', uid),
                  (supabase as any).from('privacy_audit_log').delete().eq('user_id', uid),
                  (supabase as any).from('privacy_data_deletion_requests').delete().eq('user_id', uid),
                  (supabase as any).from('applications').delete().eq('user_id', uid),
                  (supabase as any).from('jobs').delete().eq('user_id', uid),
                  (supabase as any).from('bookmarks').delete().eq('user_id', uid),
                  (supabase as any).from('notifications').delete().eq('user_id', uid),
                  (supabase as any).from('resumes').delete().eq('user_id', uid),
                  (supabase as any).from('cover_letters').delete().eq('user_id', uid),
                  (supabase as any).from('credit_transactions').delete().eq('user_id', uid),
                  (supabase as any).from('user_credits').delete().eq('user_id', uid),
                  (supabase as any).from('user_subscriptions').delete().eq('user_id', uid),
                ];

                await Promise.all(deletePromises);

                // Sign out and redirect
                await supabase.auth.signOut();
                success('Account deleted successfully');
                
                // Small delay before redirect to show success message
                setTimeout(() => {
                  window.location.href = '/';
                }, 1000);
              } catch (e: any) {
                setIsDeleting(false);
                toastError('Deletion failed', e.message || 'An error occurred while deleting your account. Please try again or contact support.');
              }
            }}
            disabled={isDeleting || accountDeletionEmail.toLowerCase().trim() !== userEmail.toLowerCase().trim()}
            className="flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Deleting Account...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete My Account
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowAccountDeletionModal(false);
              setAccountDeletionEmail("");
            }}
            disabled={isDeleting}
            className="border-white/[0.1] text-white/70 hover:bg-white/[0.05] disabled:opacity-50"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
    {/* API Key Creation Modal */}
    <Modal
      open={apiKeyModalOpen}
      onClose={() => {
        setApiKeyModalOpen(false);
        setCreatedApiKey(null);
        setNewApiKeyName("");
        setNewApiKeyExpiry(undefined);
        setNewApiKeyIpRestrictions("");
      }}
      title={createdApiKey ? "API Key Created" : "Create New API Key"}
      size="md"
      side="center"
    >
      {createdApiKey ? (
        <div className="space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-sm text-yellow-400 font-medium mb-2">⚠️ Important: Save this key now</p>
            <p className="text-xs text-yellow-300/80">You won't be able to see this key again. Copy it to a secure location.</p>
          </div>
          <div className="bg-white/[0.05] border border-white/[0.1] rounded-lg p-4">
            <p className="text-xs text-white/50 mb-2">Your API Key:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/50 border border-white/[0.1] rounded px-3 py-2 text-sm text-white/90 font-mono break-all">
                {createdApiKey}
              </code>
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(createdApiKey);
                  success('API key copied to clipboard');
                }}
                className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
              >
                Copy
              </Button>
            </div>
          </div>
          <Button
            onClick={() => {
              setApiKeyModalOpen(false);
              setCreatedApiKey(null);
              setNewApiKeyName("");
              setNewApiKeyExpiry(undefined);
              setNewApiKeyIpRestrictions("");
            }}
            className="w-full bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
          >
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">Key Name</label>
            <Input
              type="text"
              placeholder="e.g., Production API, Development"
              value={newApiKeyName}
              onChange={(e) => setNewApiKeyName(e.target.value)}
              className="bg-white/[0.05] border-white/[0.1] text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">Expires In (days, optional)</label>
            <Input
              type="number"
              placeholder="Leave empty for no expiration"
              value={newApiKeyExpiry || ""}
              onChange={(e) => setNewApiKeyExpiry(e.target.value ? parseInt(e.target.value) : undefined)}
              className="bg-white/[0.05] border-white/[0.1] text-white"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">IP Restrictions (comma-separated, optional)</label>
            <Input
              type="text"
              placeholder="e.g., 192.168.1.1, 10.0.0.1"
              value={newApiKeyIpRestrictions}
              onChange={(e) => setNewApiKeyIpRestrictions(e.target.value)}
              className="bg-white/[0.05] border-white/[0.1] text-white"
            />
            <p className="text-xs text-white/50 mt-1">Leave empty to allow from any IP</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={async () => {
                if (!newApiKeyName.trim()) {
                  toastError('Validation Error', 'Key name is required');
                  return;
                }
                try {
                  const ipRestrictions = newApiKeyIpRestrictions
                    .split(',')
                    .map(ip => ip.trim())
                    .filter(ip => ip.length > 0);
                  const result = await createApiKey(newApiKeyName, newApiKeyExpiry, ipRestrictions.length > 0 ? ipRestrictions : undefined);
                  if (result && result.key) {
                    setCreatedApiKey(result.key);
                  }
                } catch (e: any) {
                  toastError('Failed to create API key', e.message);
                }
              }}
              disabled={!newApiKeyName.trim()}
              className="flex-1 bg-[#1dff00] text-black hover:bg-[#1dff00]/90 disabled:opacity-50"
            >
              Create Key
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setApiKeyModalOpen(false);
                setNewApiKeyName("");
                setNewApiKeyExpiry(undefined);
                setNewApiKeyIpRestrictions("");
              }}
              className="border-white/[0.1] text-white/70 hover:bg-white/[0.05]"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
    </>
  );

  // 2FA Setup Modal
  function TwoFAModal() {
    return (
      <Modal
        open={open2FA}
        onClose={() => setOpen2FA(false)}
        title="Set up Two-Factor Authentication"
        size="md"
        side="center"
      >
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Scan the QR code in your authenticator app (e.g., Google Authenticator, Authy), then enter the 6-digit code below.
          </p>
      {qrDataUrl ? (
            <div className="flex justify-center">
        <img src={qrDataUrl} alt="TOTP QR" className="rounded border border-primary/30" />
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">Generating QR…</div>
          )}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Authentication code</label>
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="123456"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="bg-card/10 border-border/20 text-foreground focus:border-primary hover:border-border/30 transition-all duration-300"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="border-border/20 text-foreground hover:bg-card/20 hover:border-primary/50"
              onClick={() => setOpen2FA(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  if (!totpFactorId || !totpCode || verifyBusy) return;
                  setVerifyBusy(true);
                  await verifyTotp(totpFactorId, totpCode);
                  setOpen2FA(false);
                } catch (e: any) {
                  toastError('Verification failed', e.message);
                } finally { setVerifyBusy(false); }
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Verify & Enable
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // remove stray return (modal is rendered above)
};

function DefaultsForm() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [includeLinkedIn, setIncludeLinkedIn] = useState(true);
  const [includeIndeed, setIncludeIndeed] = useState(true);
  const [includeSearch, setIncludeSearch] = useState(true);
  const [allowedDomains, setAllowedDomains] = useState<string>("");
  const [enabledSources, setEnabledSources] = useState<string[]>(["deepresearch","remotive","remoteok","arbeitnow"]);
  const [cronEnabled, setCronEnabled] = useState<boolean>(false);
  // Test search helpers
  const [testQuery, setTestQuery] = useState<string>("software engineer");
  const [testLocation, setTestLocation] = useState<string>("Remote");
  const [testing, setTesting] = useState<boolean>(false);
  const [testCount, setTestCount] = useState<number | null>(null);
  const [testNote, setTestNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = (auth as any)?.user?.id;
        if (!uid) { setLoading(false); return; }
        const { data } = await (supabase as any)
          .from('job_source_settings')
          .select('include_linkedin, include_indeed, include_search, allowed_domains, enabled_sources, cron_enabled')
          .eq('id', uid)
          .maybeSingle();
        if (data) {
          if (data.include_linkedin != null) setIncludeLinkedIn(!!data.include_linkedin);
          if (data.include_indeed != null) setIncludeIndeed(!!data.include_indeed);
          if (data.include_search != null) setIncludeSearch(!!data.include_search);
          if (Array.isArray(data.allowed_domains)) setAllowedDomains(data.allowed_domains.join(','));
          if (Array.isArray(data.enabled_sources)) setEnabledSources(data.enabled_sources);
          if (typeof (data as any).cron_enabled === 'boolean') setCronEnabled(!!(data as any).cron_enabled);
        }
      } catch (e: any) { console.warn(e); }
      setLoading(false);
    })();
  }, [supabase]);

  const toggle = (arr: string[], key: string, on: boolean) => {
    if (on) return Array.from(new Set([...arr, key]));
    return arr.filter((x) => x !== key);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = (auth as any)?.user?.id;
      if (!uid) { setSaving(false); return; }
      const payload = {
        id: uid,
        include_linkedin: includeLinkedIn,
        include_indeed: includeIndeed,
        include_search: includeSearch,
        allowed_domains: allowedDomains.split(',').map((s) => s.trim()).filter(Boolean),
        enabled_sources: enabledSources,
        cron_enabled: cronEnabled,
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any)
        .from('job_source_settings')
        .upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      success('Saved');
    } catch (e: any) {
      toastError('Save failed', e.message);
    }
    setSaving(false);
  };

  const runNow = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = (auth as any)?.user?.id;
      if (!uid) return;
      const { data, error } = await (supabase as any).functions.invoke('jobs-cron', { body: { user_id: uid, manual_trigger: true } });
      if (error) throw error;
      success('Job fetch started');
      console.log('jobs-cron result', data);
    } catch (e: any) {
      toastError('Trigger failed', e.message);
    }
  };

  const testSearch = async () => {
    setTesting(true);
    setTestNote(null);
    setTestCount(null);
    try {
      const { data, error } = await (supabase as any).functions.invoke('get-jobs', {
        body: {
          q: (testQuery || 'software engineer').trim(),
          location: (testLocation || 'Remote').trim(),
          type: '',
        },
      });
      if (error) throw error;
      const rows = Array.isArray(data?.jobs) ? data.jobs : [];
      setTestCount(rows.length);
      setTestNote('Success');
    } catch (e: any) {
      setTestNote(e?.message || 'Failed');
    } finally {
      setTesting(false);
    }
  };

  const sourceDefs = [
    { id: 'deepresearch', label: 'Deep Research (Firecrawl)' },
    { id: 'remotive', label: 'Remotive' },
    { id: 'remoteok', label: 'RemoteOK' },
    { id: 'arbeitnow', label: 'Arbeitnow' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeLinkedIn} onChange={(e) => setIncludeLinkedIn(e.target.checked)} disabled={loading} />
          Include LinkedIn
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeIndeed} onChange={(e) => setIncludeIndeed(e.target.checked)} disabled={loading} />
          Include Indeed
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeSearch} onChange={(e) => setIncludeSearch(e.target.checked)} disabled={loading} />
          Include Search/Listing pages
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cronEnabled} onChange={(e) => setCronEnabled(e.target.checked)} disabled={loading} />
          Background Cron Enabled
        </label>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">Enabled Sources</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sourceDefs.map((s) => (
            <label key={s.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(var(--ring))]"
                checked={enabledSources.includes(s.id)}
                onChange={(e) => setEnabledSources((prev) => toggle(prev, s.id, e.target.checked))}
                disabled={loading}
              />
              <span className="text-sm">{s.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Allowed Domains (comma separated)</label>
        <Input value={allowedDomains} onChange={(e) => setAllowedDomains(e.target.value)} placeholder="careers.google.com, amazon.jobs" />
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving || loading} className="bg-primary text-primary-foreground hover:bg-primary/90">Save</Button>
        <Button variant="outline" onClick={runNow} disabled={loading} className="border-border/20 text-foreground hover:bg-card/20">Run now</Button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Status:</span>
          <span className={`${cronEnabled ? 'text-success' : 'text-muted-foreground'}`}>{cronEnabled ? 'Cron on' : 'Cron off'}</span>
        </div>
      </div>
      {/* Test Search Area */}
      <div className="mt-3 p-3 rounded-md border border-border/20 bg-card/5">
        <div className="text-sm font-medium mb-2">Test Search</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <Input value={testQuery} onChange={(e) => setTestQuery(e.target.value)} placeholder="Query (e.g., software engineer)" />
          <Input value={testLocation} onChange={(e) => setTestLocation(e.target.value)} placeholder="Location (e.g., Remote)" />
          <Button onClick={testSearch} disabled={testing} className="bg-primary text-primary-foreground hover:bg-primary/90">{testing ? 'Testing…' : 'Test Search'}</Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {testCount != null ? <span>Jobs: <span className="text-foreground font-semibold">{testCount}</span></span> : 'Run a test to validate DB fallback.'}
          {testNote && <span className="ml-2">({testNote})</span>}
        </div>
      </div>
    </div>
  );
}