import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  TOUR_PAGE_LABELS,
  useProductTour,
  useRegisterCoachMarks,
} from "../../../providers/TourProvider";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { motion } from "framer-motion";
import {
  LogOut,
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  CreditCard,
  Upload,
  Trash2,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  Settings as SettingsIcon,
  Plus,
  Link,
  Search,
  Briefcase,
  Building,
  Users,
  Sparkles,
  Mail,
  Zap,
  Crown,
  Check,
  ArrowRight,
  FileText,
  Database,
  Cookie,
  MapPin,
  Activity,
  Share2,
  AlertTriangle,
  History,
  X,
  LifeBuoy,
} from "lucide-react";
import remoteCoLogo from "../../../assets/job-sources/remote-co.svg";
import remotiveLogo from "../../../assets/job-sources/remotive.svg";
import remoteokLogo from "../../../assets/job-sources/remoteok.svg";
import jobicyLogo from "../../../assets/job-sources/jobicy.svg";
import levelsFyiLogo from "../../../assets/job-sources/levels-fyi.svg";
import { useProfileSettings } from "../../../hooks/useProfileSettings";
import { useNotificationSettings } from "../../../hooks/useNotificationSettings";
import { usePrivacySettings } from "../../../hooks/usePrivacySettings";
import { useSecuritySettings } from "../../../hooks/useSecuritySettings";
import { createClient } from "../../../lib/supabaseClient";
import { useAppearance } from "../../../providers/AppearanceProvider";
import { useToast } from "../../../components/ui/toast";
import { AnswerBankPanel } from "../components/AnswerBankPanel";
import Modal from "../../../components/ui/modal";
import { validatePassword } from "../../../utils/password";
import {
  CheckCircle2,
  XCircle,
  Linkedin,
  Github,
  Key,
  Lock,
} from "lucide-react";
import { encryptSymmetric } from "../../../utils/crypto";
import { UpgradePrompt } from "../../../components/UpgradePrompt";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { hasSubscriptionAccess } from "@/lib/subscriptionAccess";
import { getProxiedLogoUrl } from "../../../lib/utils";
import useMediaQuery from "@/hooks/use-media-query";
import { SupportFloatingWidget } from "@/components/support/SupportFloatingWidget";

const SignOutDialog = ({
  open,
  onConfirm,
  onCancel,
  isLoading,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) => {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title='Sign Out'
      size='md'
      side='center'
    >
      <div className='space-y-4'>
        <div className='bg-[#]/10 border border-[#]/20 rounded-lg p-4'>
          <div className='flex items-start gap-3'>
            <LogOut className='w-5 h-5 text-[#] mt-0.5 flex-shrink-0' />
            <div className='flex-1'>
              <p className='text-sm font-medium text-[#] mb-2'>
                Are you sure you want to sign out?
              </p>
              <p className='text-xs text-[#]/80'>
                You will need to sign in again to access your account.
              </p>
            </div>
          </div>
        </div>
        <div className='flex justify-end gap-3'>
          <Button
            variant='outline'
            onClick={onCancel}
            disabled={isLoading}
            className='border-foreground/[0.1] text-foreground/70 hover:bg-foreground/[0.05]'
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className='bg-red-600 text-foreground hover:bg-red-700'
          >
            {isLoading ? (
              <>
                <RefreshCw className='w-4 h-4 mr-2 animate-spin' />
                Signing Out...
              </>
            ) : (
              <>
                <LogOut className='w-4 h-4 mr-2' />
                Sign Out
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Lazy-load qrcode to avoid bundler resolution issues during build
let QRCodeLib: any | null = null;
async function getQRCode() {
  if (QRCodeLib) return QRCodeLib;
  QRCodeLib = await import("qrcode");
  return QRCodeLib;
}

export const SettingsPage = (): JSX.Element => {
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const { availablePages, isRunning, page: runningTourPage, start: startTour } =
    useProductTour();
  const { subscriptionTier, loadingTier } = useSubscriptionTier();
  const hasGmailIntegrationAccess = hasSubscriptionAccess(
    subscriptionTier,
    "Pro",
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const tabs = useMemo(() => {
    const baseTabs = [
      { id: "profile", label: "Profile", icon: <User className='w-4 h-4' /> },
      {
        id: "answer-bank",
        label: "Answer Bank",
        icon: <Database className='w-4 h-4' />,
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: <Bell className='w-4 h-4' />,
      },
      {
        id: "security",
        label: "Security",
        icon: <Shield className='w-4 h-4' />,
      },
      {
        id: "appearance",
        label: "Appearance",
        icon: <Palette className='w-4 h-4' />,
      },
      { id: "privacy", label: "Privacy", icon: <Globe className='w-4 h-4' /> },
      {
        id: "job-sources",
        label: "Job Sources",
        icon: <SettingsIcon className='w-4 h-4' />,
      },
      {
        id: "billing",
        label: "Billing",
        icon: <CreditCard className='w-4 h-4' />,
      },
    ];

    const billingIndex = baseTabs.findIndex((t) => t.id === "billing");
    baseTabs.splice(billingIndex, 0, {
      id: "integrations",
      label: "Integrations",
      icon: <Link className='w-4 h-4' />,
    });

    if (isAdmin) {
      const guidedToursIndex = baseTabs.findIndex((t) => t.id === "billing");
      baseTabs.splice(guidedToursIndex, 0, {
        id: "guided-tours",
        label: "Guided Tours",
        icon: <Sparkles className='w-4 h-4' />,
      });
    }

    if (!isDesktop) {
      baseTabs.push({
        id: "support",
        label: "Support",
        icon: <LifeBuoy className='w-4 h-4' />,
      });
    }

    return baseTabs;
  }, [isAdmin, isDesktop]);

  const activeTab = useMemo(() => {
    const segment = location.pathname.split("/")[3];
    const requestedTab = tabs.find((t) => t.id === segment);

    return requestedTab ? requestedTab.id : "profile";
  }, [location.pathname, tabs]);
  const [showPassword, setShowPassword] = useState(false);
  const defaultJobSources = useMemo(
    () => [
      { id: 1, type: "remotive", query: "software engineer", enabled: true },
      { id: 2, type: "remoteok", query: "", enabled: true },
      { id: 3, type: "arbeitnow", query: "typescript", enabled: false },
      { id: 4, type: "linkedin", query: "full stack developer", enabled: true },
      { id: 5, type: "indeed", query: "react developer", enabled: false },
      { id: 6, type: "trulyremote", query: "backend engineer", enabled: false },
    ],
    [],
  );
  const [jobSources, setJobSources] = useState(defaultJobSources);
  const {
    profile,
    updateProfile,
    createProfile,
    refresh: refreshProfile,
    loading: profileLoading,
  } = useProfileSettings();
  const {
    settings: notif,
    updateSettings,
    createSettings,
    refresh: refreshNotif,
    loading: notifLoading,
  } = useNotificationSettings() as any;
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
    logPrivacyAction,
  } = usePrivacySettings();
  const security = useSecuritySettings();
  const appearance = useAppearance();
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
    // listActiveSessions, // Unused
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
  type FormData = {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    location: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    avatar_url: string;
    linkedin_url: string;
    github_url: string;
  };
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    avatar_url: "",
    linkedin_url: "",
    github_url: "",
  });

  // 2FA modal state
  const [open2FA, setOpen2FA] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | undefined>();
  const [totpFactorId, setTotpFactorId] = useState<string | undefined>();
  const [totpCode, setTotpCode] = useState<string>("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  /** Address from Gmail profile / stored connection (status action). */
  const [gmailConnectedEmail, setGmailConnectedEmail] = useState<string | null>(
    null,
  );
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false);
  // API Key state
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [newApiKeyExpiry, setNewApiKeyExpiry] = useState<number | undefined>();
  const [newApiKeyIpRestrictions, setNewApiKeyIpRestrictions] =
    useState<string>("");
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  // IP Management state
  const [newAllowedIp, setNewAllowedIp] = useState("");
  // const [newBlockedIp, setNewBlockedIp] = useState(""); // Unused
  // Backup codes state
  const [generatedBackupCodes, setGeneratedBackupCodes] = useState<
    string[] | null
  >(null);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  // Privacy modals state
  const [showDeletionRequestModal, setShowDeletionRequestModal] =
    useState(false);
  const [deletionRequestType, setDeletionRequestType] = useState<
    "full_deletion" | "partial_deletion" | "anonymization"
  >("partial_deletion");
  const [deletionRequestReason, setDeletionRequestReason] = useState("");
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([]);
  // Account deletion modal state
  const [showAccountDeletionModal, setShowAccountDeletionModal] =
    useState(false);
  const [accountDeletionEmail, setAccountDeletionEmail] = useState("");
  const [userEmail, setUserEmail] = useState<string>("");
  const pendingEmailUpdateRef = useRef<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Sign out dialog state
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [enabledDefaultDomains, setEnabledDefaultDomains] = useState<
    Set<string>
  >(
    new Set([
      "dice.com",
      "wellfound.com",
      "hired.com",
      "ycombinator.com",
      "remote.co",
      "remotive.com",
      "remoteok.com",
      "jobicy.com",
      "levels.fyi",
      "greenhouse.io",
      "lever.co",
      "builtin.com",
      "workingnomads.com",
      "weworkremotely.com",
      "flexjobs.com",
      "cryptojobslist.com",
      "otta.com",
      "dice.com",
      "startup.jobs",
      "nodesk.co",
      "remoterocketship.com",
      "jobspresso.com",
      "talent.hubstaff.com",
      "flexa.careers",
      "jobs.micro1.ai",
    ]),
  );

  const [sourceCredentials, setSourceCredentials] = useState<
    Record<string, string>
  >({});
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [savingDomains, setSavingDomains] = useState(false);

  // Job Sources Dialog State
  const [configModalSource, setConfigModalSource] = useState<any>(null);
  const [configUsername, setConfigUsername] = useState("");
  const [configPassword, setConfigPassword] = useState("");
  const [configEncrypting, setConfigEncrypting] = useState(false);

  const passwordCheck = useMemo(
    () => validatePassword(formData.newPassword, formData.email),
    [formData.newPassword, formData.email],
  );

  // Get user email for account deletion confirmation
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user?.email) {
          setUserEmail(data.user.email);
        }
      } catch (e) {
        console.error("Failed to get user email:", e);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    (async () => {
      try {
        const { isCurrentUserAdmin } = await import("@/lib/adminUtils");
        setIsAdmin(await isCurrentUserAdmin());
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      }
    })();
  }, []);

  const handleConnectGmail = async () => {
    try {
      if (!hasGmailIntegrationAccess) {
        toastError(
          "Upgrade required",
          "Gmail integration is available on the Pro plan.",
        );
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toastError("Please sign in to connect your Gmail account.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("gmail-auth", {
        body: {
          action: "initiate",
          redirectUri: `${window.location.origin}/auth/callback/gmail`,
        },
      });

      if (error) {
        throw error;
      }

      const { redirectUrl } = data;
      // Do not use noopener: OAuth popup must keep window.opener so /auth/callback/gmail can postMessage back.
      window.open(redirectUrl, "_blank", "width=520,height=720");
    } catch (error: any) {
      const errorMessage =
        error.details ||
        (error as Error).message ||
        "An unknown error occurred.";
      toastError("Failed to connect Gmail", errorMessage);
    }
  };

  const checkGmailConnection = useCallback(async () => {
    try {
      if (loadingTier || !hasGmailIntegrationAccess) {
        setIsGmailConnected(false);
        setGmailConnectedEmail(null);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsGmailConnected(false);
        setGmailConnectedEmail(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke("gmail-auth", {
        body: {
          action: "status",
        },
      });

      if (error) {
        throw error;
      }

      const payload = data as {
        isConnected?: boolean;
        email?: string | null;
      } | null;

      if (payload?.isConnected !== undefined) {
        const connected = !!payload.isConnected;
        setIsGmailConnected(connected);
        const raw = payload.email;
        setGmailConnectedEmail(
          connected && typeof raw === "string" && raw.trim().length > 0
            ? raw.trim()
            : null,
        );
      }
    } catch (error: unknown) {
      console.error("Failed to check Gmail connection status:", error);
      setIsGmailConnected(false);
      setGmailConnectedEmail(null);
    }
  }, [hasGmailIntegrationAccess, loadingTier, supabase]);

  const handleDisconnectGmail = useCallback(async () => {
    if (!hasGmailIntegrationAccess) {
      toastError(
        "Upgrade required",
        "Gmail integration is available on the Pro plan.",
      );
      return;
    }
    setGmailDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("gmail-auth", {
        body: { action: "disconnect" },
      });
      if (error) {
        throw error;
      }
      await checkGmailConnection();
      success(
        "Gmail disconnected",
        "JobRaker no longer has access to your inbox. You can reconnect anytime.",
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Could not disconnect Gmail.";
      toastError("Disconnect failed", message);
    } finally {
      setGmailDisconnecting(false);
    }
  }, [
    hasGmailIntegrationAccess,
    supabase,
    checkGmailConnection,
    success,
    toastError,
  ]);

  useEffect(() => {
    void checkGmailConnection();
  }, [checkGmailConnection]);

  useEffect(() => {
    if (activeTab === "integrations") {
      void checkGmailConnection();
    }
  }, [activeTab, checkGmailConnection]);

  useEffect(() => {
    if (activeTab !== "integrations" || !hasGmailIntegrationAccess) {
      return;
    }
    let debounce: ReturnType<typeof setTimeout>;
    const onFocus = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void checkGmailConnection(), 300);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(debounce);
      window.removeEventListener("focus", onFocus);
    };
  }, [activeTab, hasGmailIntegrationAccess, checkGmailConnection]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("gmail") !== "connected") {
      return;
    }
    params.delete("gmail");
    const next = params.toString();
    navigate(
      { pathname: location.pathname, search: next ? `?${next}` : "" },
      { replace: true },
    );
    void checkGmailConnection();
    success("Gmail connected successfully!");
  }, [
    location.pathname,
    location.search,
    navigate,
    checkGmailConnection,
    success,
  ]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      const messageType =
        typeof event.data === "string" ? event.data : event.data?.type;

      if (messageType === "gmail-auth-error") {
        toastError(
          "Failed to connect Gmail",
          typeof event.data === "object" &&
            event.data &&
            "message" in event.data
            ? String((event.data as { message?: string }).message)
            : "Please try again.",
        );
        return;
      }

      if (messageType === "gmail-auth-success") {
        if (!hasGmailIntegrationAccess) {
          toastError(
            "Upgrade required",
            "Gmail integration is available on the Pro plan.",
          );
          return;
        }

        await checkGmailConnection();
        success("Gmail connected successfully!");
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [hasGmailIntegrationAccess, checkGmailConnection, success, toastError]);

  const initials = useMemo(() => {
    const a = (formData.firstName || "").trim();
    const b = (formData.lastName || "").trim();
    if (a || b)
      return `${a.charAt(0) || ""}${b.charAt(0) || ""}`.toUpperCase() || "U";
    const email = formData.email || "";
    return (email.charAt(0) || "U").toUpperCase();
  }, [formData.firstName, formData.lastName, formData.email]);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // const [groupEnabledFirst, setGroupEnabledFirst] = useState(true); // Unused
  // const [draggingId, setDraggingId] = useState<number | null>(null); // Unused
  // const [dragOverId, setDragOverId] = useState<number | null>(null); // Unused

  // Billing state
  const [currentCredits, setCurrentCredits] = useState(0);
  const [billingSubscriptionTier, setBillingSubscriptionTier] = useState<
    "Free" | "Basics" | "Pro" | "Ultimate"
  >("Free");
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);

  // Small helper for URL validation (used for Custom JSON)
  // const isValidUrl = (value: string) => {
  //   try { new URL(value); return true; } catch { return false; }
  // }; // Unused

  // Persist job sources locally so settings survive refreshes
  useEffect(() => {
    try {
      const raw = localStorage.getItem("jobSources");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setJobSources(parsed);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("jobSources", JSON.stringify(jobSources));
    } catch {
      /* ignore */
    }
  }, [jobSources]);

  // Try loading job sources from backend table if present; fallback to local
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = (auth as any)?.user?.id;
        if (!uid) return;
        const { data: rows, error } = await (supabase as any)
          .from("job_source_settings")
          .select("sources")
          .eq("id", uid)
          .maybeSingle();
        if (!error && rows && Array.isArray((rows as any).sources)) {
          setJobSources((rows as any).sources);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [supabase]);

  // const displayedSources = useMemo(() => {
  //   if (!groupEnabledFirst) return jobSources;
  //   const arr = [...jobSources];
  //   arr.sort((a, b) => Number(b.enabled) - Number(a.enabled));
  //   return arr;
  // }, [jobSources, groupEnabledFirst]); // Unused

  // const moveItem = (list: any[], fromId: number, toId: number) => {
  //   if (fromId === toId) return list;
  //   const srcIdx = list.findIndex((s) => s.id === fromId);
  //   const dstIdx = list.findIndex((s) => s.id === toId);
  //   if (srcIdx < 0 || dstIdx < 0) return list;
  //   const copy = [...list];
  //   const [item] = copy.splice(srcIdx, 1);
  //   copy.splice(dstIdx, 0, item);
  //   return copy;
  // }; // Unused
  useEffect(() => {
    let active = true;
    const load = async () => {
      const path = formData.avatar_url;
      if (!path) {
        setAvatarUrl(null);
        return;
      }
      try {
        const { data, error } = await (supabase as any).storage
          .from("avatars")
          .createSignedUrl(path, 60 * 10);
        if (error) throw error;
        if (active) setAvatarUrl(data?.signedUrl || null);
      } catch {
        if (active) setAvatarUrl(null);
      }
    };
    load();
    const id = setInterval(load, 1000 * 60 * 8); // refresh before expiry
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [supabase, formData.avatar_url]);

  // Hydrate from realtime-backed hooks
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const authEmail = (data as any)?.user?.email ?? "";
      if (pendingEmailUpdateRef.current === authEmail) {
        pendingEmailUpdateRef.current = null;
      }
      const email =
        pendingEmailUpdateRef.current &&
        pendingEmailUpdateRef.current !== authEmail
          ? pendingEmailUpdateRef.current
          : authEmail;
      setFormData((prev: FormData) => ({
        ...prev,
        email,
        firstName: profile?.first_name || "",
        lastName: profile?.last_name || "",
        phone: (profile as any)?.phone || "",
        location: profile?.location || "",
        avatar_url: (profile as any)?.avatar_url || "",
        linkedin_url: (profile as any)?.linkedin_url || "",
        github_url: (profile as any)?.github_url || "",
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
          .from("user_credits")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle();

        if (creditsData) {
          setCurrentCredits(creditsData.balance);
        }

        // Fetch subscription
        const { data: subscription } = await supabase
          .from("user_subscriptions")
          .select(
            "subscription_plans(name, credits_per_month), current_period_end",
          )
          .eq("user_id", userId)
          .eq("status", "active")
          .gt("current_period_end", new Date().toISOString())
          .maybeSingle();

        if (subscription) {
          const planName = (subscription as any)?.subscription_plans?.name;
          setBillingSubscriptionTier(planName || "Free");
          setCurrentPeriodEnd((subscription as any).current_period_end);
        } else {
          setBillingSubscriptionTier("Free");
          setCurrentPeriodEnd(null);
        }

        // Fetch all subscription plans
        const { data: plansData } = await supabase
          .from("subscription_plans")
          .select("*")
          .eq("is_active", true)
          .order("price", { ascending: true });

        if (plansData) {
          setSubscriptionPlans(plansData);
        }
      } catch (error) {
        console.error("Error fetching billing data:", error);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    // ensure settings exist lazily on first toggle
    void refreshSec();
  }, [refreshSec]);

  // Load job source domain settings when job-sources tab is active
  useEffect(() => {
    if (activeTab !== "job-sources") return;

    (async () => {
      setLoadingDomains(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = (auth as any)?.user?.id;
        if (!uid) {
          setLoadingDomains(false);
          return;
        }
        const { data } = await (supabase as any)
          .from("job_source_settings")
          .select(
            "enabled_default_sources, allowed_domains, source_credentials",
          )
          .eq("id", uid)
          .maybeSingle();

        if (data) {
          if (data.source_credentials) {
            setSourceCredentials(data.source_credentials);
          }
          // Load enabled default sources from dedicated column
          if (Array.isArray(data.enabled_default_sources)) {
            const enabledDefaults = new Set<string>(
              data.enabled_default_sources.map((d: string) =>
                d.toLowerCase().trim(),
              ),
            );
            setEnabledDefaultDomains(enabledDefaults);
          } else {
            // Fallback: if column doesn't exist yet, use default values
            setEnabledDefaultDomains(
              new Set([
                "remote.co",
                "remotive.com",
                "remoteok.com",
                "jobicy.com",
                "levels.fyi",
                "greenhouse.io",
                "lever.co",
                "wellfound.com",
                "builtin.com",
                "workingnomads.com",
                "weworkremotely.com",
                "flexjobs.com",
                "cryptojobslist.com",
                "otta.com",
                "hired.com",
                "dice.com",
                "ycombinator.com",
                "startup.jobs",
                "nodesk.co",
                "remoterocketship.com",
                "jobspresso.com",
                "talent.hubstaff.com",
                "flexa.careers",
                "jobs.micro1.ai",
              ]),
            );
          }
        }
      } catch (e: any) {
        toastError(
          "Failed to load job source settings",
          e?.message || "Using default domain settings.",
        );
      }
      setLoadingDomains(false);
    })();
  }, [activeTab, supabase]);

  useRegisterCoachMarks({
    page: "settings",
    marks: [
      {
        id: "settings-tab-profile",
        selector: "#settings-tab-btn-profile",
        title: "Profile Settings",
        body: "Manage your personal information, contact details, and avatar here.",
        condition: { type: "click", autoNext: true },
        next: "settings-tab-notifications",
      },
      {
        id: "settings-tab-notifications",
        selector: "#settings-tab-btn-notifications",
        title: "Notifications",
        body: "Control which updates you receive via email, push, or desktop notifications. Configure granular preferences for each notification type.",
        condition: { type: "click", autoNext: true },
        next: "settings-tab-security",
      },
      {
        id: "settings-tab-security",
        selector: "#settings-tab-btn-security",
        title: "Security",
        body: "Update password, manage two-factor authentication, view active sessions, manage API keys, and configure enterprise-level security settings.",
        condition: { type: "click", autoNext: true },
        next: "settings-tab-appearance",
      },
      {
        id: "settings-tab-appearance",
        selector: "#settings-tab-btn-appearance",
        title: "Appearance",
        body: "Customize UI theme, color scheme, and visual preferences to match your style.",
        condition: { type: "click", autoNext: true },
        next: "settings-tab-privacy",
      },
      {
        id: "settings-tab-privacy",
        selector: "#settings-tab-btn-privacy",
        title: "Privacy",
        body: "Adjust visibility settings, data sharing preferences, and manage your privacy with realtime data controls and enterprise-level modifications.",
        condition: { type: "click", autoNext: true },
        next: "settings-tab-job-sources",
      },
      {
        id: "settings-tab-job-sources",
        selector: "#settings-tab-btn-job-sources",
        title: "Job Sources",
        body: "Configure and manage job ingestion sources. View stats, enable/disable sources, set search queries, and prioritize sources for automated job discovery.",
        condition: { type: "click", autoNext: true },
        next: "settings-tab-integrations",
      },
      {
        id: "settings-tab-integrations",
        selector: "#settings-tab-btn-integrations",
        title: "Integrations",
        body: "Connect your accounts from other services like Gmail, LinkedIn, and GitHub to enhance your job search workflow.",
        condition: { type: "click", autoNext: true },
        next: isAdmin ? "settings-tab-guided-tours" : "settings-tab-billing",
      },
      {
        id: "settings-tab-guided-tours",
        selector: "#settings-tab-btn-guided-tours",
        title: "Guided Tours",
        body: "Restart any product tour from Settings whenever you want a quick walkthrough of a page.",
        condition: { type: "click", autoNext: true },
        next: "settings-tab-billing",
      },
      {
        id: "settings-tab-billing",
        selector: "#settings-tab-btn-billing",
        title: "Billing",
        body: "Manage subscription plans, view credit balance, purchase credits, and review transaction history.",
        condition: { type: "click", autoNext: true },
        next: "settings-tour-complete",
      },
      {
        id: "settings-tour-complete",
        selector: "#settings-tablist",
        title: "All Set",
        body: "That's the settings navigation. You can restart this tour anytime from the tour menu.",
      },
    ],
  });

  const activeLoading =
    (activeTab === "profile" && profileLoading) ||
    (activeTab === "notifications" && notifLoading) ||
    (activeTab === "privacy" && privacyLoading) ||
    (activeTab === "appearance" && appearanceLoading) ||
    (activeTab === "security" && securityLoading);

  const guidedTourPages = useMemo(
    () => availablePages.filter((tourPageId) => tourPageId !== "*"),
    [availablePages],
  );

  const TabSkeleton = () => (
    <div className='space-y-6'>
      {Array.from({ length: 3 }).map((_: unknown, i: number) => (
        <div
          key={i}
          className='bg-gradient-to-br from-foreground/5 via-foreground/[0.02] to-transparent border border-foreground/10 p-6 rounded-xl'
        >
          <div className='space-y-4'>
            <Skeleton className='h-5 w-48 bg-foreground/[0.05]' />
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              {Array.from({ length: 4 }).map((__: unknown, j: number) => (
                <div key={j} className='space-y-2'>
                  <Skeleton className='h-3 w-24 bg-foreground/[0.05]' />
                  <Skeleton className='h-10 w-full bg-foreground/[0.05]' />
                </div>
              ))}
            </div>
            <div className='flex gap-3 pt-2'>
              <Skeleton className='h-9 w-24 bg-foreground/[0.05]' />
              <Skeleton className='h-9 w-20 bg-foreground/[0.05]' />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const handleInputChange = (field: string, value: string) => {
    if (field === "email" && pendingEmailUpdateRef.current) {
      pendingEmailUpdateRef.current = null;
    }
    setFormData((prev: FormData) => ({ ...prev, [field]: value }));
  };

  // ... existing rendering logic below will conditionally use activeLoading & TabSkeleton

  const handleNotificationChange = async (
    setting: string,
    value: boolean | string,
  ) => {
    try {
      // Handle push notification permission request
      if (setting === "push_notifications" && value === true) {
        if (typeof window === "undefined" || !("Notification" in window)) {
          toastError(
            "Push not supported",
            "This browser does not support notifications",
          );
          return;
        }
        if (Notification.permission === "denied") {
          toastError(
            "Notifications blocked",
            "Allow notifications in your browser settings",
          );
          return;
        }
        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            toastError(
              "Permission required",
              "Enable notifications to turn this on",
            );
            return;
          }
        }
      }

      // Handle desktop notifications permission
      if (setting === "desktop_notifications" && value === true) {
        if (typeof window === "undefined" || !("Notification" in window)) {
          toastError(
            "Desktop notifications not supported",
            "This browser does not support desktop notifications",
          );
          return;
        }
        if (Notification.permission === "denied") {
          toastError(
            "Notifications blocked",
            "Allow notifications in your browser settings",
          );
          return;
        }
        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            toastError(
              "Permission required",
              "Enable notifications to turn this on",
            );
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
      toastError("Update failed", e.message);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const nextEmail = formData.email.trim();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const currentEmail = user?.email?.trim() || "";

      if (!profile) {
        await createProfile({
          first_name: formData.firstName,
          last_name: formData.lastName,
          location: formData.location,
          phone: formData.phone as any,
          avatar_url: formData.avatar_url as any,
          linkedin_url: formData.linkedin_url.trim() || null,
          github_url: formData.github_url.trim() || null,
        } as any);
      } else {
        await updateProfile({
          first_name: formData.firstName,
          last_name: formData.lastName,
          location: formData.location,
          phone: formData.phone as any,
          avatar_url: formData.avatar_url as any,
          linkedin_url: formData.linkedin_url.trim() || null,
          github_url: formData.github_url.trim() || null,
        } as any);
      }

      if (nextEmail && nextEmail !== currentEmail) {
        pendingEmailUpdateRef.current = nextEmail;
        const { error } = await supabase.auth.updateUser({ email: nextEmail });
        if (error) {
          pendingEmailUpdateRef.current = null;
          throw error;
        }
        success(
          "Email update requested",
          "Check your inbox to confirm the new email address.",
        );
      }
    } catch (e: any) {
      toastError("Profile save failed", e.message || "Unable to save profile.");
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
      if (!uid) return toastError("Not signed in", "Please sign in again");

      // Build promises (no .catch chaining on builders to avoid non-thenable issues)
      const profP = (supabase as any)
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      const notifP = (supabase as any)
        .from("notification_settings")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      const resumesP = (supabase as any)
        .from("resumes")
        .select("*")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false });
      const privacyP = (supabase as any)
        .from("privacy_settings")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      const appsP = (supabase as any)
        .from("applications")
        .select("*")
        .eq("user_id", uid)
        .order("applied_date", { ascending: false });
      const jobsP = (supabase as any)
        .from("jobs")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      const bookmarksP = (supabase as any)
        .from("bookmarks")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      const creditTxP = (supabase as any)
        .from("credit_transactions")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      const creditsP = (supabase as any)
        .from("user_credits")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      const subsP = (supabase as any)
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      const notifsP = (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      const eduP = (supabase as any)
        .from("profile_education")
        .select("*")
        .eq("user_id", uid)
        .order("start_date", { ascending: false });
      const expP = (supabase as any)
        .from("profile_experiences")
        .select("*")
        .eq("user_id", uid)
        .order("start_date", { ascending: false });
      const skillsP = (supabase as any)
        .from("profile_skills")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      const appearanceP = (supabase as any)
        .from("appearance_settings")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      const securityP = (supabase as any)
        .from("security_settings")
        .select("*")
        .eq("id", uid)
        .maybeSingle();

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
        profP,
        notifP,
        resumesP,
        privacyP,
        appsP,
        jobsP,
        bookmarksP,
        creditTxP,
        creditsP,
        subsP,
        notifsP,
        eduP,
        expP,
        skillsP,
        appearanceP,
        securityP,
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
        export_version: "2.0",
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
          active_subscriptions:
            userSubscriptions?.filter(
              (s: any) =>
                s.status === "active" &&
                (!s.current_period_end ||
                  new Date(s.current_period_end).getTime() > Date.now()),
            ).length || 0,
          total_notifications: notifications?.length || 0,
          unread_notifications:
            notifications?.filter((n: any) => !n.read).length || 0,
          education_records: education?.length || 0,
          experience_records: experience?.length || 0,
          skills_count: skills?.length || 0,
        },
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jobraker-export-${uid}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success("Export started");
    } catch (e: any) {
      toastError("Export failed", e.message);
    }
  };

  const handleUploadAvatar = async () => {
    // Open file picker
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const { data: user } = await supabase.auth.getUser();
        const uid = (user as any)?.user?.id;
        if (!uid) return;
        const ext = file.name.split(".").pop() || "png";
        const path = `${uid}/avatar_${Date.now()}.${ext}`;
        const { error: upErr } = await (supabase as any).storage
          .from("avatars")
          .upload(path, file, {
            upsert: false,
            contentType: file.type || undefined,
          });
        if (upErr) throw upErr;
        // Store storage path; we'll resolve via signed URL when rendering
        setFormData((p: FormData) => ({ ...p, avatar_url: path }));
        await updateProfile({ avatar_url: path } as any);
        success("Avatar updated");
      } catch (e: any) {
        toastError("Avatar upload failed", e.message);
      }
    };
    input.click();
  };

  const handleRemoveAvatar = async () => {
    setFormData((p: FormData) => ({ ...p, avatar_url: "" }));
    await updateProfile({ avatar_url: null } as any);
  };

  const handleChangePassword = async () => {
    if (
      !formData.newPassword ||
      formData.newPassword !== formData.confirmPassword
    ) {
      toastError("Password mismatch", "Please confirm your new password");
      return;
    }
    if (!passwordCheck.valid) {
      toastError(
        "Weak password",
        "Please choose a stronger password that meets the requirements.",
      );
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toastError("Authentication error", "Please sign in again");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: formData.newPassword,
    });
    if (error) return toastError("Failed to update password", error.message);

    // Log security event
    try {
      const { logSecurityEvent } =
        await import("../../../utils/sessionManagement");
      await logSecurityEvent(
        user.id,
        "password_change",
        "User changed their password",
        "medium",
      );

      // Send notification if enabled
      const { data: secSettings } = await supabase
        .from("security_settings")
        .select("password_change_alerts")
        .eq("id", user.id)
        .maybeSingle();

      if (secSettings?.password_change_alerts !== false) {
        const { createNotification } =
          await import("../../../utils/notifications");
        createNotification({
          user_id: user.id,
          type: "system",
          title: "Password changed",
          message:
            "Your password was successfully changed. If you did not make this change, please secure your account immediately.",
        });
      }
    } catch (e) {
      console.warn("Failed to log password change event:", e);
    }

    success("Password updated");
    setFormData((p: FormData) => ({
      ...p,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    }));
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "Basics":
        return <Sparkles className='w-5 h-5' />;
      case "Pro":
        return <Zap className='w-5 h-5' />;
      case "Ultimate":
        return <Crown className='w-5 h-5' />;
      default:
        return <Sparkles className='w-5 h-5' />;
    }
  };

  const getTierGradient = (tier: string) => {
    switch (tier) {
      case "Basics":
        return "from-[#] via-[#5fff4a] to-[#b8ffb0]";
      case "Pro":
        return "from-blue-500 via-blue-600 to-blue-700";
      case "Ultimate":
        return "from-purple-500 via-purple-600 to-purple-700";
      default:
        return "from-[#] via-background to-background";
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div
            id='settings-tab-profile'
            data-tour='settings-tab-profile'
            className='space-y-6 bg-background'
          >
            {/* Avatar Section */}
            <div className='bg-card border border-border/40 rounded-xl p-4 sm:p-6 shadow-sm ring-1 ring-foreground/5'>
              <h3 className='text-base font-medium text-foreground mb-6'>
                Profile Picture
              </h3>
              <div className='flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6'>
                <div className='w-20 h-20 rounded-2xl overflow-hidden bg-muted/50 border border-border/40 flex items-center justify-center text-foreground font-semibold text-xl shadow-inner'>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt='Avatar'
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3'>
                  <Button
                    variant='outline'
                    onClick={handleUploadAvatar}
                    className='w-full border-border/40 text-muted-foreground hover:text-[#] hover:bg-[#]/10 hover:border-[#]/30 transition-all shadow-sm sm:w-auto'
                  >
                    <Upload className='w-4 h-4 mr-2' />
                    Upload
                  </Button>
                  {avatarUrl && (
                    <Button
                      variant='outline'
                      onClick={handleRemoveAvatar}
                      className='w-full border-border/40 text-[#] hover:text-[#] hover:bg-[#]/10 hover:border-[#]/30 transition-all shadow-sm sm:w-auto'
                    >
                      <Trash2 className='w-4 h-4 mr-2' />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className='bg-card border border-border/40 rounded-xl p-4 sm:p-6 shadow-sm ring-1 ring-foreground/5'>
              <h3 className='text-base font-medium text-foreground mb-6'>
                Personal Information
              </h3>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-xs font-bold text-muted-foreground/80 mb-2 uppercase tracking-wider'>
                    First Name
                  </label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) =>
                      handleInputChange("firstName", e.target.value)
                    }
                    autoComplete='given-name'
                    className='bg-muted/50 border-border/40 text-foreground placeholder:text-muted-foreground/50 focus:border-[#]/50 focus:ring-1 focus:ring-[#]/30 transition-all shadow-inner'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-muted-foreground/80 mb-2 uppercase tracking-wider'>
                    Last Name
                  </label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) =>
                      handleInputChange("lastName", e.target.value)
                    }
                    autoComplete='family-name'
                    className='bg-muted/50 border-border/40 text-foreground placeholder:text-muted-foreground/50 focus:border-[#]/50 focus:ring-1 focus:ring-[#]/30 transition-all shadow-inner'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-muted-foreground/80 mb-2 uppercase tracking-wider'>
                    Email
                  </label>
                  <Input
                    type='email'
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    autoComplete='email'
                    className='bg-muted/50 border-border/40 text-foreground placeholder:text-muted-foreground/50 focus:border-[#]/50 focus:ring-1 focus:ring-[#]/30 transition-all shadow-inner'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-muted-foreground/80 mb-2 uppercase tracking-wider'>
                    Phone
                  </label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    autoComplete='tel'
                    inputMode='tel'
                    className='bg-muted/50 border-border/40 text-foreground placeholder:text-muted-foreground/50 focus:border-[#]/50 focus:ring-1 focus:ring-[#]/30 transition-all shadow-inner'
                  />
                </div>
                <div className='md:col-span-2'>
                  <label className='block text-xs font-bold text-muted-foreground/80 mb-2 uppercase tracking-wider'>
                    Location
                  </label>
                  <Input
                    value={formData.location}
                    onChange={(e) =>
                      handleInputChange("location", e.target.value)
                    }
                    autoComplete='address-level2'
                    className='bg-muted/50 border-border/40 text-foreground placeholder:text-muted-foreground/50 focus:border-[#]/50 focus:ring-1 focus:ring-[#]/30 transition-all shadow-inner'
                    placeholder='City, Country'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-muted-foreground/80 mb-2 uppercase tracking-wider'>
                    LinkedIn URL
                  </label>
                  <Input
                    value={formData.linkedin_url}
                    onChange={(e) =>
                      handleInputChange("linkedin_url", e.target.value)
                    }
                    className='bg-muted/50 border-border/40 text-foreground placeholder:text-muted-foreground/50 focus:border-[#]/50 focus:ring-1 focus:ring-[#]/30 transition-all shadow-inner'
                    placeholder='https://linkedin.com/in/username'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-muted-foreground/80 mb-2 uppercase tracking-wider'>
                    GitHub URL
                  </label>
                  <Input
                    value={formData.github_url}
                    onChange={(e) =>
                      handleInputChange("github_url", e.target.value)
                    }
                    className='bg-muted/50 border-border/40 text-foreground placeholder:text-muted-foreground/50 focus:border-[#]/50 focus:ring-1 focus:ring-[#]/30 transition-all shadow-inner'
                    placeholder='https://github.com/username'
                  />
                </div>
              </div>

              <div className='flex flex-col gap-3 pt-6 mt-6 border-t border-border/30 sm:flex-row sm:items-center'>
                <Button
                  onClick={handleSaveProfile}
                  className='w-full bg-[#] hover:bg-[#e6c200] text-black font-semibold tracking-wide shadow-lg shadow-[#]/20 transition-all border border-[#]/50 sm:w-auto'
                >
                  <Save className='w-4 h-4 mr-2' />
                  Save Changes
                </Button>
                <Button
                  variant='outline'
                  onClick={handleResetForm}
                  className='w-full border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all sm:w-auto'
                >
                  <RefreshCw className='w-4 h-4 mr-2' />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        );

      case "notifications":
        return (
          <div
            id='settings-tab-notifications'
            data-tour='settings-tab-notifications'
            className='space-y-6'
          >
            {/* General Notification Settings */}
            {/* General Notification Settings */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <h3 className='text-base font-medium text-foreground mb-6'>
                General Settings
              </h3>
              <div className='space-y-3'>
                {[
                  {
                    key: "desktop_notifications",
                    label: "Desktop Notifications",
                    description: "Show desktop/browser notifications",
                  },
                ].map((setting) => (
                  <div
                    key={setting.key}
                    className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-[#]/30 hover:bg-muted/50 transition-all'
                  >
                    <div className='flex-1'>
                      <h4 className='text-sm font-medium text-foreground'>
                        {setting.label}
                      </h4>
                      <p className='text-xs text-muted-foreground mt-0.5'>
                        {setting.description}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleNotificationChange(
                          setting.key,
                          !(notif as any)?.[setting.key],
                        )
                      }
                      disabled={notifLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        (notif as any)?.[setting.key] ? "bg-brand" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          (notif as any)?.[setting.key]
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Type-Specific In-App Notifications */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <h3 className='text-base font-medium text-foreground mb-4'>
                In-App Notifications
              </h3>
              <p className='text-xs text-muted-foreground mb-6'>
                Control which notification types appear in your dashboard
              </p>
              <div className='space-y-3'>
                {[
                  {
                    key: "notify_interviews",
                    label: "Interview Notifications",
                    description: "Updates about interviews and scheduling",
                  },
                  {
                    key: "notify_applications",
                    label: "Application Updates",
                    description:
                      "Status changes and updates on your applications",
                  },
                  {
                    key: "notify_company_updates",
                    label: "Company Updates",
                    description: "News and updates from companies",
                  },
                  {
                    key: "notify_system",
                    label: "System Messages",
                    description: "Important system notifications and alerts",
                  },
                ].map((setting) => (
                  <div
                    key={setting.key}
                    className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-[#]/30 hover:bg-muted/50 transition-all'
                  >
                    <div className='flex-1'>
                      <h4 className='text-sm font-medium text-foreground'>
                        {setting.label}
                      </h4>
                      <p className='text-xs text-muted-foreground mt-0.5'>
                        {setting.description}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleNotificationChange(
                          setting.key,
                          !((notif as any)?.[setting.key] ?? true),
                        )
                      }
                      disabled={notifLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        ((notif as any)?.[setting.key] ?? true)
                          ? "bg-brand"
                          : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          ((notif as any)?.[setting.key] ?? true)
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6'>
                <div>
                  <h3 className='text-base font-medium text-foreground mb-2'>
                    Gmail-Connected Notifications
                  </h3>
                  <p className='text-xs text-muted-foreground'>
                    Bring inbox-derived application updates directly into your notification center.
                  </p>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  <span
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                      isGmailConnected
                        ? "border-[#1dff00]/30 bg-[#1dff00]/10 text-[#1dff00]"
                        : "border-border/40 bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Mail className='w-4 h-4 shrink-0' />
                    {isGmailConnected ? "Connected" : "Not connected"}
                  </span>
                  {!isGmailConnected ? (
                    <Button
                      type='button'
                      variant='outline'
                      className='border-border/40 text-muted-foreground hover:text-foreground hover:bg-[#1dff00]/10 hover:border-[#1dff00]/30 transition-all'
                      onClick={handleConnectGmail}
                      disabled={loadingTier || !hasGmailIntegrationAccess}
                    >
                      <Link className='w-4 h-4 mr-2' />
                      Connect Gmail
                    </Button>
                  ) : (
                    <Button
                      type='button'
                      variant='outline'
                      className='border-border/40 text-muted-foreground hover:text-foreground hover:bg-[#1dff00]/10 hover:border-[#1dff00]/30 transition-all'
                      onClick={() => navigate("/dashboard/notifications")}
                    >
                      <Bell className='w-4 h-4 mr-2' />
                      Open Inbox
                    </Button>
                  )}
                </div>
              </div>

              <div className='rounded-xl border border-border/40 bg-muted/30 px-4 py-3 mb-4'>
                <p className='text-sm text-foreground/90'>
                  {isGmailConnected
                    ? `Connected as ${gmailConnectedEmail || "your Gmail account"}.`
                    : hasGmailIntegrationAccess
                      ? "Connect Gmail to surface interview invites, confirmations, offers, and rejections here."
                      : "Upgrade to Pro to connect Gmail and add mailbox events to your notification flow."}
                </p>
              </div>

              <div className='space-y-3'>
                {[
                  {
                    key: "notify_gmail_updates",
                    label: "Show Gmail Updates",
                    description: "Turn inbox-derived application updates into in-app notifications",
                    fallback: true,
                  },
                  {
                    key: "gmail_auto_sync_enabled",
                    label: "Auto-Sync Gmail In Inbox",
                    description: "Refresh Gmail-derived notifications automatically when you open Notifications",
                    fallback: true,
                  },
                ].map((setting) => (
                  <div
                    key={setting.key}
                    className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-[#1dff00]/30 hover:bg-muted/50 transition-all'
                  >
                    <div className='flex-1 pr-4'>
                      <h4 className='text-sm font-medium text-foreground'>
                        {setting.label}
                      </h4>
                      <p className='text-xs text-muted-foreground mt-0.5'>
                        {setting.description}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleNotificationChange(
                          setting.key,
                          !((notif as any)?.[setting.key] ?? setting.fallback),
                        )
                      }
                      disabled={notifLoading || !hasGmailIntegrationAccess}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        ((notif as any)?.[setting.key] ?? setting.fallback)
                          ? "bg-[#1dff00]"
                          : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          ((notif as any)?.[setting.key] ?? setting.fallback)
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quiet Hours */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <h3 className='text-base font-medium text-foreground mb-4'>
                Quiet Hours
              </h3>
              <p className='text-xs text-muted-foreground mb-6'>
                Suppress notifications during specified hours
              </p>
              <div className='space-y-4'>
                <div className='flex items-center justify-between p-4 bg-muted/50 border border-border/40 rounded-lg'>
                  <div className='flex-1'>
                    <h4 className='text-sm font-medium text-foreground/90'>
                      Enable Quiet Hours
                    </h4>
                    <p className='text-xs text-foreground/50 mt-0.5'>
                      Pause notifications during your selected time
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      handleNotificationChange(
                        "quiet_hours_enabled",
                        !((notif as any)?.quiet_hours_enabled ?? false),
                      )
                    }
                    disabled={notifLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      ((notif as any)?.quiet_hours_enabled ?? false)
                        ? "bg-brand"
                        : "bg-foreground/[0.1]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                        ((notif as any)?.quiet_hours_enabled ?? false)
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {((notif as any)?.quiet_hours_enabled ?? false) && (
                  <div className='grid grid-cols-2 gap-4 p-4 bg-muted/50 border border-border/40 rounded-lg'>
                    <div>
                      <label className='block text-xs font-bold text-muted-foreground/80 uppercase tracking-wider mb-2'>
                        Start Time
                      </label>
                      <Input
                        type='time'
                        value={(notif as any)?.quiet_hours_start || "22:00"}
                        onChange={(e) =>
                          handleNotificationChange(
                            "quiet_hours_start",
                            e.target.value,
                          )
                        }
                        disabled={notifLoading}
                        className='bg-muted/50 border-border/40 text-foreground focus:border-[#]/50 focus:ring-1 focus:ring-[#]/30 shadow-inner'
                      />
                    </div>
                    <div>
                      <label className='block text-xs font-bold text-muted-foreground/80 uppercase tracking-wider mb-2'>
                        End Time
                      </label>
                      <Input
                        type='time'
                        value={(notif as any)?.quiet_hours_end || "08:00"}
                        onChange={(e) =>
                          handleNotificationChange(
                            "quiet_hours_end",
                            e.target.value,
                          )
                        }
                        disabled={notifLoading}
                        className='bg-muted/50 border-border/40 text-foreground focus:border-[#]/50 focus:ring-1 focus:ring-[#]/30 shadow-inner'
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
          <div
            id='settings-tab-security'
            data-tour='settings-tab-security'
            className='space-y-6'
          >
            {/* Change Password */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <h3 className='text-base font-medium text-foreground mb-6'>
                Change Password
              </h3>
              <div className='space-y-4'>
                <div>
                  <label className='block text-xs font-bold text-muted-foreground/80 mb-2 uppercase tracking-wider'>
                    Current Password
                  </label>
                  <div className='relative'>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.currentPassword}
                      onChange={(e) =>
                        handleInputChange("currentPassword", e.target.value)
                      }
                      className='bg-muted/50 border-border/40 text-foreground placeholder:text-muted-foreground/50 focus:border-[#]/50 focus:ring-1 focus:ring-[#]/30 pr-10 transition-all shadow-inner'
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => setShowPassword(!showPassword)}
                      className='absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-[#] hover:bg-transparent transition-all'
                    >
                      {showPassword ? (
                        <EyeOff className='w-4 h-4' />
                      ) : (
                        <Eye className='w-4 h-4' />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className='block text-xs font-bold text-muted-foreground/80 mb-2 uppercase tracking-wider'>
                    New Password
                  </label>
                  <Input
                    type='password'
                    value={formData.newPassword}
                    onChange={(e) =>
                      handleInputChange("newPassword", e.target.value)
                    }
                    aria-invalid={
                      !!formData.newPassword && !passwordCheck.valid
                    }
                    className='bg-muted/50 border-border/40 text-foreground placeholder:text-muted-foreground/50 focus:border-[#]/50 focus:ring-1 focus:ring-[#]/30 transition-all shadow-inner'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-muted-foreground/80 mb-2 uppercase tracking-wider'>
                    Confirm New Password
                  </label>
                  <Input
                    type='password'
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      handleInputChange("confirmPassword", e.target.value)
                    }
                    className='bg-muted/50 border-border/40 text-foreground placeholder:text-muted-foreground/50 focus:border-[#]/50 focus:ring-1 focus:ring-[#]/30 transition-all shadow-inner'
                  />
                </div>
                {/* Password rules & strength */}
                <div className='space-y-2 text-xs sm:text-sm pt-4 border-t border-border/30 mt-6'>
                  <div className='flex items-center justify-between'>
                    <span className='font-bold uppercase tracking-wider text-muted-foreground/80'>
                      Strength
                    </span>
                    <span
                      className={`font-bold ${passwordCheck.score >= 4 ? "text-brand" : passwordCheck.score >= 3 ? "text-brand" : "text-rose-400"}`}
                    >
                      {passwordCheck.strength}
                    </span>
                  </div>
                  <div className='grid grid-cols-2 gap-2 mt-2'>
                    {[
                      { ok: passwordCheck.lengthOk, label: "8+ characters" },
                      {
                        ok: passwordCheck.hasUpper,
                        label: "Uppercase letter",
                      },
                      {
                        ok: passwordCheck.hasLower,
                        label: "Lowercase letter",
                      },
                      { ok: passwordCheck.hasNumber, label: "Number" },
                      { ok: passwordCheck.hasSymbol, label: "Symbol" },
                      { ok: passwordCheck.noSpaces, label: "No spaces" },
                    ].map((r, i) => (
                      <div key={i} className='flex items-center gap-2'>
                        {r.ok ? (
                          <CheckCircle2 className='w-4 h-4 text-[#]' />
                        ) : (
                          <XCircle className='w-4 h-4 text-muted-foreground/40' />
                        )}
                        <span
                          className={
                            r.ok
                              ? "text-foreground font-medium"
                              : "text-muted-foreground/60"
                          }
                        >
                          {r.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className='pt-6 mt-6'>
                  <Button
                    id='settings-security-update-password'
                    onClick={handleChangePassword}
                    disabled={
                      !passwordCheck.valid ||
                      formData.newPassword !== formData.confirmPassword
                    }
                    className='bg-[#] hover:bg-[#e6c200] text-black font-semibold tracking-wide shadow-lg shadow-[#]/20 transition-all border border-[#]/50 disabled:opacity-50 disabled:shadow-none'
                  >
                    Update Password
                  </Button>
                </div>
              </div>
            </div>

            {/* Two-Factor Authentication */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center justify-between mb-4'>
                <div>
                  <h3 className='text-base font-medium text-foreground/95'>
                    Two-Factor Authentication
                  </h3>
                  <p className='text-xs text-muted-foreground mt-1'>
                    Add an extra layer of security to your account
                  </p>
                </div>
                <div className='flex items-center gap-3'>
                  <span
                    className={`text-sm px-3 py-1 rounded ${sec?.two_factor_enabled ? "bg-[#]/20 text-brand" : "bg-muted/50 text-muted-foreground"}`}
                  >
                    {sec?.two_factor_enabled ? "Enabled" : "Disabled"}
                  </span>
                  <Button
                    variant={sec?.two_factor_enabled ? "outline" : "default"}
                    onClick={async () => {
                      try {
                        if (sec?.two_factor_enabled) {
                          if (
                            !confirm(
                              "Disable two-factor authentication? This will reduce your account security.",
                            )
                          )
                            return;
                          await disableTotp();
                          return;
                        }
                        if (!sec) await createSecurity({});
                        const { factorId, uri } = await enrollTotp();
                        setTotpFactorId(factorId);
                        if (uri) {
                          try {
                            const QR = await getQRCode();
                            setQrDataUrl(await QR.toDataURL(uri));
                          } catch {
                            setQrDataUrl(undefined);
                          }
                        }
                        setTotpCode("");
                        setOpen2FA(true);
                      } catch (e: any) {
                        toastError("2FA setup failed", e.message);
                      }
                    }}
                    className={
                      sec?.two_factor_enabled
                        ? "border-border/40 text-muted-foreground hover:bg-muted/50"
                        : "bg-[#] text-black hover:bg-[#e6c200] shadow-lg shadow-[#]/20"
                    }
                  >
                    {sec?.two_factor_enabled ? "Disable 2FA" : "Enable 2FA"}
                  </Button>
                </div>
              </div>
              {sec?.two_factor_enabled && (
                <div className='space-y-3 pt-4 border-t border-border/40 mt-4'>
                  <div className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-[#]/30 hover:bg-muted/50 transition-all'>
                    <div className='flex-1'>
                      <p className='text-sm font-medium text-foreground/90'>
                        Require 2FA for Login
                      </p>
                      <p className='text-xs text-muted-foreground mt-0.5'>
                        Force 2FA verification on all login attempts
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (!sec)
                          createSecurity({
                            require_2fa_for_login: !(
                              sec?.require_2fa_for_login ?? false
                            ),
                          });
                        else
                          updateSecurity({
                            require_2fa_for_login: !(
                              sec.require_2fa_for_login ?? false
                            ),
                          });
                      }}
                      disabled={securityLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        (sec?.require_2fa_for_login ?? false)
                          ? "bg-brand"
                          : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          (sec?.require_2fa_for_login ?? false)
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  <div className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-[#]/30 hover:bg-muted/50 transition-all'>
                    <div className='flex-1'>
                      <p className='text-sm font-medium text-foreground/90'>
                        Require Backup Codes
                      </p>
                      <p className='text-xs text-muted-foreground mt-0.5'>
                        Require backup codes to be generated before enabling 2FA
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (!sec)
                          createSecurity({
                            backup_codes_required: !(
                              sec?.backup_codes_required ?? true
                            ),
                          });
                        else
                          updateSecurity({
                            backup_codes_required: !(
                              sec.backup_codes_required ?? true
                            ),
                          });
                      }}
                      disabled={securityLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        (sec?.backup_codes_required ?? true)
                          ? "bg-brand"
                          : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          (sec?.backup_codes_required ?? true)
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sign-in Alerts */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <h3 className='text-base font-medium text-foreground mb-4'>
                Security Alerts
              </h3>
              <div className='space-y-3'>
                <div className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-[#]/30 hover:bg-muted/50 transition-all'>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-foreground/90'>
                      Login Alerts
                    </p>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      Notify me when a new device signs in
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!sec)
                        createSecurity({
                          login_alerts_enabled: !(
                            sec?.login_alerts_enabled ?? true
                          ),
                        });
                      else
                        updateSecurity({
                          login_alerts_enabled: !(
                            sec.login_alerts_enabled ?? true
                          ),
                        });
                    }}
                    disabled={securityLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                      (sec?.login_alerts_enabled ?? true)
                        ? "bg-brand"
                        : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                        (sec?.login_alerts_enabled ?? true)
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <div className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-[#]/30 hover:bg-muted/50 transition-all'>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-foreground/90'>
                      Suspicious Login Alerts
                    </p>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      Alert on unusual login patterns or locations
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!sec)
                        createSecurity({
                          suspicious_login_alerts: !(
                            sec?.suspicious_login_alerts ?? true
                          ),
                        });
                      else
                        updateSecurity({
                          suspicious_login_alerts: !(
                            sec.suspicious_login_alerts ?? true
                          ),
                        });
                    }}
                    disabled={securityLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                      (sec?.suspicious_login_alerts ?? true)
                        ? "bg-brand"
                        : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                        (sec?.suspicious_login_alerts ?? true)
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <div className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-[#]/30 hover:bg-muted/50 transition-all'>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-foreground/90'>
                      Password Change Alerts
                    </p>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      Notify when your password is changed
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!sec)
                        createSecurity({
                          password_change_alerts: !(
                            sec?.password_change_alerts ?? true
                          ),
                        });
                      else
                        updateSecurity({
                          password_change_alerts: !(
                            sec.password_change_alerts ?? true
                          ),
                        });
                    }}
                    disabled={securityLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                      (sec?.password_change_alerts ?? true)
                        ? "bg-brand"
                        : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                        (sec?.password_change_alerts ?? true)
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Backup Codes */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center justify-between mb-4'>
                <div>
                  <h3 className='text-base font-medium text-foreground/95'>
                    Backup Codes
                  </h3>
                  <p className='text-xs text-muted-foreground mt-1'>
                    One-time use codes for account recovery
                  </p>
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  className='border-border/40 text-muted-foreground hover:text-[#] hover:bg-[#]/10 hover:border-[#]/30 transition-all shadow-sm'
                  onClick={async () => {
                    try {
                      const codes = await generateBackupCodes(10);
                      if (codes && codes.length > 0) {
                        setGeneratedBackupCodes(codes);
                        setShowBackupCodesModal(true);
                        // Also download as backup
                        const blob = new Blob([codes.join("\n")], {
                          type: "text/plain",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `jobraker-backup-codes-${new Date().toISOString().split("T")[0]}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }
                    } catch (e: any) {
                      toastError("Failed to generate codes", e.message);
                    }
                  }}
                >
                  <Plus className='w-4 h-4 mr-2' />
                  Generate New Codes
                </Button>
              </div>
              <div className='space-y-2'>
                {backupCodes && backupCodes.length > 0 ? (
                  <div className='border border-border/40 rounded-lg overflow-hidden bg-muted/50 shadow-inner'>
                    <div className='grid grid-cols-3 text-xs font-bold uppercase tracking-wider text-muted-foreground/80 bg-muted/50 py-2 px-4 border-b border-border/40'>
                      <div>ID</div>
                      <div>Status</div>
                      <div>Created</div>
                    </div>
                    <div className='divide-y divide-border/20'>
                      {backupCodes.map((bc: any) => (
                        <div
                          key={bc.id}
                          className='grid grid-cols-3 items-center text-sm py-2 px-4 hover:bg-muted/30 transition-colors'
                        >
                          <div className='text-foreground/90 font-mono text-xs'>
                            #{bc.id}
                          </div>
                          <div>
                            <span
                              className={`text-xs px-2 py-1 rounded font-medium tracking-wide ${
                                bc.used
                                  ? "bg-[#]/20 text-brand"
                                  : "bg-[#]/20 text-brand"
                              }`}
                            >
                              {bc.used ? "Used" : "Unused"}
                            </span>
                          </div>
                          <div className='text-xs text-muted-foreground/80'>
                            {bc.created_at
                              ? new Date(bc.created_at).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className='text-sm text-muted-foreground py-8 text-center border border-border/40 rounded-lg bg-muted/50'>
                    No backup codes generated yet. Click "Generate New Codes" to
                    create your first set.
                  </div>
                )}
              </div>
            </div>

            {/* Trusted Devices */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center justify-between mb-3'>
                <h3 className='text-base font-medium text-foreground/95'>
                  Trusted Devices
                </h3>
                <Button
                  variant='outline'
                  size='sm'
                  className='border-border/40 text-muted-foreground hover:text-[#] hover:bg-[#]/10 hover:border-[#]/30 transition-all shadow-sm'
                  onClick={async () => {
                    try {
                      const deviceId = crypto
                        .getRandomValues(new Uint32Array(4))
                        .join("-");
                      await trustDevice(deviceId, navigator.userAgent);
                      success("Current device trusted");
                    } catch (e: any) {
                      toastError("Failed to trust device", e.message);
                    }
                  }}
                >
                  Trust This Device
                </Button>
              </div>
              <p className='text-xs text-muted-foreground mb-4'>
                Trusted devices skip some security prompts. Revoke lost or old
                devices.
              </p>
              <div className='mt-3 border border-border/40 rounded-lg overflow-hidden bg-muted/50 shadow-inner'>
                <div className='grid grid-cols-4 text-xs font-bold uppercase tracking-wider text-muted-foreground/80 bg-muted/50 py-2 px-3 border-b border-border/40'>
                  <div>Device</div>
                  <div>Device ID</div>
                  <div>Last seen</div>
                  <div className='text-right'>Actions</div>
                </div>
                <div className='divide-y divide-border/20'>
                  {devices && devices.length > 0 ? (
                    devices.map((d: any) => (
                      <div
                        key={d.device_id}
                        className='grid grid-cols-4 items-center text-sm py-2 px-3 hover:bg-muted/30 transition-colors'
                      >
                        <div
                          className='truncate text-foreground/90 font-medium text-xs'
                          title={d.device_name || d.device_id}
                        >
                          {d.device_name || "Unnamed device"}
                        </div>
                        <div
                          className='truncate text-muted-foreground/80 text-xs font-mono'
                          title={d.device_id}
                        >
                          {String(d.device_id).slice(0, 10)}…
                        </div>
                        <div className='text-xs text-muted-foreground/80'>
                          {new Date(d.last_seen_at).toLocaleString()}
                        </div>
                        <div className='text-right'>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='text-[#] hover:text-[#] hover:bg-[#]/10 h-7 px-2 text-xs'
                            onClick={async () => {
                              if (!confirm("Revoke this device?")) return;
                              try {
                                await revokeDevice(d.device_id);
                              } catch (e: any) {
                                toastError("Failed to revoke", e.message);
                              }
                            }}
                          >
                            Revoke
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className='text-sm text-muted-foreground py-6 text-center italic'>
                      No trusted devices yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Active Sessions */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center justify-between mb-4'>
                <div>
                  <h3 className='text-base font-medium text-foreground/95'>
                    Active Sessions
                  </h3>
                  <p className='text-xs text-muted-foreground mt-1'>
                    Manage your active login sessions
                  </p>
                </div>
                {activeSessions && activeSessions.length > 1 && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={async () => {
                      if (
                        !confirm(
                          "Revoke all other sessions? You will remain logged in on this device.",
                        )
                      )
                        return;
                      try {
                        await revokeAllOtherSessions();
                      } catch (e: any) {
                        toastError("Failed to revoke sessions", e.message);
                      }
                    }}
                    className='border-border/40 text-muted-foreground hover:text-[#] hover:bg-[#]/10 hover:border-[#]/30 transition-all shadow-sm'
                  >
                    Revoke All Others
                  </Button>
                )}
              </div>
              <div className='space-y-2'>
                {activeSessions && activeSessions.length > 0 ? (
                  activeSessions.map((session: any) => (
                    <div
                      key={session.id}
                      className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-[#]/30 hover:bg-muted/50 transition-all'
                    >
                      <div className='flex-1'>
                        <div className='flex items-center gap-2 mb-1'>
                          <p className='text-sm font-medium text-foreground/90'>
                            {session.device_name ||
                              session.device_type ||
                              "Unknown Device"}
                          </p>
                          {session.is_current && (
                            <span className='text-xs px-2 py-0.5 rounded bg-[#]/20 text-[#]'>
                              Current
                            </span>
                          )}
                        </div>
                        <div className='text-xs text-muted-foreground/80 space-y-0.5'>
                          {session.browser && <p>Browser: {session.browser}</p>}
                          {session.os && <p>OS: {session.os}</p>}
                          {session.ip_address && (
                            <p>IP: {session.ip_address}</p>
                          )}
                          {session.location && (
                            <p>Location: {session.location}</p>
                          )}
                          <p>
                            Last active:{" "}
                            {new Date(
                              session.last_activity_at,
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {!session.is_current && (
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={async () => {
                            if (!confirm("Revoke this session?")) return;
                            try {
                              await revokeSession(session.id);
                            } catch (e: any) {
                              toastError("Failed to revoke session", e.message);
                            }
                          }}
                          className='text-[#] hover:text-[#] hover:bg-[#]/10'
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className='text-sm text-foreground/50 py-4 text-center border border-border/40 rounded-lg bg-muted/50'>
                    No active sessions found
                  </p>
                )}
              </div>
            </div>

            {/* Security Audit Log */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center justify-between mb-4'>
                <div>
                  <h3 className='text-base font-medium text-foreground/95'>
                    Security Audit Log
                  </h3>
                  <p className='text-xs text-muted-foreground mt-1'>
                    View your account security events
                  </p>
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => listAuditLogs(100)}
                  className='border-border/40 text-muted-foreground hover:text-[#] hover:bg-[#]/10 hover:border-[#]/30 transition-all shadow-sm'
                >
                  <RefreshCw className='w-4 h-4 mr-2' />
                  Refresh
                </Button>
              </div>
              <div className='space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent'>
                {auditLogs && auditLogs.length > 0 ? (
                  auditLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className='flex items-start justify-between p-3 bg-background/50 border border-border/40 rounded-lg hover:bg-muted/50 transition-colors'
                    >
                      <div className='flex-1'>
                        <div className='flex items-center gap-2 mb-1'>
                          <p className='text-sm font-medium text-foreground/90'>
                            {log.event_type}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              log.risk_level === "critical"
                                ? "bg-[#]/20 text-brand"
                                : log.risk_level === "high"
                                  ? "bg-brand/20 text-brand"
                                  : log.risk_level === "medium"
                                    ? "bg-brand/20 text-brand"
                                    : "bg-brand/20 text-brand"
                            }`}
                          >
                            {log.risk_level}
                          </span>
                        </div>
                        {log.event_description && (
                          <p className='text-xs text-muted-foreground/80 mb-1'>
                            {log.event_description}
                          </p>
                        )}
                        <div className='text-[11px] text-muted-foreground/60 space-y-0.5 mt-2 flex flex-row gap-3'>
                          {log.ip_address && <span>IP: {log.ip_address}</span>}
                          {log.location && <span>Loc: {log.location}</span>}
                          <span>
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className='text-sm text-foreground/50 py-4 text-center border border-border/40 rounded-lg bg-muted/50'>
                    No audit logs yet
                  </p>
                )}
              </div>
            </div>

            {/* API Keys */}
            {sec?.api_keys_enabled && (
              <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
                <div className='flex items-center justify-between mb-4'>
                  <div>
                    <h3 className='text-base font-medium text-foreground/95'>
                      API Keys
                    </h3>
                    <p className='text-xs text-muted-foreground mt-1'>
                      Manage your API keys for programmatic access
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      setNewApiKeyName("");
                      setNewApiKeyExpiry(undefined);
                      setNewApiKeyIpRestrictions("");
                      setCreatedApiKey(null);
                      setApiKeyModalOpen(true);
                    }}
                    className='border-border/40 text-muted-foreground hover:text-brand hover:bg-brand/10 hover:border-brand/30 transition-all shadow-sm'
                  >
                    <Plus className='w-4 h-4 mr-2' />
                    Create Key
                  </Button>
                </div>
                <div className='space-y-2'>
                  {apiKeys && apiKeys.length > 0 ? (
                    apiKeys.map((key: any) => (
                      <div
                        key={key.id}
                        className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-brand/30 hover:bg-muted/50 transition-all'
                      >
                        <div className='flex-1'>
                          <div className='flex items-center gap-2 mb-1'>
                            <p className='text-sm font-medium text-foreground/90'>
                              {key.key_name}
                            </p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${key.is_active ? "bg-brand/20 text-brand" : "bg-brand/20 text-brand"}`}
                            >
                              {key.is_active ? "Active" : "Revoked"}
                            </span>
                          </div>
                          <div className='text-xs text-muted-foreground/80 space-y-0.5'>
                            <p>Prefix: {key.key_prefix}...</p>
                            {key.last_used_at && (
                              <p>
                                Last used:{" "}
                                {new Date(key.last_used_at).toLocaleString()}
                              </p>
                            )}
                            {key.expires_at && (
                              <p>
                                Expires:{" "}
                                {new Date(key.expires_at).toLocaleString()}
                              </p>
                            )}
                            {key.ip_restrictions &&
                              key.ip_restrictions.length > 0 && (
                                <p>
                                  IP Restrictions:{" "}
                                  {key.ip_restrictions.join(", ")}
                                </p>
                              )}
                          </div>
                        </div>
                        <div className='flex gap-2'>
                          {key.is_active ? (
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={async () => {
                                if (!confirm("Revoke this API key?")) return;
                                try {
                                  await revokeApiKey(key.id);
                                } catch (e: any) {
                                  toastError("Failed to revoke key", e.message);
                                }
                              }}
                              className='text-brand hover:text-brand'
                            >
                              Revoke
                            </Button>
                          ) : null}
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={async () => {
                              if (
                                !confirm(
                                  "Permanently delete this API key? This action cannot be undone.",
                                )
                              )
                                return;
                              try {
                                await deleteApiKey(key.id);
                              } catch (e: any) {
                                toastError("Failed to delete key", e.message);
                              }
                            }}
                            className='text-brand hover:text-brand'
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className='text-sm text-foreground/50 py-4 text-center border border-border/40 rounded-lg bg-muted/50'>
                      No API keys created yet
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Advanced Security Settings */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <h3 className='text-base font-medium text-foreground mb-4'>
                Advanced Security
              </h3>
              <div className='space-y-4'>
                {/* Session Management */}
                <div className='space-y-3'>
                  <h4 className='text-sm font-medium text-foreground/80'>
                    Session Management
                  </h4>
                  <div className='space-y-3'>
                    <div className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-brand/30 hover:bg-muted/50 transition-all'>
                      <div className='flex-1'>
                        <p className='text-sm font-medium text-foreground/90'>
                          Auto-logout Inactive Sessions
                        </p>
                        <p className='text-xs text-muted-foreground mt-0.5'>
                          Automatically logout inactive sessions
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (!sec)
                            createSecurity({
                              auto_logout_inactive: !(
                                sec?.auto_logout_inactive ?? true
                              ),
                            });
                          else
                            updateSecurity({
                              auto_logout_inactive: !(
                                sec.auto_logout_inactive ?? true
                              ),
                            });
                        }}
                        disabled={securityLoading}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                          (sec?.auto_logout_inactive ?? true)
                            ? "bg-brand"
                            : "bg-muted"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                            (sec?.auto_logout_inactive ?? true)
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-xs text-muted-foreground mb-2'>
                          Session Timeout (minutes)
                        </label>
                        <Input
                          type='number'
                          value={sec?.session_timeout_minutes || 60}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 60;
                            if (!sec)
                              createSecurity({ session_timeout_minutes: val });
                            else
                              updateSecurity({ session_timeout_minutes: val });
                          }}
                          disabled={securityLoading}
                          className='bg-card border border-border/40 focus:ring-brand/30 focus:border-brand/50 placeholder:text-muted-foreground/50 transition-all text-sm rounded-lg'
                          min='0'
                        />
                      </div>
                      <div>
                        <label className='block text-xs text-muted-foreground mb-2'>
                          Max Concurrent Sessions
                        </label>
                        <Input
                          type='number'
                          value={sec?.max_concurrent_sessions || 5}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 5;
                            if (!sec)
                              createSecurity({ max_concurrent_sessions: val });
                            else
                              updateSecurity({ max_concurrent_sessions: val });
                          }}
                          disabled={securityLoading}
                          className='bg-card border border-border/40 focus:ring-brand/30 focus:border-brand/50 placeholder:text-muted-foreground/50 transition-all text-sm rounded-lg'
                          min='1'
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* IP Security */}
                <div className='space-y-3 pt-4 border-t border-border/40'>
                  <h4 className='text-sm font-medium text-foreground/80'>
                    IP Security
                  </h4>
                  <div className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-brand/30 hover:bg-muted/50 transition-all'>
                    <div className='flex-1'>
                      <p className='text-sm font-medium text-foreground/90'>
                        IP Allowlist
                      </p>
                      <p className='text-xs text-muted-foreground mt-0.5'>
                        Restrict access to specific IP addresses
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (!sec)
                          createSecurity({
                            ip_foregroundlist_enabled: !(
                              sec?.ip_foregroundlist_enabled ?? false
                            ),
                          });
                        else
                          updateSecurity({
                            ip_foregroundlist_enabled: !(
                              sec.ip_foregroundlist_enabled ?? false
                            ),
                          });
                      }}
                      disabled={securityLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        (sec?.ip_foregroundlist_enabled ?? false)
                          ? "bg-brand"
                          : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          (sec?.ip_foregroundlist_enabled ?? false)
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {(sec?.ip_foregroundlist_enabled ?? false) && (
                    <div className='space-y-4 p-4 bg-background/50 border border-border/40 rounded-lg'>
                      <div className='flex gap-2'>
                        <Input
                          type='text'
                          placeholder='Enter IP address'
                          value={newAllowedIp}
                          onChange={(e) => setNewAllowedIp(e.target.value)}
                          className='bg-card border border-border/40 focus:ring-brand/30 focus:border-brand/50 placeholder:text-muted-foreground/50 transition-all text-sm rounded-lg flex-1'
                        />
                        <Button
                          size='sm'
                          onClick={() => {
                            if (!newAllowedIp.trim()) return;
                            const current = sec?.allowed_ips || [];
                            const updated = [...current, newAllowedIp.trim()];
                            if (!sec) createSecurity({ allowed_ips: updated });
                            else updateSecurity({ allowed_ips: updated });
                            setNewAllowedIp("");
                          }}
                          className='bg-brand text-black hover:bg-[#e6c200] shadow-md shadow-brand/10'
                        >
                          Add
                        </Button>
                      </div>
                      <div className='space-y-1 bg-muted/40 border border-border/20 rounded-md p-2 divide-y divide-border/20'>
                        {(sec?.allowed_ips || []).map(
                          (ip: string, idx: number) => (
                            <div
                              key={idx}
                              className='flex items-center justify-between text-sm text-foreground/80 py-2 px-2'
                            >
                              <span className='font-mono text-xs'>{ip}</span>
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => {
                                  const current = sec?.allowed_ips || [];
                                  const updated = current.filter(
                                    (_: string, i: number) => i !== idx,
                                  );
                                  if (!sec)
                                    createSecurity({ allowed_ips: updated });
                                  else updateSecurity({ allowed_ips: updated });
                                }}
                                className='text-brand hover:text-brand h-6 px-2'
                              >
                                Remove
                              </Button>
                            </div>
                          ),
                        )}
                        {(!sec?.allowed_ips ||
                          sec?.allowed_ips.length === 0) && (
                          <div className='text-xs text-muted-foreground py-2 px-2 italic text-center'>
                            No IPs allowed. Use with caution.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Additional Security */}
                <div className='space-y-3 pt-4 border-t border-border/40'>
                  <h4 className='text-sm font-medium text-foreground/80'>
                    Additional Security
                  </h4>
                  <div className='space-y-3'>
                    <div className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-brand/30 hover:bg-muted/50 transition-all'>
                      <div className='flex-1'>
                        <p className='text-sm font-medium text-foreground/90'>
                          API Keys
                        </p>
                        <p className='text-xs text-muted-foreground mt-0.5'>
                          Enable API key management for programmatic access
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (!sec)
                            createSecurity({
                              api_keys_enabled: !(
                                sec?.api_keys_enabled ?? false
                              ),
                            });
                          else
                            updateSecurity({
                              api_keys_enabled: !(
                                sec.api_keys_enabled ?? false
                              ),
                            });
                        }}
                        disabled={securityLoading}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                          (sec?.api_keys_enabled ?? false)
                            ? "bg-brand"
                            : "bg-muted"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                            (sec?.api_keys_enabled ?? false)
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "appearance":
        return (
          <div
            id='settings-tab-appearance'
            data-tour='settings-tab-appearance'
            className='space-y-6'
          >
            {/* Theme Selection */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <h3 className='text-base font-medium text-foreground/95 mb-6'>
                Theme
              </h3>
              <div className='grid grid-cols-3 gap-3'>
                {["Dark", "Light", "Auto"].map((theme) => (
                  <button
                    key={theme}
                    onClick={async () => {
                      const value = theme.toLowerCase() as
                        | "dark"
                        | "light"
                        | "auto";
                      try {
                        if (!appearanceSettings)
                          await (appearance as any).createSettings({
                            theme: value,
                          });
                        else
                          await (appearance as any).updateSettings({
                            theme: value,
                          });
                      } catch (e: any) {
                        toastError("Failed to set theme", e.message);
                      }
                    }}
                    className={`p-4 rounded-lg border transition-all ${
                      (appearanceSettings?.theme || "auto") ===
                      theme.toLowerCase()
                        ? "border-brand bg-brand/10 shadow-sm shadow-brand/5"
                        : "border-border/40 hover:border-brand/30"
                    }`}
                  >
                    <div className='text-center'>
                      <div
                        className={`w-10 h-10 rounded-lg mx-auto mb-3 ${
                          theme === "Dark"
                            ? "bg-black ring-1 ring-white/10"
                            : theme === "Light"
                              ? "bg-white ring-1 ring-black/10"
                              : "bg-gradient-to-r from-50% to-50% from-black border to-white"
                        }`}
                      ></div>
                      <p className='text-foreground/90 text-sm font-medium tracking-wide'>
                        {theme}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color */}
            {/* <div className='bg-card border border-border rounded-xl p-6'>
              <h3 className='text-base font-medium text-foreground mb-6'>
                Accent Color
              </h3>
              <div className='flex flex-wrap gap-4'>
                {[
                  "#1dff00", // Signal Green
                  "#1dff00", // Neon Green
                  "#3b82f6", // Blue
                  "#8b5cf6", // Purple
                  "#1dff00", // Neon Green
                  "#1dff00", // Action Green
                ].map((color) => (
                  <button
                    key={color}
                    onClick={async () => {
                      try {
                        if (!appearanceSettings)
                          await (appearance as any).createSettings({
                            accent_color: color,
                          });
                        else
                          await (appearance as any).updateSettings({
                            accent_color: color,
                          });
                      } catch (e: any) {
                        toastError("Failed to set accent", e.message);
                      }
                    }}
                    className={`w-12 h-12 rounded-full cursor-pointer border-2 transition-all hover:scale-110 shadow-lg ${(appearanceSettings?.accent_color || "#1dff00").toLowerCase() === color.toLowerCase()
                      ? "border-white ring-4 ring-white/20 scale-110"
                      : "border-background/50 hover:border-foreground/50"
                      }`}
                    style={{ backgroundColor: color }}
                  ></button>
                ))}
              </div>
            </div> */}

            {/* Preferences */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <h3 className='text-base font-medium text-foreground/95 mb-6'>
                Preferences
              </h3>
              <div className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-brand/30 hover:bg-muted/50 transition-all'>
                <div>
                  <p className='text-sm font-medium text-foreground/90'>
                    Reduced Motion
                  </p>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    Minimize animations and transitions
                  </p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      if (!appearanceSettings)
                        await (appearance as any).createSettings({
                          reduce_motion: true,
                        });
                      else
                        await (appearance as any).updateSettings({
                          reduce_motion: !(
                            appearanceSettings.reduce_motion ?? false
                          ),
                        });
                    } catch (e: any) {
                      toastError(
                        "Failed to update motion preference",
                        e.message,
                      );
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    (appearanceSettings?.reduce_motion ?? false)
                      ? "bg-brand"
                      : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                      (appearanceSettings?.reduce_motion ?? false)
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div
            id='settings-tab-privacy'
            data-tour='settings-tab-privacy'
            className='space-y-6'
          >
            {/* Profile Visibility */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center gap-3 mb-4'>
                <User className='w-5 h-5 text-foreground/70' />
                <h3 className='text-base font-medium text-foreground/95'>
                  Profile Visibility
                </h3>
              </div>
              <div className='space-y-3'>
                {[
                  {
                    key: "is_profile_public",
                    label: "Public Profile",
                    desc: "Allow your profile to be visible to others",
                    icon: Globe,
                  },
                  {
                    key: "show_email",
                    label: "Show Email",
                    desc: "Display your email address on your profile",
                    icon: Mail,
                  },
                  {
                    key: "allow_profile_search",
                    label: "Profile Search",
                    desc: "Allow your profile to appear in search results",
                    icon: Search,
                  },
                  {
                    key: "share_with_recruiters",
                    label: "Share with Recruiters",
                    desc: "Allow recruiters to view your profile",
                    icon: Users,
                  },
                  {
                    key: "allow_company_access",
                    label: "Company Access",
                    desc: "Allow companies to access your profile data",
                    icon: Building,
                  },
                  {
                    key: "show_application_status",
                    label: "Show Application Status",
                    desc: "Display application status to companies",
                    icon: Briefcase,
                  },
                ].map((row: any) => (
                  <div
                    key={row.key}
                    className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-brand/30 hover:bg-muted/50 transition-all'
                  >
                    <div className='flex items-center gap-3 flex-1'>
                      <row.icon className='w-4 h-4 text-foreground/50' />
                      <div className='flex-1'>
                        <p className='text-sm font-medium text-foreground/90'>
                          {row.label}
                        </p>
                        <p className='text-xs text-muted-foreground mt-0.5'>
                          {row.desc}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          if (!privacy)
                            await createPrivacy({
                              [row.key]: !(
                                (privacy as any)?.[row.key] ?? false
                              ),
                            } as any);
                          else
                            await updatePrivacy({
                              [row.key]: !(privacy as any)[row.key],
                            } as any);
                        } catch (e: any) {
                          toastError("Failed to update privacy", e.message);
                        }
                      }}
                      disabled={privacyLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        ((privacy as any)?.[row.key] ?? false)
                          ? "bg-brand"
                          : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          ((privacy as any)?.[row.key] ?? false)
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Sharing & Analytics */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center gap-3 mb-4'>
                <Share2 className='w-5 h-5 text-foreground/70' />
                <h3 className='text-base font-medium text-foreground/95'>
                  Data Sharing & Analytics
                </h3>
              </div>
              <div className='space-y-3'>
                {[
                  {
                    key: "share_analytics",
                    label: "Share Anonymized Analytics",
                    desc: "Help improve the product by sharing anonymized usage data",
                    icon: Activity,
                  },
                  {
                    key: "allow_third_party_sharing",
                    label: "Third-Party Sharing",
                    desc: "Share data with third-party services and partners",
                    icon: Share2,
                  },
                  {
                    key: "allow_activity_tracking",
                    label: "Activity Tracking",
                    desc: "Track user activity for analytics and improvements",
                    icon: Activity,
                  },
                  {
                    key: "allow_location_sharing",
                    label: "Location Sharing",
                    desc: "Share location data for job matching",
                    icon: MapPin,
                  },
                  {
                    key: "allow_search_indexing",
                    label: "Search Engine Indexing",
                    desc: "Allow search engines to index your public profile",
                    icon: Search,
                  },
                ].map((row: any) => (
                  <div
                    key={row.key}
                    className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-brand/30 hover:bg-muted/50 transition-all'
                  >
                    <div className='flex items-center gap-3 flex-1'>
                      <row.icon className='w-4 h-4 text-foreground/50' />
                      <div className='flex-1'>
                        <p className='text-sm font-medium text-foreground/90'>
                          {row.label}
                        </p>
                        <p className='text-xs text-muted-foreground mt-0.5'>
                          {row.desc}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          if (!privacy)
                            await createPrivacy({
                              [row.key]: !(
                                (privacy as any)?.[row.key] ?? false
                              ),
                            } as any);
                          else
                            await updatePrivacy({
                              [row.key]: !(privacy as any)[row.key],
                            } as any);
                        } catch (e: any) {
                          toastError("Failed to update privacy", e.message);
                        }
                      }}
                      disabled={privacyLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        ((privacy as any)?.[row.key] ?? false)
                          ? "bg-brand"
                          : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          ((privacy as any)?.[row.key] ?? false)
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cookie Preferences */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center gap-3 mb-4'>
                <Cookie className='w-5 h-5 text-foreground/70' />
                <h3 className='text-base font-medium text-foreground/95'>
                  Cookie Preferences
                </h3>
              </div>
              <div className='space-y-3'>
                {[
                  {
                    key: "allow_cookie_tracking",
                    label: "Cookie Tracking",
                    desc: "Allow cookie-based tracking and personalization",
                    icon: Cookie,
                  },
                  {
                    key: "allow_functional_cookies",
                    label: "Functional Cookies",
                    desc: "Required for basic site functionality",
                    icon: Check,
                  },
                  {
                    key: "allow_analytics_cookies",
                    label: "Analytics Cookies",
                    desc: "Help us understand how you use the platform",
                    icon: Activity,
                  },
                  {
                    key: "allow_advertising_cookies",
                    label: "Advertising Cookies",
                    desc: "Used for personalized ads and marketing",
                    icon: Zap,
                  },
                  {
                    key: "personalized_ads",
                    label: "Personalized Ads",
                    desc: "Use your data to personalize advertisements",
                    icon: Sparkles,
                  },
                ].map((row: any) => (
                  <div
                    key={row.key}
                    className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-brand/30 hover:bg-muted/50 transition-all'
                  >
                    <div className='flex items-center gap-3 flex-1'>
                      <row.icon className='w-4 h-4 text-foreground/50' />
                      <div className='flex-1'>
                        <p className='text-sm font-medium text-foreground/90'>
                          {row.label}
                        </p>
                        <p className='text-xs text-muted-foreground mt-0.5'>
                          {row.desc}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          if (!privacy)
                            await createPrivacy({
                              [row.key]: !(
                                (privacy as any)?.[row.key] ?? false
                              ),
                            } as any);
                          else
                            await updatePrivacy({
                              [row.key]: !(privacy as any)[row.key],
                            } as any);
                        } catch (e: any) {
                          toastError("Failed to update privacy", e.message);
                        }
                      }}
                      disabled={privacyLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        ((privacy as any)?.[row.key] ?? false)
                          ? "bg-brand"
                          : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          ((privacy as any)?.[row.key] ?? false)
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Retention & Management */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center gap-3 mb-4'>
                <Database className='w-5 h-5 text-foreground/70' />
                <h3 className='text-base font-medium text-foreground/95'>
                  Data Retention & Management
                </h3>
              </div>
              <div className='space-y-4'>
                <div className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-brand/30 hover:bg-muted/50 transition-all'>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-foreground/90 mb-1'>
                      Data Retention Period
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Number of days to retain your data (0 = indefinite)
                    </p>
                  </div>
                  <Input
                    type='number'
                    min='0'
                    value={privacy?.data_retention_days ?? 365}
                    onChange={(e) => {
                      const days = parseInt(e.target.value) || 0;
                      if (!privacy)
                        createPrivacy({ data_retention_days: days } as any);
                      else updatePrivacy({ data_retention_days: days } as any);
                    }}
                    className='w-24 bg-card border border-border/40 focus:ring-brand/30 focus:border-brand/50 transition-all rounded-lg text-sm'
                  />
                </div>
                {[
                  {
                    key: "auto_delete_inactive",
                    label: "Auto-Delete Inactive Accounts",
                    desc: "Automatically delete data for inactive accounts after retention period",
                    icon: Trash2,
                  },
                  {
                    key: "resume_default_public",
                    label: "Resumes Public by Default",
                    desc: "New resumes are public unless you change them",
                    icon: FileText,
                  },
                  {
                    key: "allow_marketing_emails",
                    label: "Marketing Emails",
                    desc: "Receive marketing and promotional emails",
                    icon: Mail,
                  },
                ].map((row: any) => (
                  <div
                    key={row.key}
                    className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-brand/30 hover:bg-muted/50 transition-all'
                  >
                    <div className='flex items-center gap-3 flex-1'>
                      <row.icon className='w-4 h-4 text-foreground/50' />
                      <div className='flex-1'>
                        <p className='text-sm font-medium text-foreground/90'>
                          {row.label}
                        </p>
                        <p className='text-xs text-muted-foreground mt-0.5'>
                          {row.desc}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          if (!privacy)
                            await createPrivacy({
                              [row.key]: !(
                                (privacy as any)?.[row.key] ?? false
                              ),
                            } as any);
                          else
                            await updatePrivacy({
                              [row.key]: !(privacy as any)[row.key],
                            } as any);
                        } catch (e: any) {
                          toastError("Failed to update privacy", e.message);
                        }
                      }}
                      disabled={privacyLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        ((privacy as any)?.[row.key] ?? false)
                          ? "bg-brand"
                          : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          ((privacy as any)?.[row.key] ?? false)
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* GDPR Compliance */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center gap-3 mb-4'>
                <Shield className='w-5 h-5 text-foreground/70' />
                <h3 className='text-base font-medium text-foreground/95'>
                  GDPR & Data Rights
                </h3>
              </div>
              <div className='space-y-4'>
                <div className='flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-lg hover:border-brand/30 hover:bg-muted/50 transition-all'>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-foreground/90 mb-1'>
                      GDPR Consent
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {privacy?.gdpr_consent_given
                        ? `Given on ${privacy.gdpr_consent_date ? new Date(privacy.gdpr_consent_date).toLocaleDateString() : "N/A"}`
                        : "You have not given GDPR consent yet"}
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={async () => {
                      try {
                        await updateGDPRConsent(!privacy?.gdpr_consent_given);
                      } catch (e: any) {
                        toastError("Failed to update consent", e.message);
                      }
                    }}
                    className='border-border/40 text-muted-foreground hover:bg-brand/10 hover:text-brand hover:border-brand/30 transition-all'
                  >
                    {privacy?.gdpr_consent_given
                      ? "Withdraw Consent"
                      : "Give Consent"}
                  </Button>
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <Button
                    variant='outline'
                    onClick={handleExportData}
                    className='border-border/40 text-muted-foreground hover:bg-brand/10 hover:text-brand hover:border-brand/30 transition-all justify-start'
                  >
                    <Download className='w-4 h-4 mr-2' />
                    Export My Data
                  </Button>
                  <Button
                    variant='outline'
                    onClick={() => setShowDeletionRequestModal(true)}
                    className='border-brand/30 text-brand hover:bg-brand/10 hover:border-brand/50 justify-start'
                  >
                    <Trash2 className='w-4 h-4 mr-2' />
                    Request Data Deletion
                  </Button>
                </div>
              </div>
            </div>

            {/* Privacy Audit Log */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center gap-3 mb-4'>
                <History className='w-5 h-5 text-foreground/70' />
                <h3 className='text-base font-medium text-foreground/95'>
                  Privacy Activity Log
                </h3>
              </div>
              <div className='space-y-2 max-h-64 overflow-y-auto pr-2'>
                {privacyAuditLogs && privacyAuditLogs.length > 0 ? (
                  privacyAuditLogs.slice(0, 10).map((log: any) => (
                    <div
                      key={log.id}
                      className='flex items-start gap-3 p-3 bg-background/50 border border-border/40 rounded-lg hover:border-brand/30 hover:bg-muted/50 transition-all'
                    >
                      <div className='flex-1'>
                        <p className='text-xs font-medium text-foreground/90 capitalize'>
                          {log.action_type.replace(/_/g, " ")}
                        </p>
                        {log.setting_name && (
                          <p className='text-xs text-muted-foreground mt-0.5'>
                            {log.setting_name}: {log.old_value} →{" "}
                            {log.new_value}
                          </p>
                        )}
                        <p className='text-xs text-foreground/40 mt-1'>
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className='text-sm text-foreground/50 py-4 text-center border border-border/40 rounded-lg bg-muted/50'>
                    No privacy activity logged yet
                  </div>
                )}
              </div>
            </div>

            {/* Data Deletion Requests */}
            {privacyDeletionRequests && privacyDeletionRequests.length > 0 && (
              <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
                <div className='flex items-center gap-3 mb-4'>
                  <AlertTriangle className='w-5 h-5 text-brand' />
                  <h3 className='text-base font-medium text-foreground/95'>
                    Active Deletion Requests
                  </h3>
                </div>
                <div className='space-y-2'>
                  {privacyDeletionRequests
                    .filter(
                      (r: any) =>
                        r.status !== "completed" && r.status !== "cancelled",
                    )
                    .map((req: any) => (
                      <div
                        key={req.id}
                        className='p-4 bg-brand/10 border border-brand/20 rounded-lg'
                      >
                        <div className='flex items-start justify-between'>
                          <div className='flex-1'>
                            <p className='text-sm font-medium text-brand capitalize'>
                              {req.request_type.replace(/_/g, " ")}
                            </p>
                            <p className='text-xs text-brand/80 mt-1'>
                              Status: {req.status}
                            </p>
                            {req.scheduled_deletion_date && (
                              <p className='text-xs text-brand/80 mt-1'>
                                Scheduled:{" "}
                                {new Date(
                                  req.scheduled_deletion_date,
                                ).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              req.status === "pending"
                                ? "bg-brand/20 text-brand"
                                : req.status === "processing"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-zinc-500/20 text-zinc-400"
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Account Deletion */}
            <div className='bg-card border border-brand/30 rounded-xl p-6 shadow-sm ring-1 ring-white/5'>
              <div className='flex items-center gap-3 mb-4'>
                <AlertTriangle className='w-5 h-5 text-brand' />
                <h3 className='text-base font-medium text-brand'>
                  Danger Zone
                </h3>
              </div>
              <Button
                variant='outline'
                onClick={() => {
                  setShowAccountDeletionModal(true);
                  setAccountDeletionEmail("");
                }}
                className='w-full bg-card border-brand/30 text-brand hover:bg-brand/10 hover:border-brand/50 shadow-sm'
              >
                <Trash2 className='w-4 h-4 mr-2' />
                Delete Account Permanently
              </Button>
            </div>
          </div>
        );

      case "job-sources":
        // Define the default job source domains
        const defaultJobSourceDomains = [
          // IMPORTANT/PREMIUM SOURCES
          {
            id: "dice.com",
            domain: "dice.com",
            name: "Dice",
            description: "Tech job board",
            logo: "https://www.google.com/s2/favicons?domain=dice.com&sz=128",
            color: "green",
            requiresCredentials: true,
          },
          {
            id: "wellfound.com",
            domain: "wellfound.com",
            name: "Wellfound (AngelList)",
            description: "Startup jobs platform",
            logo: "https://www.google.com/s2/favicons?domain=wellfound.com&sz=128",
            color: "purple",
            requiresCredentials: true,
          },
          {
            id: "hired.com",
            domain: "hired.com",
            name: "Hired",
            description: "Tech talent marketplace",
            logo: "https://www.google.com/s2/favicons?domain=hired.com&sz=128",
            color: "purple",
            requiresCredentials: true,
          },
          {
            id: "ycombinator.com",
            domain: "ycombinator.com",
            name: "Y Combinator",
            description: "Work at a startup",
            logo: "https://www.google.com/s2/favicons?domain=ycombinator.com&sz=128",
            color: "indigo",
            requiresCredentials: true,
          },
          {
            id: "otta.com",
            domain: "otta.com",
            name: "Otta",
            description: "Curated tech roles",
            logo: "https://www.google.com/s2/favicons?domain=otta.com&sz=128",
            color: "green",
            requiresCredentials: true,
          },
          {
            id: "flexjobs.com",
            domain: "flexjobs.com",
            name: "FlexJobs",
            description: "Vetted remote/flexible jobs",
            logo: "https://www.google.com/s2/favicons?domain=flexjobs.com&sz=128",
            color: "blue",
            requiresCredentials: true,
          },
          {
            id: "talent.hubstaff.com",
            domain: "talent.hubstaff.com",
            name: "Hubstaff Talent",
            description: "Free remote job board",
            logo: "https://www.google.com/s2/favicons?domain=hubstaff.com&sz=128",
            color: "indigo",
            requiresCredentials: true,
          },
          {
            id: "levels.fyi",
            domain: "levels.fyi",
            name: "Levels.fyi",
            description: "Levels.fyi (salary/compensation data)",
            logo: levelsFyiLogo,
            color: "indigo",
            requiresCredentials: false,
          },
          {
            id: "builtin.com",
            domain: "builtin.com",
            name: "Built In",
            description: "US Tech hubs & hubs",
            logo: "https://www.google.com/s2/favicons?domain=builtin.com&sz=128",
            color: "green",
            requiresCredentials: false,
          },
          // LOW RISK / NO ACCOUNT NEEDED
          {
            id: "greenhouse.io",
            domain: "greenhouse.io",
            name: "Greenhouse",
            description: "Company job boards",
            logo: "https://www.google.com/s2/favicons?domain=greenhouse.io&sz=128",
            color: "green",
            requiresCredentials: false,
          },
          {
            id: "lever.co",
            domain: "lever.co",
            name: "Lever",
            description: "Company job boards",
            logo: "https://www.google.com/s2/favicons?domain=lever.co&sz=128",
            color: "purple",
            requiresCredentials: false,
          },
          {
            id: "remote.co",
            domain: "remote.co",
            name: "Remote.co",
            description: "Remote.co job board",
            logo: remoteCoLogo,
            color: "blue",
            requiresCredentials: false,
          },
          {
            id: "remotive.com",
            domain: "remotive.com",
            name: "Remotive",
            description: "Remotive job board",
            logo: remotiveLogo,
            color: "green",
            requiresCredentials: false,
          },
          {
            id: "remoteok.com",
            domain: "remoteok.com",
            name: "RemoteOK",
            description: "RemoteOK job board",
            logo: remoteokLogo,
            color: "purple",
            requiresCredentials: false,
          },
          {
            id: "weworkremotely.com",
            domain: "weworkremotely.com",
            name: "We Work Remotely",
            description: "Remote work community",
            logo: "https://www.google.com/s2/favicons?domain=weworkremotely.com&sz=128",
            color: "blue",
            requiresCredentials: false,
          },
          {
            id: "jobicy.com",
            domain: "jobicy.com",
            name: "Jobicy",
            description: "Jobicy job board",
            logo: jobicyLogo,
            color: "green",
            requiresCredentials: false,
          },
          {
            id: "cryptojobslist.com",
            domain: "cryptojobslist.com",
            name: "CryptoJobsList",
            description: "Web3 & Crypto jobs",
            logo: "https://www.google.com/s2/favicons?domain=cryptojobslist.com&sz=128",
            color: "green",
            requiresCredentials: false,
          },
          {
            id: "startup.jobs",
            domain: "startup.jobs",
            name: "Startup.jobs",
            description: "Startup job aggregator",
            logo: "https://www.google.com/s2/favicons?domain=startup.jobs&sz=128",
            color: "blue",
            requiresCredentials: false,
          },
          {
            id: "nodesk.co",
            domain: "nodesk.co",
            name: "NoDesk",
            description: "Remote work resources",
            logo: "https://www.google.com/s2/favicons?domain=nodesk.co&sz=128",
            color: "green",
            requiresCredentials: false,
          },
          {
            id: "remoterocketship.com",
            domain: "remoterocketship.com",
            name: "Remote Rocketship",
            description: "AI-curated remote jobs",
            logo: "https://www.google.com/s2/favicons?domain=remoterocketship.com&sz=128",
            color: "purple",
            requiresCredentials: false,
          },
          {
            id: "jobspresso.com",
            domain: "jobspresso.com",
            name: "Jobspresso",
            description: "High-quality remote jobs",
            logo: "https://www.google.com/s2/favicons?domain=jobspresso.com&sz=128",
            color: "green",
            requiresCredentials: false,
          },
          {
            id: "flexa.careers",
            domain: "flexa.careers",
            name: "Flexa Careers",
            description: "Verified flexible companies",
            logo: "https://www.google.com/s2/favicons?domain=flexa.careers&sz=128",
            color: "blue",
            requiresCredentials: false,
          },
          {
            id: "workingnomads.com",
            domain: "workingnomads.com",
            name: "Working Nomads",
            description: "Curated remote jobs",
            logo: "https://www.google.com/s2/favicons?domain=workingnomads.com&sz=128",
            color: "indigo",
            requiresCredentials: false,
          },
          {
            id: "jobs.micro1.ai",
            domain: "jobs.micro1.ai",
            name: "micro1",
            description: "micro1 expert & AI training opportunities",
            logo: "https://www.google.com/s2/favicons?domain=micro1.ai&sz=128",
            color: "indigo",
            requiresCredentials: false,
          },
        ];

        const handleToggleDefaultDomain = (domain: string) => {
          setEnabledDefaultDomains((prev) => {
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
            if (!uid) {
              toastError(
                "Not signed in",
                "Please sign in again to save your job source settings.",
              );
              setSavingDomains(false);
              return;
            }

            const normalizeDomain = (value: string) => {
              const trimmed = value.trim().toLowerCase();
              if (!trimmed) return null;
              const hostname = trimmed
                .replace(/^https?:\/\//, "")
                .replace(/^www\./, "")
                .split(/[\/?#]/)[0]
                ?.trim();
              if (!hostname) return null;
              if (
                !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(
                  hostname,
                )
              ) {
                return null;
              }
              return hostname;
            };

            const enabledDefaults = Array.from(enabledDefaultDomains)
              .map((domain) => normalizeDomain(domain))
              .filter(Boolean) as string[];

            const payload = {
              id: uid,
              enabled_default_sources: enabledDefaults,
              allowed_domains: enabledDefaults, // Custom domains are now retired, only save defaults
              source_credentials: sourceCredentials,
              updated_at: new Date().toISOString(),
            };
            const { error } = await (supabase as any)
              .from("job_source_settings")
              .upsert(payload, { onConflict: "id" });
            if (error) throw error;
            success(
              "Job source domains saved",
              `Saved ${enabledDefaults.length} enabled domains for job discovery.`,
            );
          } catch (e: any) {
            toastError(
              "Save failed",
              e.message || "Failed to save domain settings",
            );
          }
          setSavingDomains(false);
        };

        return (
          <div
            id='settings-tab-job-sources'
            data-tour='settings-tab-job-sources'
            className='space-y-6'
          >
            {/* Header */}
            <div>
              <h2 className='text-2xl font-bold text-foreground/95 mb-2'>
                Job Sources
              </h2>
              <p className='text-sm text-foreground/50'>
                Configure allowed domains for job search. Toggle default job
                boards and add custom domains.
              </p>
            </div>

            {/* Available Job Sources */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <h3 className='text-lg font-semibold text-foreground/95 mb-4'>
                Available Job Sources
              </h3>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                {defaultJobSourceDomains.map((source) => {
                  const isEnabled = enabledDefaultDomains.has(source.domain);

                  return (
                    <div
                      key={source.id}
                      onClick={() => {
                        setConfigModalSource(source);
                        setConfigUsername("");
                        setConfigPassword("");
                      }}
                      className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col gap-4 group ${
                        isEnabled
                          ? "bg-brand/5 border-brand/30 shadow-[0_0_15px_rgba(29,255,0,0.05)]"
                          : "bg-background/50 border-border/40 hover:border-border/60 hover:bg-muted/50"
                      }`}
                    >
                      <div className='flex items-center justify-between'>
                        <div
                          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                            source.color === "blue"
                              ? "from-blue-500/20 to-blue-500/10 border-blue-500/30"
                              : source.color === "green"
                                ? "from-brand/20 to-brand/10 border-brand/30"
                                : source.color === "purple"
                                  ? "from-purple-500/20 to-purple-500/10 border-purple-500/30"
                                  : "from-indigo-500/20 to-indigo-500/10 border-indigo-500/30"
                          } border flex items-center justify-center overflow-hidden shrink-0 shadow-lg`}
                        >
                          <img
                            src={getProxiedLogoUrl(source.logo)}
                            alt={source.name}
                            className='w-10 h-10 object-contain'
                            onError={(e) => {
                              const target =
                                e.currentTarget as HTMLImageElement;
                              target.style.display = "none";
                              const fallback = document.createElement("div");
                              fallback.className = `w-8 h-8 rounded ${
                                source.color === "blue"
                                  ? "bg-blue-500/30"
                                  : source.color === "green"
                                    ? "bg-brand/30"
                                    : source.color === "purple"
                                      ? "bg-purple-500/30"
                                      : "bg-indigo-500/30"
                              }`;
                              target.parentElement?.appendChild(fallback);
                            }}
                          />
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleDefaultDomain(source.domain);
                          }}
                          disabled={loadingDomains}
                          className={`relative w-11 h-6 rounded-full transition-all duration-300 ${isEnabled ? "bg-brand" : "bg-muted"}`}
                        >
                          <div
                            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-black shadow-sm transition-transform duration-300 ${isEnabled ? "translate-x-5" : "translate-x-0"}`}
                          />
                        </button>
                      </div>

                      <div className='space-y-1.5'>
                        <h4 className='font-semibold text-foreground/95 tracking-tight flex items-center gap-2'>
                          {source.name}
                          {source.requiresCredentials && isEnabled && (
                            <div
                              className={`p-1 rounded-full ${sourceCredentials[source.domain] ? "bg-brand/20 text-brand" : "bg-brand/20 text-brand"} shadow-sm`}
                            >
                              {sourceCredentials[source.domain] ? (
                                <Key className='w-3 h-3' />
                              ) : (
                                <Lock className='w-3 h-3' />
                              )}
                            </div>
                          )}
                        </h4>
                        <p className='text-xs text-muted-foreground leading-relaxed max-w-[200px]'>
                          {source.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Premium Source Config Modal */}
            <Modal
              open={!!configModalSource}
              onClose={() => setConfigModalSource(null)}
              title={
                configModalSource
                  ? `${configModalSource.name} Configuration`
                  : "Configuration"
              }
            >
              {configModalSource &&
                (() => {
                  const s = configModalSource;
                  const isEnabled = enabledDefaultDomains.has(s.domain);

                  return (
                    <div className='flex flex-col gap-6 p-2'>
                      {/* Header Area */}
                      <div className='flex items-start gap-4'>
                        <div
                          className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-${s.color}-500/20 to-${s.color}-500/10 border border-${s.color}-500/30 flex items-center justify-center p-3 shrink-0 shadow-[0_0_20px_rgba(var(--${s.color}-500),0.1)]`}
                        >
                          <img
                            src={getProxiedLogoUrl(s.logo)}
                            alt={s.name}
                            className='w-full h-full object-contain filter drop-shadow-md'
                          />
                        </div>
                        <div className='flex-1 pt-1'>
                          <h3 className='text-xl font-bold tracking-tight text-white flex items-center gap-2'>
                            {s.name} Access
                            {s.requiresCredentials && (
                              <Lock className='w-4 h-4 text-brand' />
                            )}
                          </h3>
                          <p className='text-sm text-foreground/60 mt-1 leading-relaxed'>
                            Control agent access and securely manage credentials
                            for automated applications on {s.name}.
                          </p>
                        </div>
                      </div>

                      {/* Power Toggle */}
                      <div className='bg-[#16161D] border border-border/10 rounded-xl p-5 flex items-center justify-between'>
                        <div>
                          <p className='text-sm font-semibold text-white'>
                            Job Source Status
                          </p>
                          <p className='text-xs text-foreground/50 mt-0.5'>
                            Enable automated browsing on this site
                          </p>
                        </div>
                        <button
                          onClick={() => handleToggleDefaultDomain(s.domain)}
                          className={`relative w-14 h-8 rounded-full transition-all duration-300 ${isEnabled ? "bg-brand shadow-[0_0_15px_rgba(29,255,0,0.3)]" : "bg-muted/30"}`}
                        >
                          <div
                            className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-black shadow-sm transition-transform duration-300 ${isEnabled ? "translate-x-6" : "translate-x-0"}`}
                          />
                        </button>
                      </div>

                      {/* Credentials Context */}
                      {s.requiresCredentials && (
                        <div className='space-y-4'>
                          <div className='flex items-center gap-2 text-xs text-brand bg-brand/10 px-3 py-2 rounded-lg border border-brand/20'>
                            <Shield className='w-4 h-4 shrink-0' />
                            <span>
                              This platform enforces login walls. Connecting
                              credentials yields a 100% higher completion rate.
                            </span>
                          </div>

                          <div className='space-y-3 p-5 rounded-xl border border-white/5 bg-black/20'>
                            <div className='space-y-1.5'>
                              <label className='text-xs font-semibold text-foreground/70 uppercase tracking-wider ml-1'>
                                Access Email
                              </label>
                              <Input
                                value={configUsername}
                                onChange={(e) =>
                                  setConfigUsername(e.target.value)
                                }
                                placeholder='hello@jobraker.com'
                                className='bg-[#0A0A0D] border-border/30 h-11'
                              />
                            </div>
                            <div className='space-y-1.5'>
                              <label className='text-xs font-semibold text-foreground/70 uppercase tracking-wider ml-1'>
                                Access Password
                              </label>
                              <div className='relative'>
                                <Input
                                  type='password'
                                  value={configPassword}
                                  onChange={(e) =>
                                    setConfigPassword(e.target.value)
                                  }
                                  placeholder='••••••••••••'
                                  className='bg-[#0A0A0D] border-border/30 h-11 pr-10'
                                />
                                <Key className='w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40' />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className='flex items-center justify-between pt-2'>
                        <p className='text-[10px] text-foreground/40 max-w-[200px] leading-tight'>
                          Credentials are AES-GCM encrypted browser-side before
                          transit.
                        </p>
                        <Button
                          onClick={async () => {
                            if (
                              s.requiresCredentials &&
                              (configUsername || configPassword)
                            ) {
                              setConfigEncrypting(true);
                              try {
                                const enc = await encryptSymmetric(
                                  JSON.stringify({
                                    username: configUsername,
                                    password: configPassword,
                                  }),
                                );
                                setSourceCredentials((prev) => ({
                                  ...prev,
                                  [s.domain]: enc,
                                }));
                                success(
                                  "Credentials encrypted & stored locally.",
                                  "Press 'Save Configuration' to commit to database.",
                                );
                              } catch (e) {
                                toastError(
                                  "Encryption Error",
                                  "Failed to encrypt browser-side.",
                                );
                              }
                              setConfigEncrypting(false);
                            }
                            setConfigModalSource(null);
                          }}
                          disabled={configEncrypting}
                          className='bg-white text-black hover:bg-zinc-200'
                        >
                          {configEncrypting
                            ? "Encrypting..."
                            : "Confirm & Close"}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
            </Modal>

            {/* Save Button */}
            <div className='flex justify-end'>
              <Button
                onClick={handleSaveDomains}
                disabled={savingDomains || loadingDomains}
                className='bg-brand text-black hover:bg-brand/90 font-medium'
              >
                {savingDomains ? (
                  <>
                    <RefreshCw className='w-4 h-4 mr-2 animate-spin' />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className='w-4 h-4 mr-2' />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case "integrations":
        return (
          <div
            id='settings-tab-integrations'
            data-tour='settings-tab-integrations'
            className='space-y-6'
          >
            <div className='bg-card border border-border/40 rounded-xl p-6 hover:border-[#]/30 hover:bg-muted/50 transition-all shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-4'>
                  <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-[#]/20 to-[#]/10 border border-[#]/30 flex items-center justify-center'>
                    <Mail className='w-6 h-6 text-[#]' />
                  </div>
                  <div className='min-w-0'>
                    <h3 className='text-sm font-medium text-foreground/95'>
                      Gmail
                    </h3>
                    {isGmailConnected && gmailConnectedEmail ? (
                      <p
                        className='text-xs font-medium text-[#]/90 mt-0.5 truncate'
                        title={gmailConnectedEmail}
                      >
                        {gmailConnectedEmail}
                      </p>
                    ) : null}
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      Detect application confirmations, interviews, offers, and
                      rejections
                    </p>
                  </div>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-2'>
                  {isGmailConnected ? (
                    <>
                      <span
                        className='inline-flex items-center gap-2 rounded-lg border border-[#]/30 bg-[#]/10 px-3 py-2 text-sm font-medium text-[#]'
                        aria-live='polite'
                      >
                        <Link className='w-4 h-4 shrink-0' aria-hidden />
                        Connected
                      </span>
                      <Button
                        type='button'
                        variant='outline'
                        className='border-rose-500/35 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-400/50'
                        onClick={handleDisconnectGmail}
                        disabled={loadingTier || gmailDisconnecting}
                      >
                        {gmailDisconnecting ? (
                          <RefreshCw className='w-4 h-4 mr-2 animate-spin' />
                        ) : null}
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant='outline'
                      className='border-border/40 text-muted-foreground hover:text-foreground hover:bg-[#]/10 hover:border-[#]/30 transition-all'
                      onClick={handleConnectGmail}
                      disabled={loadingTier}
                    >
                      <Link className='w-4 h-4 mr-2' />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {!loadingTier && !hasGmailIntegrationAccess && (
              <UpgradePrompt
                compact
                requiredTier='Pro'
                showPricing={false}
                title='Gmail Integration'
                description='Connect Gmail, sync application emails, and keep your pipeline updated with the Pro plan.'
              />
            )}
            <div className='bg-card border border-border/40 rounded-xl p-6 hover:border-[#]/30 hover:bg-muted/50 transition-all shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-4'>
                  <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 border border-blue-500/30 flex items-center justify-center'>
                    <Linkedin className='w-6 h-6 text-blue-400' />
                  </div>
                  <div>
                    <h3 className='text-sm font-medium text-foreground/95'>
                      LinkedIn
                    </h3>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      Connect to sync your profile and apply to jobs
                    </p>
                  </div>
                </div>
                <Button
                  variant='outline'
                  className='border-border/40 text-muted-foreground hover:text-foreground hover:bg-[#]/10 hover:border-[#]/30 transition-all'
                >
                  <Link className='w-4 h-4 mr-2' />
                  Connect
                </Button>
              </div>
            </div>
            <div className='bg-card border border-border/40 rounded-xl p-6 hover:border-[#]/30 hover:bg-muted/50 transition-all shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-4'>
                  <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-700/20 to-zinc-700/10 border border-zinc-700/30 flex items-center justify-center'>
                    <Github className='w-6 h-6 text-zinc-300' />
                  </div>
                  <div>
                    <h3 className='text-sm font-medium text-foreground/95'>
                      GitHub
                    </h3>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      Connect to showcase your projects
                    </p>
                  </div>
                </div>
                <Button
                  variant='outline'
                  className='border-border/40 text-muted-foreground hover:text-foreground hover:bg-[#]/10 hover:border-[#]/30 transition-all'
                >
                  <Link className='w-4 h-4 mr-2' />
                  Connect
                </Button>
              </div>
            </div>
          </div>
        );

      case "billing":
        return (
          <div
            id='settings-tab-billing'
            data-tour='settings-tab-billing'
            className='space-y-6'
          >
            {/* Current Stats */}
            <div className='grid gap-4 md:grid-cols-3'>
              {/* Credits Balance */}
              <div className='bg-card border border-border/40 rounded-xl p-6 hover:border-[#]/30 hover:bg-muted/50 transition-all shadow-sm ring-1 ring-foreground/5'>
                <div className='flex items-start justify-between mb-4'>
                  <div className='p-3 rounded-xl bg-[#]/10 border border-[#]/20'>
                    <Sparkles className='w-5 h-5 text-[#]' />
                  </div>
                  <span className='text-xs font-semibold text-[#] bg-[#]/10 px-2 py-1 rounded-full'>
                    BALANCE
                  </span>
                </div>
                <div className='space-y-1'>
                  <p className='text-xs text-muted-foreground uppercase tracking-wider'>
                    Current Credits
                  </p>
                  <p className='text-3xl font-bold text-foreground'>
                    {currentCredits.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Active Plan */}
              <div className='bg-card border border-border/40 rounded-xl p-6 hover:border-[#]/30 hover:bg-muted/50 transition-all shadow-sm ring-1 ring-foreground/5'>
                <div className='flex items-start justify-between mb-4'>
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-br ${getTierGradient(billingSubscriptionTier)}/10 border border-border/40`}
                  >
                    {getTierIcon(billingSubscriptionTier)}
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      billingSubscriptionTier === "Pro"
                        ? "bg-blue-500/20 text-blue-400"
                        : billingSubscriptionTier === "Basics"
                          ? "bg-[#]/20 text-brand"
                          : billingSubscriptionTier === "Ultimate"
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-[#]/20 text-brand"
                    }`}
                  >
                    {billingSubscriptionTier.toUpperCase()}
                  </span>
                </div>
                <div className='space-y-1'>
                  <p className='text-xs text-muted-foreground uppercase tracking-wider'>
                    Active Plan
                  </p>
                  <p className='text-3xl font-bold text-foreground'>
                    {billingSubscriptionTier}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {subscriptionPlans
                      .find((p) => p.name === billingSubscriptionTier)
                      ?.credits_per_month?.toLocaleString() || 0}{" "}
                    credits/month
                  </p>
                </div>
              </div>

              {/* Next Refill */}
              <div className='bg-card border border-border/40 rounded-xl p-6 hover:border-[#]/30 hover:bg-muted/50 transition-all shadow-sm ring-1 ring-foreground/5'>
                <div className='flex items-start justify-between mb-4'>
                  <div className='p-3 rounded-xl bg-blue-500/10 border border-blue-500/20'>
                    <CreditCard className='w-5 h-5 text-blue-400' />
                  </div>
                  <span className='text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full'>
                    REFILL
                  </span>
                </div>
                <div className='space-y-1'>
                  <p className='text-xs text-muted-foreground uppercase tracking-wider'>
                    Next payment
                  </p>
                  <p className='text-sm font-semibold text-foreground'>
                    {currentPeriodEnd
                      ? new Date(currentPeriodEnd).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Not scheduled"}
                  </p>
                  <p className='text-[11px] text-muted-foreground leading-snug'>
                    Subscription billing date from your plan (monthly or
                    annual), not each credit top-up.
                  </p>
                </div>
              </div>
            </div>

            {/* Available Plans */}
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex items-center justify-between mb-6'>
                <div>
                  <h3 className='text-base font-medium text-foreground/95'>
                    Subscription Plans
                  </h3>
                  <p className='text-sm text-muted-foreground mt-0.5'>
                    Choose the plan that fits your needs
                  </p>
                </div>
                <Button
                  className='bg-[#] text-black hover:bg-[#]/90 font-medium transition-all'
                  onClick={() => {
                    window.location.href = "/dashboard/billing";
                  }}
                >
                  View All Plans
                  <ArrowRight className='w-4 h-4 ml-2' />
                </Button>
              </div>

              <div className='grid gap-4 md:grid-cols-3 lg:grid-cols-4'>
                {subscriptionPlans.slice(0, 4).map((plan) => {
                  const isCurrentPlan = plan.name === billingSubscriptionTier;

                  return (
                    <div
                      key={plan.id}
                      className={`group relative p-5 rounded-xl border transition-all hover:shadow-lg hover:shadow-[#]/5 hover:-translate-y-0.5 ${
                        isCurrentPlan
                          ? "border-[#]/40 bg-[#]/5 shadow-[0_0_20px_rgba(29,255,0,0.1)]"
                          : "border-border/40 bg-background/50 hover:border-[#]/30 hover:bg-muted/50"
                      }`}
                    >
                      {/* Header */}
                      <div className='flex items-start justify-between mb-4'>
                        <div className='flex items-center gap-2.5'>
                          <div className='w-10 h-10 rounded-lg bg-muted/50 border border-border/40 flex items-center justify-center text-foreground'>
                            {getTierIcon(plan.name)}
                          </div>
                          <div>
                            <h4 className='text-base font-bold text-foreground'>
                              {plan.name}
                            </h4>
                            <p className='text-xs text-muted-foreground'>
                              monthly
                            </p>
                          </div>
                        </div>
                        {isCurrentPlan && (
                          <span className='px-1.5 py-0.5 text-xs font-medium bg-[#] text-black border border-[#] rounded-md flex items-center gap-1'>
                            <Check className='w-2.5 h-2.5' />
                            ACTIVE
                          </span>
                        )}
                      </div>

                      {/* Price */}
                      <div className='mb-3'>
                        <div className='flex items-baseline gap-1'>
                          <span className='text-3xl font-bold text-foreground'>
                            ${plan.price}
                          </span>
                          {plan.price > 0 && (
                            <span className='text-sm text-muted-foreground'>
                              /mo
                            </span>
                          )}
                        </div>
                        <p className='text-xs text-muted-foreground mt-1 line-clamp-2'>
                          {plan.description}
                        </p>
                      </div>

                      {/* Credits */}
                      <div className='flex items-center gap-2 p-2.5 bg-background border border-border/40 rounded-lg mb-3'>
                        <Zap className='w-3.5 h-3.5 text-[#]' />
                        <span className='text-xs text-foreground font-medium'>
                          {plan.credits_per_month} credits
                        </span>
                        <span className='text-xs text-muted-foreground'>
                          per cycle
                        </span>
                      </div>

                      {/* Features */}
                      <div className='space-y-1.5 mb-4'>
                        {plan.features &&
                          Array.isArray(plan.features) &&
                          plan.features
                            .slice(0, 3)
                            .map((feature: any, idx: number) => {
                              const featureName =
                                typeof feature === "string"
                                  ? feature
                                  : feature.name;
                              const isIncluded =
                                typeof feature === "object"
                                  ? feature.included !== false
                                  : true;

                              if (!isIncluded) return null;

                              return (
                                <div
                                  key={idx}
                                  className='flex items-start gap-2'
                                >
                                  <Check className='w-3.5 h-3.5 text-[#] mt-0.5 flex-shrink-0' />
                                  <span className='text-xs text-muted-foreground line-clamp-1'>
                                    {featureName}
                                  </span>
                                </div>
                              );
                            })}
                        {(plan.features?.length || 0) > 3 && (
                          <p className='text-xs text-muted-foreground pl-5'>
                            +{plan.features.length - 3} more
                          </p>
                        )}
                      </div>

                      {/* CTA */}
                      {!isCurrentPlan && (
                        <Button
                          className={`w-full h-9 font-medium text-xs transition-all ${
                            plan.name === "Pro"
                              ? "bg-blue-600 hover:bg-blue-700 text-foreground hover:scale-105"
                              : plan.name === "Ultimate"
                                ? "bg-purple-600 hover:bg-purple-700 text-foreground hover:scale-105"
                                : "bg-[#] text-black hover:bg-[#]/90 hover:scale-105"
                          }`}
                          onClick={() => {
                            window.location.href = "/dashboard/billing";
                          }}
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
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <h3 className='text-base font-medium text-foreground mb-4'>
                Quick Actions
              </h3>
              <div className='grid gap-3 sm:grid-cols-2'>
                <Button
                  variant='outline'
                  className='justify-start border-border/40 text-muted-foreground hover:text-foreground hover:bg-[#]/10 hover:border-[#]/30 transition-all h-auto py-3'
                  onClick={() => {
                    window.location.href = "/dashboard/billing";
                  }}
                >
                  <CreditCard className='w-4 h-4 mr-3' />
                  <div className='text-left'>
                    <div className='text-sm font-medium'>Purchase Credits</div>
                    <div className='text-xs text-muted-foreground'>
                      Buy one-time credit packs
                    </div>
                  </div>
                </Button>
                <Button
                  variant='outline'
                  className='justify-start border-border/40 text-muted-foreground hover:text-foreground hover:bg-[#]/10 hover:border-[#]/30 transition-all h-auto py-3'
                  onClick={() => {
                    window.location.href = "/dashboard/billing";
                  }}
                >
                  <Download className='w-4 h-4 mr-3' />
                  <div className='text-left'>
                    <div className='text-sm font-medium'>View History</div>
                    <div className='text-xs text-muted-foreground'>
                      See all transactions
                    </div>
                  </div>
                </Button>
              </div>
            </div>
          </div>
        );

      case "guided-tours":
        return (
          <div className='space-y-6'>
            <div className='bg-card border border-border/40 rounded-xl p-6 shadow-sm ring-1 ring-foreground/5'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                  <h3 className='text-base font-medium text-foreground/95'>
                    Guided Tours
                  </h3>
                  <p className='text-sm text-muted-foreground mt-0.5 max-w-2xl'>
                    Restart any product walkthrough from Settings instead of
                    using the floating launcher. Tours resume from saved progress
                    when available.
                  </p>
                </div>
                <div className='inline-flex items-center gap-2 rounded-lg border border-brand/20 bg-brand/10 px-3 py-2 text-sm font-medium text-brand'>
                  <Sparkles className='w-4 h-4' />
                  Admin tools
                </div>
              </div>
            </div>

            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
              {guidedTourPages.map((tourPageId) => {
                const isCompleted =
                  (profile as any)?.[`walkthrough_${tourPageId}`] === true;
                const isActiveTour =
                  isRunning && runningTourPage === tourPageId;
                return (
                  <div
                    key={tourPageId}
                    className={`rounded-xl border p-5 shadow-sm ring-1 transition-all ${
                      isActiveTour
                        ? "border-brand/40 bg-brand/5 ring-brand/20"
                        : "border-border/40 bg-card ring-foreground/5"
                    }`}
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <h4 className='text-base font-semibold text-foreground'>
                          {TOUR_PAGE_LABELS[tourPageId] || tourPageId}
                        </h4>
                        <p className='mt-1 text-sm text-muted-foreground'>
                          {isCompleted
                            ? "Completed before. You can restart it anytime."
                            : "Not completed yet."}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          isActiveTour
                            ? "bg-brand text-background"
                            : isCompleted
                              ? "bg-blue-500/15 text-blue-400"
                              : "bg-foreground/5 text-muted-foreground"
                        }`}
                      >
                        {isActiveTour
                          ? "Running"
                          : isCompleted
                            ? "Done"
                            : "Ready"}
                      </span>
                    </div>

                    <div className='mt-5 flex items-center justify-between gap-3'>
                      <span className='text-xs uppercase tracking-[0.18em] text-muted-foreground'>
                        {tourPageId}
                      </span>
                      <Button
                        variant={isActiveTour ? "outline" : "default"}
                        className={
                          isActiveTour
                            ? "border-brand/30 text-brand hover:bg-brand/10"
                            : "bg-brand text-background hover:bg-brand/90"
                        }
                        onClick={() => startTour(tourPageId)}
                      >
                        {isActiveTour ? "Restart Tour" : "Start Tour"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {guidedTourPages.length === 0 ? (
              <div className='rounded-xl border border-border/40 bg-card p-6 text-sm text-muted-foreground shadow-sm ring-1 ring-foreground/5'>
                No tours are registered yet on this build.
              </div>
            ) : null}
          </div>
        );

      case "answer-bank":
        return <AnswerBankPanel />;

      case "support":
        return (
          <div
            id='settings-tab-support'
            data-tour='settings-tab-support'
            className='space-y-6'
          >
            <div className='bg-card border border-border/40 rounded-xl p-4 sm:p-6 shadow-sm ring-1 ring-foreground/5'>
              <h3 className='text-base font-medium text-foreground mb-4'>
                AI & App Support
              </h3>
              <SupportFloatingWidget
                currentPageId="settings"
                currentPageLabel="Settings"
                inline={true}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className='min-h-full bg-background'>
        <div className='w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 py-6'>
          {/* Modern Header */}
          <div className='mb-8 border-b border-foreground/10 pb-6'>
            <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
              <div>
                <h1 className='text-3xl font-medium tracking-tight text-foreground/95 mb-1'>
                  Settings
                </h1>
                <p className='text-sm text-foreground/50'>
                  Manage your account preferences and configurations
                </p>
              </div>
              <div className='flex w-full flex-row gap-3 sm:w-auto items-center'>
                <Button
                  variant='outline'
                  onClick={handleResetForm}
                  className='flex-1 border-foreground/[0.08] text-foreground/70 hover:text-foreground/90 hover:bg-foreground/5 hover:border-foreground/[0.12] transition-all sm:w-auto'
                >
                  <RefreshCw className='w-4 h-4 mr-2' />
                  Reset
                </Button>
                <Button
                  variant='outline'
                  onClick={handleExportData}
                  className='flex-1 border-foreground/[0.08] text-foreground/70 hover:text-foreground/90 hover:bg-foreground/5 hover:border-foreground/[0.12] transition-all sm:w-auto'
                >
                  <Download className='w-4 h-4 mr-2' />
                  Export Data
                </Button>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-5 gap-8'>
            {/* Minimal Sidebar Navigation */}
            <div
              className='lg:col-span-1 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 gap-1 lg:gap-1 no-scrollbar whitespace-nowrap scrollbar-none'
              id='settings-tablist'
              data-tour='settings-tabs'
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    navigate(`/dashboard/settings/${tab.id}`);
                    try {
                      window.dispatchEvent(
                        new CustomEvent("tour:event", {
                          detail: { type: "settings_tab_switch", tab: tab.id },
                        }),
                      );
                    } catch {}
                  }}
                  id={`settings-tab-btn-${tab.id}`}
                  data-tour={`settings-tab-btn-${tab.id}`}
                  className={`w-auto lg:w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg text-xs lg:text-sm transition-all shrink-0 ${
                    activeTab === tab.id
                      ? "text-foreground/95 bg-gradient-to-r from-foreground/[0.08] to-transparent border-b-2 border-l-0 border-t-0 border-r-0 lg:border-l-2 lg:border-b-0 lg:border-t-0 lg:border-r-0 border-brand"
                      : "text-foreground/70 hover:text-foreground/80 hover:bg-foreground/5 border-b-2 border-l-0 border-t-0 border-r-0 lg:border-l-2 lg:border-b-0 lg:border-t-0 lg:border-r-0 border-transparent"
                  }`}
                >
                  <span
                    className={
                      activeTab === tab.id ? "text-brand" : "text-foreground/40"
                    }
                  >
                    {tab.icon}
                  </span>
                  <span className='font-medium'>{tab.label}</span>
                </button>
              ))}

              <div className='pt-0 lg:pt-4 mt-0 lg:mt-4 border-t-0 lg:border-t border-foreground/10 shrink-0'>
                <button
                  onClick={() => setSignOutDialogOpen(true)}
                  className='w-auto lg:w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg text-xs lg:text-sm text-red-500 transition-all border-l-2 lg:border-l-2 border-b-2 lg:border-b-0 border-transparent shrink-0'
                >
                  <LogOut className='w-4 h-4' />
                  <span className='font-medium'>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className='lg:col-span-4 min-w-0'>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  id='settings-profile-form'
                  data-tour='settings-profile-form'
                >
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
        title='Your Backup Codes'
        size='lg'
        side='center'
      >
        {generatedBackupCodes && generatedBackupCodes.length > 0 ? (
          <div className='space-y-4'>
            <div className='bg-[#]/10 border border-[#]/20 rounded-lg p-4'>
              <p className='text-sm text-[#] font-medium mb-2'>
                ⚠️ Important: Save these codes now
              </p>
              <p className='text-xs text-[#]/80'>
                These codes are shown only once. Store them in a safe place.
                Each code can only be used once. A file has been automatically
                downloaded to your device.
              </p>
            </div>
            <div className='bg-foreground/[0.05] border border-foreground/[0.1] rounded-lg p-4'>
              <div className='grid grid-cols-2 gap-3'>
                {generatedBackupCodes.map((code, index) => (
                  <div
                    key={index}
                    className='flex items-center justify-between p-2 bg-muted/50 border border-foreground/[0.1] rounded font-mono text-sm text-foreground/90'
                  >
                    <span>{code}</span>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => {
                        navigator.clipboard.writeText(code);
                        success(`Code ${index + 1} copied`);
                      }}
                      className='h-6 w-6 p-0 text-foreground/50 hover:text-foreground hover:bg-foreground/[0.1]'
                    >
                      <Download className='w-3 h-3' />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className='flex gap-3'>
              <Button
                onClick={() => {
                  const allCodes = generatedBackupCodes.join("\n");
                  navigator.clipboard.writeText(allCodes);
                  success("All codes copied to clipboard");
                }}
                className='flex-1 bg-[#] text-black hover:bg-[#]/90'
              >
                Copy All Codes
              </Button>
              <Button
                variant='outline'
                onClick={() => {
                  setShowBackupCodesModal(false);
                  setGeneratedBackupCodes(null);
                }}
                className='border-foreground/[0.1] text-foreground/70 hover:bg-foreground/[0.05]'
              >
                I've Saved Them
              </Button>
            </div>
          </div>
        ) : (
          <div className='text-center py-8'>
            <p className='text-foreground/70'>No codes to display</p>
          </div>
        )}
      </Modal>
      {/* Data Deletion Request Modal */}
      <Modal
        open={showDeletionRequestModal}
        onClose={() => {
          setShowDeletionRequestModal(false);
          setDeletionRequestType("partial_deletion");
          setDeletionRequestReason("");
          setSelectedDataTypes([]);
        }}
        title='Request Data Deletion'
        size='lg'
        side='center'
      >
        <div className='space-y-4'>
          <div className='bg-[#]/10 border border-[#]/20 rounded-lg p-4'>
            <p className='text-sm text-[#] font-medium mb-2'>
              ⚠️ Important Information
            </p>
            <p className='text-xs text-[#]/80'>
              Data deletion requests are processed within 30 days. Once deleted,
              data cannot be recovered. You can cancel a pending request at any
              time before processing begins.
            </p>
          </div>
          <div>
            <label className='block text-sm font-medium text-foreground/90 mb-2'>
              Deletion Type
            </label>
            <div className='space-y-2'>
              {[
                {
                  value: "partial_deletion",
                  label: "Partial Deletion",
                  desc: "Delete specific data types only",
                },
                {
                  value: "anonymization",
                  label: "Anonymization",
                  desc: "Remove personally identifiable information",
                },
                {
                  value: "full_deletion",
                  label: "Full Account Deletion",
                  desc: "Delete all data and close account",
                },
              ].map((type) => (
                <label
                  key={type.value}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                    deletionRequestType === type.value
                      ? "bg-[#]/5 border-[#]/30 shadow-[0_0_15px_rgba(29,255,0,0.05)]"
                      : "bg-card border-border/40 hover:bg-muted/50 hover:border-border/60"
                  }`}
                >
                  <input
                    type='radio'
                    name='deletionType'
                    value={type.value}
                    checked={deletionRequestType === type.value}
                    onChange={(e) =>
                      setDeletionRequestType(e.target.value as any)
                    }
                    className='mt-1 accent-[#]'
                  />
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-foreground/90'>
                      {type.label}
                    </p>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      {type.desc}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          {deletionRequestType === "partial_deletion" && (
            <div>
              <label className='block text-sm font-medium text-foreground/90 mb-2'>
                Select Data Types to Delete
              </label>
              <div className='space-y-2'>
                {[
                  "profile",
                  "applications",
                  "resumes",
                  "notifications",
                  "jobs",
                  "bookmarks",
                  "cover_letters",
                ].map((type) => (
                  <label
                    key={type}
                    className='flex items-center gap-3 p-2 bg-card border border-border/40 rounded-lg cursor-pointer hover:bg-muted/50 hover:border-border/60 transition-colors'
                  >
                    <input
                      type='checkbox'
                      checked={selectedDataTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDataTypes([...selectedDataTypes, type]);
                        } else {
                          setSelectedDataTypes(
                            selectedDataTypes.filter((t) => t !== type),
                          );
                        }
                      }}
                      className='accent-[#]'
                    />
                    <span className='text-sm text-foreground/90 capitalize'>
                      {type.replace(/_/g, " ")}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className='block text-sm font-medium text-foreground/90 mb-2'>
              Reason (Optional)
            </label>
            <textarea
              value={deletionRequestReason}
              onChange={(e) => setDeletionRequestReason(e.target.value)}
              placeholder="Tell us why you're requesting data deletion..."
              className='w-full p-3 bg-card border border-border/40 rounded-lg text-foreground focus:border-[#]/50 focus:ring-1 focus:ring-[#]/50 outline-none transition-all placeholder:text-muted-foreground text-sm resize-none'
              rows={3}
            />
          </div>
          <div className='flex gap-3'>
            <Button
              onClick={async () => {
                try {
                  if (
                    deletionRequestType === "partial_deletion" &&
                    selectedDataTypes.length === 0
                  ) {
                    toastError(
                      "Validation Error",
                      "Please select at least one data type for partial deletion",
                    );
                    return;
                  }
                  await createDeletionRequest(
                    deletionRequestType,
                    deletionRequestType === "partial_deletion"
                      ? selectedDataTypes
                      : undefined,
                    deletionRequestReason || undefined,
                  );
                  success("Deletion request submitted");
                  setShowDeletionRequestModal(false);
                  setDeletionRequestType("partial_deletion");
                  setDeletionRequestReason("");
                  setSelectedDataTypes([]);
                } catch (e: any) {
                  toastError("Failed to submit request", e.message);
                }
              }}
              className='flex-1 bg-[#]/100 text-foreground hover:bg-[#]'
            >
              Submit Request
            </Button>
            <Button
              variant='outline'
              onClick={() => {
                setShowDeletionRequestModal(false);
                setDeletionRequestType("partial_deletion");
                setDeletionRequestReason("");
                setSelectedDataTypes([]);
              }}
              className='border-foreground/[0.1] text-foreground/70 hover:bg-foreground/[0.05]'
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
        title='Delete Account Permanently'
        size='lg'
        side='center'
      >
        <div className='space-y-4'>
          <div className='bg-[#]/10 border border-[#]/30 rounded-lg p-4'>
            <div className='flex items-start gap-3'>
              <AlertTriangle className='w-5 h-5 text-[#] mt-0.5 flex-shrink-0' />
              <div className='flex-1'>
                <p className='text-sm font-medium text-[#] mb-2'>
                  ⚠️ This action cannot be undone
                </p>
                <p className='text-xs text-[#]/80 leading-relaxed'>
                  Deleting your account will permanently remove all your data
                  including:
                </p>
                <ul className='text-xs text-[#]/80 mt-2 space-y-1 list-disc list-inside'>
                  <li>Your profile and personal information</li>
                  <li>All job applications and saved jobs</li>
                  <li>Resumes, cover letters, and documents</li>
                  <li>Notification and privacy settings</li>
                  <li>Security settings and backup codes</li>
                  <li>Credit balance and transaction history</li>
                  <li>All other account-related data</li>
                </ul>
                <p className='text-xs text-[#]/80 mt-3 font-medium'>
                  This process is irreversible. Please ensure you have exported
                  any data you wish to keep.
                </p>
              </div>
            </div>
          </div>

          <div className='bg-[#]/10 border border-[#]/20 rounded-lg p-4'>
            <p className='text-sm text-[#] font-medium mb-2'>
              🔒 Security Confirmation Required
            </p>
            <p className='text-xs text-[#]/80'>
              To confirm account deletion, please type your email address below:
            </p>
            <p className='text-xs text-[#]/60 mt-1 font-mono'>{userEmail}</p>
          </div>

          <div>
            <label className='block text-sm font-medium text-foreground/90 mb-2'>
              Type your email to confirm deletion
            </label>
            <Input
              type='email'
              value={accountDeletionEmail}
              onChange={(e) => setAccountDeletionEmail(e.target.value)}
              placeholder={userEmail || "your@email.com"}
              disabled={isDeleting}
              className='bg-card border-border/40 text-foreground placeholder:text-muted-foreground focus:border-[#]/50 focus:ring-[#]/50'
              autoComplete='off'
            />
            {accountDeletionEmail &&
              accountDeletionEmail.toLowerCase().trim() !==
                userEmail.toLowerCase().trim() && (
                <p className='text-xs text-[#] mt-1 flex items-center gap-1'>
                  <X className='w-3 h-3' />
                  Email does not match
                </p>
              )}
          </div>

          <div className='flex items-start gap-2 p-3 bg-card border border-border/40 rounded-lg ring-1 ring-white/5 shadow-sm'>
            <input
              type='checkbox'
              id='confirm-deletion'
              className='mt-1 accent-[#]'
              disabled={isDeleting}
            />
            <label
              htmlFor='confirm-deletion'
              className='text-xs text-muted-foreground cursor-pointer tracking-tight'
            >
              I understand that this action is permanent and cannot be undone. I
              have exported any data I wish to keep.
            </label>
          </div>

          <div className='flex gap-3 pt-2'>
            <Button
              onClick={async () => {
                const emailInput = accountDeletionEmail.toLowerCase().trim();
                const userEmailLower = userEmail.toLowerCase().trim();

                if (!emailInput) {
                  toastError(
                    "Validation Error",
                    "Please enter your email address",
                  );
                  return;
                }

                if (emailInput !== userEmailLower) {
                  toastError(
                    "Validation Error",
                    "Email address does not match",
                  );
                  return;
                }

                const checkbox = document.getElementById(
                  "confirm-deletion",
                ) as HTMLInputElement;
                if (!checkbox?.checked) {
                  toastError(
                    "Validation Error",
                    "Please confirm that you understand this action is permanent",
                  );
                  return;
                }

                setIsDeleting(true);
                try {
                  const { data } = await supabase.auth.getUser();
                  const uid = (data as any)?.user?.id;

                  if (!uid) {
                    throw new Error("User not found");
                  }

                  // Log the deletion request with security audit
                  await logPrivacyAction("account_deletion_confirmed", {
                    email_confirmed: true,
                    deletion_method: "user_initiated",
                  });

                  // Create a deletion request record
                  try {
                    await createDeletionRequest(
                      "full_deletion",
                      undefined,
                      "User-initiated account deletion",
                    );
                  } catch (e) {
                    console.warn(
                      "Failed to create deletion request record:",
                      e,
                    );
                  }

                  // Delete all user data (RLS policies will ensure user can only delete their own data)
                  const deletePromises = [
                    (supabase as any).from("profiles").delete().eq("id", uid),
                    (supabase as any)
                      .from("notification_settings")
                      .delete()
                      .eq("id", uid),
                    (supabase as any)
                      .from("security_settings")
                      .delete()
                      .eq("id", uid),
                    (supabase as any)
                      .from("security_backup_codes")
                      .delete()
                      .eq("user_id", uid),
                    (supabase as any)
                      .from("security_trusted_devices")
                      .delete()
                      .eq("user_id", uid),
                    (supabase as any)
                      .from("security_active_sessions")
                      .delete()
                      .eq("user_id", uid),
                    (supabase as any)
                      .from("security_api_keys")
                      .delete()
                      .eq("user_id", uid),
                    (supabase as any)
                      .from("privacy_settings")
                      .delete()
                      .eq("id", uid),
                    (supabase as any)
                      .from("privacy_audit_log")
                      .delete()
                      .eq("user_id", uid),
                    (supabase as any)
                      .from("privacy_data_deletion_requests")
                      .delete()
                      .eq("user_id", uid),
                    (supabase as any)
                      .from("applications")
                      .delete()
                      .eq("user_id", uid),
                    (supabase as any).from("jobs").delete().eq("user_id", uid),
                    (supabase as any)
                      .from("bookmarks")
                      .delete()
                      .eq("user_id", uid),
                    (supabase as any)
                      .from("notifications")
                      .delete()
                      .eq("user_id", uid),
                    (supabase as any)
                      .from("resumes")
                      .delete()
                      .eq("user_id", uid),
                    (supabase as any)
                      .from("cover_letters")
                      .delete()
                      .eq("user_id", uid),
                    (supabase as any)
                      .from("credit_transactions")
                      .delete()
                      .eq("user_id", uid),
                    (supabase as any)
                      .from("user_credits")
                      .delete()
                      .eq("user_id", uid),
                    (supabase as any)
                      .from("user_subscriptions")
                      .delete()
                      .eq("user_id", uid),
                  ];

                  await Promise.all(deletePromises);

                  // Sign out and redirect
                  await supabase.auth.signOut();
                  success("Account deleted successfully");

                  // Small delay before redirect to show success message
                  setTimeout(() => {
                    window.location.href = "/";
                  }, 1000);
                } catch (e: any) {
                  setIsDeleting(false);
                  toastError(
                    "Deletion failed",
                    e.message ||
                      "An error occurred while deleting your account. Please try again or contact support.",
                  );
                }
              }}
              disabled={
                isDeleting ||
                accountDeletionEmail.toLowerCase().trim() !==
                  userEmail.toLowerCase().trim()
              }
              className='flex-1 bg-[#] text-foreground hover:bg-[#] disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isDeleting ? (
                <>
                  <RefreshCw className='w-4 h-4 mr-2 animate-spin' />
                  Deleting Account...
                </>
              ) : (
                <>
                  <Trash2 className='w-4 h-4 mr-2' />
                  Delete My Account
                </>
              )}
            </Button>
            <Button
              variant='outline'
              onClick={() => {
                setShowAccountDeletionModal(false);
                setAccountDeletionEmail("");
              }}
              disabled={isDeleting}
              className='border-foreground/[0.1] text-foreground/70 hover:bg-foreground/[0.05] disabled:opacity-50'
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
        size='md'
        side='center'
      >
        {createdApiKey ? (
          <div className='space-y-4'>
            <div className='bg-[#]/10 border border-[#]/20 rounded-lg p-4'>
              <p className='text-sm text-[#] font-medium mb-2'>
                ⚠️ Important: Save this key now
              </p>
              <p className='text-xs text-[#]/80'>
                You won't be able to see this key again. Copy it to a secure
                location.
              </p>
            </div>
            <div className='bg-card border border-border/40 rounded-lg p-4 shadow-sm ring-1 ring-white/5'>
              <p className='text-xs text-muted-foreground mb-2'>
                Your API Key:
              </p>
              <div className='flex items-center gap-2'>
                <code className='flex-1 bg-background/50 border border-border/40 rounded px-3 py-2 text-sm text-foreground/90 font-mono break-all'>
                  {createdApiKey}
                </code>
                <Button
                  size='sm'
                  onClick={() => {
                    navigator.clipboard.writeText(createdApiKey);
                    success("API key copied to clipboard");
                  }}
                  className='bg-[#] text-black hover:bg-[#]/90 font-medium'
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
              className='w-full bg-[#] text-black hover:bg-[#]/90 font-medium hover:scale-105 transition-all'
            >
              Done
            </Button>
          </div>
        ) : (
          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-foreground/90 mb-2'>
                Key Name
              </label>
              <Input
                type='text'
                placeholder='e.g., Production API, Development'
                value={newApiKeyName}
                onChange={(e) => setNewApiKeyName(e.target.value)}
                className='bg-card border-border/40 text-foreground focus:border-[#]/50 focus:ring-[#]/50'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-foreground/90 mb-2'>
                Expires In (days, optional)
              </label>
              <Input
                type='number'
                placeholder='Leave empty for no expiration'
                value={newApiKeyExpiry || ""}
                onChange={(e) =>
                  setNewApiKeyExpiry(
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                className='bg-card border-border/40 text-foreground focus:border-[#]/50 focus:ring-[#]/50'
                min='1'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-foreground/90 mb-2'>
                IP Restrictions (comma-separated, optional)
              </label>
              <Input
                type='text'
                placeholder='e.g., 192.168.1.1, 10.0.0.1'
                value={newApiKeyIpRestrictions}
                onChange={(e) => setNewApiKeyIpRestrictions(e.target.value)}
                className='bg-card border-border/40 text-foreground focus:border-[#]/50 focus:ring-[#]/50'
              />
              <p className='text-xs text-muted-foreground mt-1'>
                Leave empty to allow from any IP
              </p>
            </div>
            <div className='flex gap-3'>
              <Button
                onClick={async () => {
                  if (!newApiKeyName.trim()) {
                    toastError("Validation Error", "Key name is required");
                    return;
                  }
                  try {
                    const ipRestrictions = newApiKeyIpRestrictions
                      .split(",")
                      .map((ip) => ip.trim())
                      .filter((ip) => ip.length > 0);
                    const result = await createApiKey(
                      newApiKeyName,
                      newApiKeyExpiry,
                      ipRestrictions.length > 0 ? ipRestrictions : undefined,
                    );
                    if (result && result.key) {
                      setCreatedApiKey(result.key);
                    }
                  } catch (e: any) {
                    toastError("Failed to create API key", e.message);
                  }
                }}
                disabled={!newApiKeyName.trim()}
                className='flex-1 bg-[#] text-black hover:bg-[#]/90 font-medium disabled:opacity-50 disabled:hover:scale-100 transition-all hover:scale-105'
              >
                Create Key
              </Button>
              <Button
                variant='outline'
                onClick={() => {
                  setApiKeyModalOpen(false);
                  setNewApiKeyName("");
                  setNewApiKeyExpiry(undefined);
                  setNewApiKeyIpRestrictions("");
                }}
                className='border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* Sign Out Dialog */}
      <SignOutDialog
        open={signOutDialogOpen}
        onConfirm={async () => {
          setIsSigningOut(true);
          try {
            await supabase.auth.signOut();
            window.location.href = "/signin";
          } catch (error) {
            console.error("Sign out error:", error);
            setIsSigningOut(false);
          }
        }}
        onCancel={() => {
          setSignOutDialogOpen(false);
          setIsSigningOut(false);
        }}
        isLoading={isSigningOut}
      />
    </>
  );

  // 2FA Setup Modal
  function TwoFAModal() {
    return (
      <Modal
        open={open2FA}
        onClose={() => setOpen2FA(false)}
        title='Set up Two-Factor Authentication'
        size='md'
        side='center'
      >
        <div className='space-y-4'>
          <p className='text-muted-foreground text-sm'>
            Scan the QR code in your authenticator app (e.g., Google
            Authenticator, Authy), then enter the 6-digit code below.
          </p>
          {qrDataUrl ? (
            <div className='flex justify-center'>
              <img
                src={qrDataUrl}
                alt='TOTP QR'
                className='rounded border border-primary/30'
              />
            </div>
          ) : (
            <div className='text-muted-foreground text-sm'>Generating QR…</div>
          )}
          <div>
            <label className='block text-sm font-medium text-muted-foreground mb-1'>
              Authentication code
            </label>
            <Input
              inputMode='numeric'
              pattern='[0-9]*'
              placeholder='123456'
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className='bg-card border-border/40 text-foreground focus:border-[#]/50 hover:border-border/60 transition-all duration-300'
            />
          </div>
          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              className='border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
                  toastError("Verification failed", e.message);
                } finally {
                  setVerifyBusy(false);
                }
              }}
              className='bg-[#] text-black font-medium hover:bg-[#]/90 transition-all hover:scale-105'
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

// Unused function - kept for potential future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/naming-convention
// @ts-expect-error - Intentionally unused, kept for potential future use
function _DefaultsForm() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [includeLinkedIn, setIncludeLinkedIn] = useState(true);
  const [includeIndeed, setIncludeIndeed] = useState(true);
  const [includeSearch, setIncludeSearch] = useState(true);
  const [allowedDomains, setAllowedDomains] = useState<string>("");
  const [enabledSources, setEnabledSources] = useState<string[]>([
    "deepresearch",
    "remotive",
    "remoteok",
    "arbeitnow",
  ]);
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
        if (!uid) {
          setLoading(false);
          return;
        }
        const { data } = await (supabase as any)
          .from("job_source_settings")
          .select(
            "include_linkedin, include_indeed, include_search, allowed_domains, enabled_sources, cron_enabled",
          )
          .eq("id", uid)
          .maybeSingle();
        if (data) {
          if (data.include_linkedin != null)
            setIncludeLinkedIn(!!data.include_linkedin);
          if (data.include_indeed != null)
            setIncludeIndeed(!!data.include_indeed);
          if (data.include_search != null)
            setIncludeSearch(!!data.include_search);
          if (Array.isArray(data.allowed_domains))
            setAllowedDomains(data.allowed_domains.join(","));
          if (Array.isArray(data.enabled_sources))
            setEnabledSources(data.enabled_sources);
          if (typeof (data as any).cron_enabled === "boolean")
            setCronEnabled(!!(data as any).cron_enabled);
        }
      } catch (e: any) {
        console.warn(e);
      }
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
      if (!uid) {
        setSaving(false);
        return;
      }
      const payload = {
        id: uid,
        include_linkedin: includeLinkedIn,
        include_indeed: includeIndeed,
        include_search: includeSearch,
        allowed_domains: allowedDomains
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        enabled_sources: enabledSources,
        cron_enabled: cronEnabled,
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any)
        .from("job_source_settings")
        .upsert(payload, { onConflict: "id" });
      if (error) throw error;
      success("Saved");
    } catch (e: any) {
      toastError("Save failed", e.message);
    }
    setSaving(false);
  };

  const runNow = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = (auth as any)?.user?.id;
      if (!uid) return;
      const { data, error } = await (supabase as any).functions.invoke(
        "jobs-cron",
        { body: { user_id: uid, manual_trigger: true } },
      );
      if (error) throw error;
      success("Job fetch started");
      console.log("jobs-cron result", data);
    } catch (e: any) {
      toastError("Trigger failed", e.message);
    }
  };

  const testSearch = async () => {
    setTesting(true);
    setTestNote(null);
    setTestCount(null);
    try {
      const { data, error } = await (supabase as any).functions.invoke(
        "get-jobs",
        {
          body: {
            q: (testQuery || "software engineer").trim(),
            location: (testLocation || "Remote").trim(),
            type: "",
          },
        },
      );
      if (error) throw error;
      const rows = Array.isArray(data?.jobs) ? data.jobs : [];
      setTestCount(rows.length);
      setTestNote("Success");
    } catch (e: any) {
      setTestNote(e?.message || "Failed");
    } finally {
      setTesting(false);
    }
  };

  const sourceDefs = [
    { id: "deepresearch", label: "Deep Research" },
    { id: "remotive", label: "Remotive" },
    { id: "remoteok", label: "RemoteOK" },
    { id: "arbeitnow", label: "Arbeitnow" },
  ];

  return (
    <div className='space-y-3'>
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={includeLinkedIn}
            onChange={(e) => setIncludeLinkedIn(e.target.checked)}
            disabled={loading}
          />
          Include LinkedIn
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={includeIndeed}
            onChange={(e) => setIncludeIndeed(e.target.checked)}
            disabled={loading}
          />
          Include Indeed
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={includeSearch}
            onChange={(e) => setIncludeSearch(e.target.checked)}
            disabled={loading}
          />
          Include Search/Listing pages
        </label>
      </div>
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={cronEnabled}
            onChange={(e) => setCronEnabled(e.target.checked)}
            disabled={loading}
          />
          Background Cron Enabled
        </label>
      </div>
      <div className='space-y-2'>
        <div className='text-sm font-medium'>Enabled Sources</div>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
          {sourceDefs.map((s) => (
            <label key={s.id} className='flex items-center gap-2'>
              <input
                type='checkbox'
                className='h-4 w-4 accent-[hsl(var(--ring))]'
                checked={enabledSources.includes(s.id)}
                onChange={(e) =>
                  setEnabledSources((prev: string[]) =>
                    toggle(prev, s.id, e.target.checked),
                  )
                }
                disabled={loading}
              />
              <span className='text-sm'>{s.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className='block text-sm font-medium mb-1'>
          Allowed Domains (comma separated)
        </label>
        <Input
          value={allowedDomains}
          onChange={(e) => setAllowedDomains(e.target.value)}
          placeholder='careers.google.com, amazon.jobs'
        />
      </div>
      <div className='flex items-center gap-2'>
        <Button
          onClick={save}
          disabled={saving || loading}
          className='bg-primary text-primary-foreground hover:bg-primary/90'
        >
          Save
        </Button>
        <Button
          variant='outline'
          onClick={runNow}
          disabled={loading}
          className='border-border/20 text-foreground hover:bg-card/20'
        >
          Run now
        </Button>
        <div className='ml-auto flex items-center gap-2 text-xs text-muted-foreground'>
          <span>Status:</span>
          <span
            className={`${cronEnabled ? "text-success" : "text-muted-foreground"}`}
          >
            {cronEnabled ? "Cron on" : "Cron off"}
          </span>
        </div>
      </div>
      {/* Test Search Area */}
      <div className='mt-3 p-3 rounded-md border border-border/20 bg-card/5'>
        <div className='text-sm font-medium mb-2'>Test Search</div>
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2'>
          <Input
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder='Query (e.g., software engineer)'
          />
          <Input
            value={testLocation}
            onChange={(e) => setTestLocation(e.target.value)}
            placeholder='Location (e.g., Remote)'
          />
          <Button
            onClick={testSearch}
            disabled={testing}
            className='bg-primary text-primary-foreground hover:bg-primary/90'
          >
            {testing ? "Testing…" : "Test Search"}
          </Button>
        </div>
        <div className='text-xs text-muted-foreground'>
          {testCount != null ? (
            <span>
              Jobs:{" "}
              <span className='text-foreground font-semibold'>{testCount}</span>
            </span>
          ) : (
            "Run a test to validate DB fallback."
          )}
          {testNote && <span className='ml-2'>({testNote})</span>}
        </div>
      </div>
    </div>
  );
}
