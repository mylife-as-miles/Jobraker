import { useEffect, useMemo, useState } from "react";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { motion } from "framer-motion";
import { LogOut, User, Bell, Shield, Palette, Globe, CreditCard, Upload, Trash2, Save, RefreshCw, Eye, EyeOff, Download, Settings as SettingsIcon, Plus, Link, Search, Briefcase, ToggleLeft, ToggleRight, Building, Users, Coffee, Car, Rss, GripVertical } from "lucide-react";
import { useProfileSettings } from "../../../hooks/useProfileSettings";
import { useNotificationSettings } from "../../../hooks/useNotificationSettings";
import { usePrivacySettings } from "../../../hooks/usePrivacySettings";
import { useSecuritySettings } from "../../../hooks/useSecuritySettings";
import { createClient } from "../../../lib/supabaseClient";
import { useAppearanceSettings } from "../../../hooks/useAppearanceSettings";
import { useToast } from "../../../components/ui/toast";
import Modal from "../../../components/ui/modal";
import { validatePassword } from "../../../utils/password";
import { CheckCircle2, XCircle } from "lucide-react";
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
  const { settings: privacy, createSettings: createPrivacy, updateSettings: updatePrivacy, refresh: refreshPrivacy, loading: privacyLoading } = usePrivacySettings() as any;
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
  const passwordCheck = useMemo(() => validatePassword(formData.newPassword, formData.email), [formData.newPassword, formData.email]);

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
          .from('job_source_configs')
          .select('sources')
          .eq('user_id', uid)
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

  useEffect(() => {
    // ensure settings exist lazily on first toggle
    void refreshSec();
  }, [refreshSec]);

  const tabs = [
    { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "security", label: "Security", icon: <Shield className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
    { id: "privacy", label: "Privacy", icon: <Globe className="w-4 h-4" /> },
    { id: "job-sources", label: "Job Sources", icon: <SettingsIcon className="w-4 h-4" /> },
    { id: "billing", label: "Billing", icon: <CreditCard className="w-4 h-4" /> }
  ];

  useRegisterCoachMarks({
    page: 'settings',
    marks: [
      { id: 'settings-tabs', selector: 'button[role="tab"]', title: 'Manage Preferences', body: 'Switch between profile, notifications, security, appearance and more.' },
      { id: 'settings-profile-form', selector: 'form input[name="firstName"], input[placeholder="First Name"]', title: 'Profile Basics', body: 'Keep your name and contact details current for personalized matching.' },
      { id: 'settings-job-sources', selector: 'div:has(button svg.w-4.h-4)', title: 'Job Ingestion Sources', body: 'Enable or disable job feeds and reorder priority for searching.' }
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
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="bg-white/5 border-white/10 p-6 rounded-xl">
          <div className="space-y-4">
            <Skeleton className="h-5 w-48" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ... existing rendering logic below will conditionally use activeLoading & TabSkeleton

  const handleNotificationChange = async (setting: string, value: boolean) => {
    try {
      if (setting === 'push_notifications' && value) {
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
      const [{ data: prof }, { data: notifData }, { data: resumes }, { data: privacyData }] = await Promise.all([
        (supabase as any).from('profiles').select('*').eq('id', uid).maybeSingle(),
        (supabase as any).from('notification_settings').select('*').eq('id', uid).maybeSingle(),
        (supabase as any).from('resumes').select('*').eq('user_id', uid).order('updated_at', { ascending: false }),
        (supabase as any).from('privacy_settings').select('*').eq('id', uid).maybeSingle(),
      ]);

      const payload = {
        exported_at: new Date().toISOString(),
        user: { id: uid, email: (u as any)?.user?.email },
        profile: prof || null,
  notification_settings: notifData || null,
  privacy_settings: privacyData || null,
        resumes: resumes || [],
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
    const { error } = await supabase.auth.updateUser({ password: formData.newPassword });
    if (error) return toastError('Failed to update password', error.message);
    success('Password updated');
    setFormData((p) => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '' }));
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-6">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-primary/20 border border-primary flex items-center justify-center text-primary-foreground font-bold text-2xl">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={handleUploadAvatar}
                  className="border-border/20 text-foreground hover:bg-card/20 hover:border-primary/50 hover:scale-105 transition-all duration-300"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleRemoveAvatar}
                  className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 hover:scale-105 transition-all duration-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove Photo
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">First Name</label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  className="bg-card/10 border-border/20 text-foreground focus:border-primary hover:border-border/30 transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Last Name</label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  className="bg-card/10 border-border/20 text-foreground focus:border-primary hover:border-border/30 transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="bg-card/10 border-border/20 text-foreground focus:border-primary hover:border-border/30 transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Phone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="bg-card/10 border-border/20 text-foreground focus:border-primary hover:border-border/30 transition-all duration-300"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-2">Location</label>
                <Input
                  value={formData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                  className="bg-card/10 border-border/20 text-foreground focus:border-primary hover:border-border/30 transition-all duration-300"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-4">
              <Button
                onClick={handleSaveProfile}
                className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-all duration-300"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={handleResetForm}
                className="border-border/20 text-foreground hover:bg-card/20 hover:border-primary/50 hover:scale-105 transition-all duration-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              {[
                { key: "email_notifications", label: "Email Notifications", description: "Receive notifications via email" },
                { key: "push_notifications", label: "Push Notifications", description: "Receive push notifications in browser" },
                { key: "job_alerts", label: "Job Alerts", description: "Get notified about new job opportunities" },
                { key: "application_updates", label: "Application Updates", description: "Updates on your job applications" },
                { key: "weekly_digest", label: "Weekly Digest", description: "Weekly summary of your activity" },
                { key: "marketing_emails", label: "Marketing Emails", description: "Promotional emails and updates" }
              ].map((setting) => (
                <motion.div
                  key={setting.key}
                  className="flex items-center justify-between p-4 bg-card/10 rounded-lg border border-border/20 hover:border-primary/50 hover:bg-card/20 transition-all duration-300"
                  whileHover={{ scale: 1.01 }}
                >
                  <div>
                    <h4 className="text-foreground font-medium">{setting.label}</h4>
                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleNotificationChange(setting.key, !(notif as any)?.[setting.key])}
                    className={`transition-all duration-300 hover:scale-105 ${
                      (notif as any)?.[setting.key]
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {(notif as any)?.[setting.key] ? "Enabled" : "Disabled"}
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case "security":
        return (
          <div className="space-y-6">
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
            <Card className="bg-card/10 border-border/20 hover:border-primary/50 transition-all duration-300">
              <CardContent className="p-4">
                <h3 className="text-foreground font-medium mb-4">Two-Factor Authentication</h3>
                <p className="text-muted-foreground mb-4">Add an extra layer of security to your account</p>
                <div className="flex items-center gap-3">
                  <Button
                    variant={sec?.two_factor_enabled ? 'secondary' : 'outline'}
                    onClick={async () => {
                      try {
                        if (sec?.two_factor_enabled) {
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
                    className="border-border/20 text-foreground hover:bg-card/20 hover:border-primary/50 hover:scale-105 transition-all duration-300"
                  >
                    {sec?.two_factor_enabled ? 'Disable 2FA' : 'Enable 2FA'}
                  </Button>
                  <span className="text-sm text-muted-foreground">Status: {sec?.two_factor_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Sign-in Alerts */}
            <Card className="bg-card/10 border-border/20 hover:border-primary/50 transition-all duration-300">
              <CardContent className="p-4">
                <h3 className="text-foreground font-medium mb-4">Sign-in Alerts</h3>
                <div className="space-y-3">
                  <motion.div
                    className="flex items-center justify-between p-3 bg-card/5 rounded border border-border/10 hover:border-primary/30 transition-all duration-300"
                    whileHover={{ scale: 1.01 }}
                  >
                    <div>
                      <p className="text-foreground font-medium">Email alerts</p>
                      <p className="text-sm text-muted-foreground">Notify me when a new device signs in</p>
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      onClick={async () => {
                        if (!sec) await createSecurity({ sign_in_alerts: true });
                        else await updateSecurity({ sign_in_alerts: !sec.sign_in_alerts });
                      }}
                      className={`transition-all duration-300 hover:scale-105 ${(sec?.sign_in_alerts ?? true) ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                      {(sec?.sign_in_alerts ?? true) ? 'Enabled' : 'Disabled'}
                    </Button>
                  </motion.div>
                </div>
              </CardContent>
            </Card>

            {/* Backup Codes */}
            <Card className="bg-card/10 border-border/20 hover:border-primary/50 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-foreground font-medium">Backup Codes</h3>
                  <Button
                    variant="outline"
                    className="border-border/20 text-foreground hover:bg-card/20 hover:border-primary/50"
                    onClick={async () => {
                      try {
                        const codes = await generateBackupCodes(10);
                        const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'jobraker-backup-codes.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                        success('Backup codes downloaded');
                      } catch (e: any) {
                        toastError('Failed to generate codes', e.message);
                      }
                    }}
                  >Generate</Button>
                </div>
                <p className="text-muted-foreground text-sm mb-3">Store these one-time use codes in a safe place. Each can be used once.</p>
                <div className="mt-3 border border-border/10 rounded-md overflow-hidden">
                  <div className="grid grid-cols-3 text-xs text-muted-foreground bg-card/5 py-2 px-3">
                    <div>ID</div>
                    <div>Status</div>
                    <div>Note</div>
                  </div>
                  <div className="divide-y divide-border/10">
                    {backupCodes && backupCodes.length > 0 ? (
                      backupCodes.map((bc: any) => (
                        <div key={bc.id} className="grid grid-cols-3 items-center text-sm py-2 px-3">
                          <div className="text-foreground">{bc.id}</div>
                          <div>
                            <span className={`text-xs px-2 py-1 rounded ${bc.used ? 'text-destructive-foreground bg-destructive/80' : 'text-success-foreground bg-success/80' }`}>
                              {bc.used ? 'Used' : 'Unused'}
                            </span>
                          </div>
                          <div className="text-muted-foreground">Plaintext shown only on generation</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground py-3 px-3">No backup codes yet. Generate to create a new set.</div>
                    )}
                  </div>
                </div>
              </CardContent>
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

            {/* Active Sessions (placeholder) */}
            <Card className="bg-card/10 border-border/20 hover:border-primary/50 transition-all duration-300">
              <CardContent className="p-4">
                <h3 className="text-foreground font-medium mb-4">Active Sessions</h3>
                <div className="space-y-3">
                  <motion.div
                    className="flex items-center justify-between p-3 bg-card/5 rounded border border-border/10 hover:border-primary/30 transition-all duration-300"
                    whileHover={{ scale: 1.01 }}
                  >
                    <div>
                      <p className="text-foreground font-medium">Current Session</p>
                      <p className="text-sm text-muted-foreground">Your current browser</p>
                    </div>
                    <span className="text-xs text-success-foreground bg-success/80 px-2 py-1 rounded">Active</span>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "appearance":
        return (
          <div className="space-y-6">
            <Card className="bg-card/10 border-border/20 hover:border-primary/50 transition-all duration-300">
              <CardContent className="p-4">
                <h3 className="text-foreground font-medium mb-4">Theme</h3>
                <div className="grid grid-cols-3 gap-3">
                  {["Dark", "Light", "Auto"].map((theme) => (
                    <motion.div
                      key={theme}
                      onClick={async () => {
                        const value = theme.toLowerCase() as 'dark' | 'light' | 'auto';
                        try {
                          if (!appearanceSettings) await (appearance as any).createSettings({ theme: value });
                          else await (appearance as any).updateSettings({ theme: value });
                        } catch (e: any) { toastError('Failed to set theme', e.message); }
                      }}
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-300 ${
                        (appearanceSettings?.theme || 'auto') === theme.toLowerCase()
                          ? "border-primary bg-primary/20"
                          : "border-border/20 hover:border-border/30"
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="text-center">
                        <div className={`w-8 h-8 rounded mx-auto mb-2 ${
                          theme === "Dark" ? "bg-zinc-900" : theme === "Light" ? "bg-zinc-100" : "bg-gradient-to-r from-zinc-900 to-zinc-100"
                        }`}></div>
                        <p className="text-foreground text-sm">{theme}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/10 border-border/20 hover:border-primary/50 transition-all duration-300">
              <CardContent className="p-4">
                <h3 className="text-foreground font-medium mb-4">Accent Color</h3>
                <div className="grid grid-cols-6 gap-3">
                  {["#1dff00", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981"].map((color) => (
                    <motion.div
                      key={color}
                      onClick={async () => {
                        try {
                          if (!appearanceSettings) await (appearance as any).createSettings({ accent_color: color });
                          else await (appearance as any).updateSettings({ accent_color: color });
                        } catch (e: any) { toastError('Failed to set accent', e.message); }
                      }}
                      className={`w-8 h-8 rounded cursor-pointer border-2 transition-all duration-300 ${
                        (appearanceSettings?.accent_color || '#1dff00').toLowerCase() === color.toLowerCase()
                          ? "border-foreground"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    ></motion.div>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Reduced motion</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        if (!appearanceSettings) await (appearance as any).createSettings({ reduce_motion: true });
                        else await (appearance as any).updateSettings({ reduce_motion: !(appearanceSettings.reduce_motion ?? false) });
                      } catch (e: any) { toastError('Failed to update motion preference', e.message); }
                    }}
                    className={`transition-all duration-300 hover:scale-105 ${
                      (appearanceSettings?.reduce_motion ?? false)
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {(appearanceSettings?.reduce_motion ?? false) ? 'Reduced motion: On' : 'Reduced motion: Off'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "privacy":
        return (
          <div className="space-y-6">
            <Card className="bg-card/10 border-border/20 hover:border-primary/50 transition-all duration-300">
              <CardContent className="p-4">
                <h3 className="text-foreground font-medium mb-4">Data & Privacy</h3>
                <div className="space-y-4">
                  {/* Privacy toggles */}
                  {[{
                    key: 'is_profile_public',
                    label: 'Public profile',
                    desc: 'Allow your profile to be visible to others.'
                  },{
                    key: 'show_email',
                    label: 'Show email',
                    desc: 'Display your email address on your profile.'
                  },{
                    key: 'allow_search_indexing',
                    label: 'Search engine indexing',
                    desc: 'Allow search engines to index your public profile.'
                  },{
                    key: 'share_analytics',
                    label: 'Share anonymized analytics',
                    desc: 'Help improve the product by sharing anonymized usage data.'
                  },{
                    key: 'personalized_ads',
                    label: 'Personalized ads',
                    desc: 'Use your data to personalize ads.'
                  },{
                    key: 'resume_default_public',
                    label: 'New resumes are public by default',
                    desc: 'When enabled, newly created resumes are public unless you change them.'
                  }].map((row: any) => (
                    <motion.div key={row.key} className="flex items-center justify-between p-3 bg-card/5 rounded border border-border/10 hover:border-primary/30 transition-all duration-300" whileHover={{ scale: 1.01 }}>
                      <div>
                        <p className="text-foreground font-medium">{row.label}</p>
                        <p className="text-sm text-muted-foreground">{row.desc}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            if (!privacy) await createPrivacy({ [row.key]: true } as any);
                            else await updatePrivacy({ [row.key]: !(privacy as any)[row.key] } as any);
                          } catch (e: any) { toastError('Failed to update privacy', e.message); }
                        }}
                        className={`transition-all duration-300 hover:scale-105 ${
                          ((privacy as any)?.[row.key] ?? false)
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {((privacy as any)?.[row.key] ?? false) ? 'Enabled' : 'Disabled'}
                      </Button>
                    </motion.div>
                  ))}

                  <Button
                    variant="outline"
                    onClick={handleExportData}
                    className="w-full justify-start border-border/20 text-foreground hover:bg-card/20 hover:border-primary/50 hover:scale-105 transition-all duration-300"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Your Data
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-border/20 text-foreground hover:bg-card/20 hover:border-primary/50 hover:scale-105 transition-all duration-300"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Privacy Settings
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!confirm('Delete your account? This cannot be undone.')) return;
                      const { data } = await supabase.auth.getUser();
                      const uid = (data as any)?.user?.id;
                      try {
                        if (uid) {
                          await (supabase as any).from('profiles').delete().eq('id', uid);
                          await (supabase as any).from('notification_settings').delete().eq('id', uid);
                          await (supabase as any).from('security_settings').delete().eq('id', uid);
                          await (supabase as any).from('security_backup_codes').delete().eq('user_id', uid);
                          await (supabase as any).from('security_trusted_devices').delete().eq('user_id', uid);
                          await (supabase as any).from('privacy_settings').delete().eq('id', uid);
                        }
                        await supabase.auth.signOut();
                        success('Account deleted');
                        window.location.href = '/';
                      } catch (e: any) {
                        toastError('Delete failed', e.message);
                      }
                    }}
                    className="w-full justify-start border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive hover:scale-105 transition-all duration-300"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "job-sources":
        return (
          <div className="space-y-6">
            {/* Quick Defaults for source flags that integrate with process-and-match */}
            <Card className="bg-card/10 border-border/20 hover:border-primary/50 transition-all duration-300">
              <CardContent className="p-4 space-y-4">
                <h3 className="text-foreground font-medium">Job Source Defaults</h3>
                <p className="text-sm text-muted-foreground">These settings are used by live search and fallbacks.</p>
                <DefaultsForm />
              </CardContent>
            </Card>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-2">Job Sources Configuration</h2>
                <p className="text-muted-foreground text-sm">
                  Configure and manage job ingestion sources for automated job discovery
                </p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  {jobSources.filter(s => s.enabled).length} of {jobSources.length} sources enabled
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="border-border/20 text-foreground hover:bg-card/20 hover:border-primary/50"
                  onClick={() => setJobSources(jobSources.map(s => ({ ...s, enabled: true })))}
                >
                  Enable All
                </Button>
                <Button
                  variant="outline"
                  className="border-border/20 text-foreground hover:bg-card/20 hover:border-primary/50"
                  onClick={() => setJobSources(jobSources.map(s => ({ ...s, enabled: false })))}
                >
                  Disable All
                </Button>
                <Button
                  variant="outline"
                  className="border-border/20 text-foreground hover:bg-card/20 hover:border-primary/50"
                  onClick={() => setJobSources(defaultJobSources)}
                >
                  Reset
                </Button>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-all duration-300"
                  onClick={() => {
                    const maxId = jobSources.reduce((m, s) => Math.max(m, s.id || 0), 0);
                    const newId = maxId + 1;
                    setJobSources([...jobSources, { id: newId, type: "linkedin", query: "", enabled: true }]);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Source
                </Button>
              </div>
            </div>

            {/* Job Sources List */}
            <div className="space-y-4">
              {displayedSources.map((source) => (
                <Card
                  key={source.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(source.id));
                    setDraggingId(source.id);
                  }}
                  onDragOver={(e) => { e.preventDefault(); if (dragOverId !== source.id) setDragOverId(source.id); }}
                  onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromId = Number(e.dataTransfer.getData('text/plain'));
                    const toId = source.id;
                    setJobSources((prev) => moveItem(prev, fromId, toId));
                    setDraggingId(null); setDragOverId(null);
                  }}
                  className={`bg-card/10 border-border/20 hover:border-primary/50 transition-all duration-300 ${dragOverId === source.id ? 'ring-2 ring-primary/40' : ''} ${draggingId === source.id ? 'opacity-70' : ''}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 flex items-center justify-center">
                          {source.type === 'remotive' && <Search className="w-5 h-5 text-primary" />}
                          {source.type === 'remoteok' && <Globe className="w-5 h-5 text-primary" />}
                          {source.type === 'arbeitnow' && <Briefcase className="w-5 h-5 text-primary" />}
                          {source.type === 'linkedin' && <Users className="w-5 h-5 text-primary" />}
                          {source.type === 'indeed' && <Building className="w-5 h-5 text-primary" />}
                          {source.type === 'feedcoyote' && <Rss className="w-5 h-5 text-primary" />}
                          {source.type === 'trulyremote' && <Globe className="w-5 h-5 text-primary" />}
                          {source.type === 'remoteco' && <Coffee className="w-5 h-5 text-primary" />}
                          {source.type === 'jobspresso' && <Coffee className="w-5 h-5 text-primary" />}
                          {source.type === 'skipthedrive' && <Car className="w-5 h-5 text-primary" />}
                          {source.type === 'json' && <Link className="w-5 h-5 text-primary" />}
                          {source.type === 'deepresearch' && <Search className="w-5 h-5 text-primary" />}
                        </div>
                        <div>
                          <h3 className="text-foreground font-medium capitalize">{source.type}</h3>
                          <p className="text-muted-foreground text-sm">
                            {source.type === 'remotive' && 'Remote job listings with search query support'}
                            {source.type === 'remoteok' && 'Popular remote job board'}
                            {source.type === 'arbeitnow' && 'European job board with search capabilities'}
                            {source.type === 'linkedin' && 'Professional networking platform job listings'}
                            {source.type === 'indeed' && 'World\'s largest job search engine'}
                            {source.type === 'feedcoyote' && 'RSS-based job feed aggregator'}
                            {source.type === 'trulyremote' && 'Curated remote job opportunities'}
                            {source.type === 'remoteco' && 'Remote-first company job board'}
                            {source.type === 'jobspresso' && 'Premium remote and flexible jobs'}
                            {source.type === 'skipthedrive' && 'Work-from-home job opportunities'}
                            {source.type === 'json' && 'Custom JSON feed URL'}
                            {source.type === 'deepresearch' && 'AI-powered deep job research'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => {
                            setJobSources(jobSources.map(s =>
                              s.id === source.id ? { ...s, enabled: !s.enabled } : s
                            ));
                          }}
                          className="transition-colors duration-200"
                        >
                          {source.enabled ? (
                            <ToggleRight className="w-6 h-6 text-primary" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                          )}
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Remove this source?')) {
                              setJobSources(jobSources.filter(s => s.id !== source.id));
                            }
                          }}
                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Configuration Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        <GripVertical className="w-4 h-4" />
                        <span>Drag to reorder</span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Source Type</label>
                        <select
                          value={source.type}
                          onChange={(e) => {
                            setJobSources(jobSources.map(s =>
                              s.id === source.id ? { ...s, type: e.target.value } : s
                            ));
                          }}
                          className="w-full px-3 py-2 bg-card/10 border border-border/20 rounded-lg text-foreground focus:border-primary focus:outline-none transition-colors"
                        >
                          <option value="remotive">Remotive</option>
                          <option value="remoteok">RemoteOK</option>
                          <option value="arbeitnow">Arbeit Now</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="indeed">Indeed</option>
                          <option value="feedcoyote">FeedCoyote</option>
                          <option value="trulyremote">Truly Remote</option>
                          <option value="remoteco">Remote.co</option>
                          <option value="jobspresso">Jobspresso</option>
                          <option value="skipthedrive">Skip The Drive</option>
                          <option value="json">Custom JSON</option>
                          <option value="deepresearch">Deep Research</option>
                        </select>
                      </div>

                      {(source.type === 'remotive' || source.type === 'arbeitnow' || source.type === 'linkedin' || source.type === 'indeed' || source.type === 'trulyremote' || source.type === 'jobspresso' || source.type === 'deepresearch') && (
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Search Query</label>
                          <Input
                            value={source.query}
                            onChange={(e) => {
                              setJobSources(jobSources.map(s =>
                                s.id === source.id ? { ...s, query: e.target.value } : s
                              ));
                            }}
                            placeholder="e.g., software engineer, react developer"
                            className="bg-card/10 border-border/20 text-foreground placeholder:text-muted-foreground focus:border-primary"
                          />
                        </div>
                      )}

          {source.type === 'json' && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-foreground mb-2">JSON Feed URL</label>
                          <Input
                            value={source.query}
                            onChange={(e) => {
                              setJobSources(jobSources.map(s =>
                                s.id === source.id ? { ...s, query: e.target.value } : s
                              ));
                            }}
                            placeholder="https://your.api.example/jobs.json"
            className={`bg-card/10 text-foreground placeholder:text-muted-foreground focus:border-primary border ${source.query && !isValidUrl(source.query) ? 'border-destructive focus:border-destructive' : 'border-border/20'}`}
                          />
                          {source.query && !isValidUrl(source.query) && (
                            <p className="mt-1 text-xs text-destructive">Please enter a valid URL</p>
                          )}
                        </div>
                      )}
                    </div>

                    {source.type === 'deepresearch' && (
                      <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                        <h4 className="text-foreground font-medium mb-3 flex items-center">
                          <Search className="w-4 h-4 mr-2 text-primary" />
                          Advanced AI Research Options
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Work Type</label>
                            <select className="w-full px-3 py-2 bg-card/10 border border-border/20 rounded-lg text-foreground focus:border-primary focus:outline-none">
                              <option value="Remote">Remote</option>
                              <option value="Hybrid">Hybrid</option>
                              <option value="On-site">On-site</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Location</label>
                            <Input
                              placeholder="e.g., United States, Europe"
                              className="bg-card/10 border-border/20 text-foreground placeholder:text-muted-foreground focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Experience Level</label>
                            <select className="w-full px-3 py-2 bg-card/10 border-border/20 rounded-lg text-foreground focus:border-primary focus:outline-none">
                              <option value="entry">Entry Level</option>
                              <option value="mid">Mid Level</option>
                              <option value="senior">Senior Level</option>
                              <option value="lead">Lead/Principal</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Salary Range</label>
                            <Input
                              placeholder="e.g., 120k-200k"
                              className="bg-card/10 border-border/20 text-foreground placeholder:text-muted-foreground focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Max Results</label>
                            <Input
                              type="number"
                              placeholder="20"
                              className="bg-card/10 border-border/20 text-foreground placeholder:text-muted-foreground focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Configuration Info removed as requested */}

            {/* Save / Grouping */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <button
                  className={`px-2 py-1 rounded border ${groupEnabledFirst ? 'bg-primary/20 border-primary/40 text-foreground' : 'border-border/20 text-muted-foreground'}`}
                  onClick={() => setGroupEnabledFirst((v) => !v)}
                >
                  {groupEnabledFirst ? 'Grouping: Enabled first' : 'Grouping: Off'}
                </button>
              </div>
              <div>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-all duration-300"
                  onClick={async () => {
                    try {
                      const { data: auth } = await supabase.auth.getUser();
                      const uid = (auth as any)?.user?.id;
                      if (!uid) { toastError('Not signed in', ''); return; }
                      const payload = { user_id: uid, sources: jobSources } as any;
                      const { error } = await (supabase as any)
                        .from('job_source_configs')
                        .upsert(payload, { onConflict: 'user_id' });
                      if (error) throw error;
                      try { localStorage.setItem('jobSources', JSON.stringify(jobSources)); } catch { /* ignore */ }
                      success('Job sources saved', 'Your job source configuration has been updated successfully');
                    } catch (e: any) {
                      try { localStorage.setItem('jobSources', JSON.stringify(jobSources)); } catch { /* ignore */ }
                      toastError('Saved locally (no backend table)', e?.message || '');
                    }
                  }}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Configuration
                </Button>
              </div>
            </div>
          </div>
        );

      case "billing":
        return (
          <div className="space-y-6">
            <Card className="bg-card/10 border-border/20 hover:border-primary/50 transition-all duration-300">
              <CardContent className="p-4">
                <h3 className="text-foreground font-medium mb-4">Current Plan</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground font-medium">Free Plan</p>
                    <p className="text-sm text-muted-foreground">Basic features included</p>
                  </div>
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-all duration-300"
                    onClick={() => { window.location.href = '/pricing'; }}
                  >
                    Upgrade to Premium
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/10 border-border/20 hover:border-primary/50 transition-all duration-300">
              <CardContent className="p-4">
                <h3 className="text-foreground font-medium mb-4">Payment Method</h3>
                <p className="text-muted-foreground mb-4">No payment method on file</p>
                <Button
                  variant="outline"
                  className="border-border/20 text-foreground hover:bg-card/20 hover:border-primary/50 hover:scale-105 transition-all duration-300"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Add Payment Method
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* Settings Navigation */}
          <div className="lg:col-span-1 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6 flex items-center">
              <SettingsIcon className="w-6 h-6 mr-2" />
              Settings
            </h1>
            
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full justify-start transition-all duration-300 hover:scale-105 ${
                  activeTab === tab.id
                    ? "text-foreground bg-primary/10 border-r-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {tab.icon}
                <span className="ml-3">{tab.label}</span>
              </Button>
            ))}
            
            <div className="pt-4 border-t border-border/20">
              <Button
                variant="ghost"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = '/login';
                }}
                className="w-full justify-start text-destructive hover:text-destructive/90 hover:bg-destructive/10 hover:scale-105 transition-all duration-300"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Sign Out
              </Button>
            </div>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-card/50 border-border/20 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  {activeLoading ? <TabSkeleton /> : renderTabContent()}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
    {/* 2FA Setup Modal */}
    <TwoFAModal />
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
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
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
          .select('include_linkedin, include_indeed, include_search, allowed_domains, enabled_sources, cron_enabled, last_fetched_at')
          .eq('id', uid)
          .maybeSingle();
        if (data) {
          if (data.include_linkedin != null) setIncludeLinkedIn(!!data.include_linkedin);
          if (data.include_indeed != null) setIncludeIndeed(!!data.include_indeed);
          if (data.include_search != null) setIncludeSearch(!!data.include_search);
          if (Array.isArray(data.allowed_domains)) setAllowedDomains(data.allowed_domains.join(','));
          if (Array.isArray(data.enabled_sources)) setEnabledSources(data.enabled_sources);
          if (typeof (data as any).cron_enabled === 'boolean') setCronEnabled(!!(data as any).cron_enabled);
          if ((data as any).last_fetched_at) setLastFetchedAt((data as any).last_fetched_at);
        } else {
          // Fallback to local last fetched timestamp if any
          try { const lf = localStorage.getItem('jobsCron.lastFetchedAt'); if (lf) setLastFetchedAt(lf); } catch {}
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
      const ts = new Date().toISOString();
      setLastFetchedAt(ts);
      try { localStorage.setItem('jobsCron.lastFetchedAt', ts); } catch {}
      // Best-effort: persist last_fetched_at if column exists
      try {
        await (supabase as any)
          .from('job_source_settings')
          .upsert({ id: uid, last_fetched_at: ts, updated_at: ts }, { onConflict: 'id' });
      } catch { /* ignore */ }
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
        <div className="text-xs text-muted-foreground flex items-center">
          Last fetched: {lastFetchedAt ? new Date(lastFetchedAt).toLocaleString() : '—'}
        </div>
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