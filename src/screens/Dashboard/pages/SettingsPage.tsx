import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Globe, 
  CreditCard,
  Download,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  LogOut,
  Settings as SettingsIcon
} from "lucide-react";
import { motion } from "framer-motion";

export const SettingsPage = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState("profile");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "Udochukwu",
    lastName: "Chimbo",
    email: "chimbouda@gmail.com",
    phone: "+1 (555) 123-4567",
    location: "San Francisco, CA",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    jobAlerts: true,
    applicationUpdates: true,
    weeklyDigest: false,
    marketingEmails: false
  });

  const tabs = [
    { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "security", label: "Security", icon: <Shield className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
    { id: "privacy", label: "Privacy", icon: <Globe className="w-4 h-4" /> },
    { id: "billing", label: "Billing", icon: <CreditCard className="w-4 h-4" /> }
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationChange = (setting: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [setting]: value }));
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-6">
              <div className="w-24 h-24 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center text-black font-bold text-2xl">
                UC
              </div>
              <div className="space-y-2">
                <Button variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                </Button>
                <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove Photo
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#ffffff80] mb-2">First Name</label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  className="bg-[#ffffff1a] border-[#ffffff33] text-white focus:border-[#1dff00]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#ffffff80] mb-2">Last Name</label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  className="bg-[#ffffff1a] border-[#ffffff33] text-white focus:border-[#1dff00]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#ffffff80] mb-2">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="bg-[#ffffff1a] border-[#ffffff33] text-white focus:border-[#1dff00]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#ffffff80] mb-2">Phone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="bg-[#ffffff1a] border-[#ffffff33] text-white focus:border-[#1dff00]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#ffffff80] mb-2">Location</label>
                <Input
                  value={formData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                  className="bg-[#ffffff1a] border-[#ffffff33] text-white focus:border-[#1dff00]"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-4">
              <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]">
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
                { key: "emailNotifications", label: "Email Notifications", description: "Receive notifications via email" },
                { key: "pushNotifications", label: "Push Notifications", description: "Receive push notifications in browser" },
                { key: "jobAlerts", label: "Job Alerts", description: "Get notified about new job opportunities" },
                { key: "applicationUpdates", label: "Application Updates", description: "Updates on your job applications" },
                { key: "weeklyDigest", label: "Weekly Digest", description: "Weekly summary of your activity" },
                { key: "marketingEmails", label: "Marketing Emails", description: "Promotional emails and updates" }
              ].map((setting) => (
                <div key={setting.key} className="flex items-center justify-between p-4 bg-[#ffffff1a] rounded-lg border border-[#ffffff33]">
                  <div>
                    <h4 className="text-white font-medium">{setting.label}</h4>
                    <p className="text-sm text-[#ffffff80]">{setting.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleNotificationChange(setting.key, !notifications[setting.key as keyof typeof notifications])}
                    className={`${
                      notifications[setting.key as keyof typeof notifications]
                        ? "bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                        : "bg-[#ffffff33] text-white hover:bg-[#ffffff4d]"
                    } transition-all duration-200`}
                  >
                    {notifications[setting.key as keyof typeof notifications] ? "Enabled" : "Disabled"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );

      case "security":
        return (
          <div className="space-y-6">
            <Card className="bg-[#ffffff1a] border-[#ffffff33]">
              <CardContent className="p-4">
                <h3 className="text-white font-medium mb-4">Change Password</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#ffffff80] mb-2">Current Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={formData.currentPassword}
                        onChange={(e) => handleInputChange("currentPassword", e.target.value)}
                        className="bg-[#ffffff1a] border-[#ffffff33] text-white focus:border-[#1dff00] pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#ffffff60] hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#ffffff80] mb-2">New Password</label>
                    <Input
                      type="password"
                      value={formData.newPassword}
                      onChange={(e) => handleInputChange("newPassword", e.target.value)}
                      className="bg-[#ffffff1a] border-[#ffffff33] text-white focus:border-[#1dff00]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#ffffff80] mb-2">Confirm New Password</label>
                    <Input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      className="bg-[#ffffff1a] border-[#ffffff33] text-white focus:border-[#1dff00]"
                    />
                  </div>
                  <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90">
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#ffffff1a] border-[#ffffff33]">
              <CardContent className="p-4">
                <h3 className="text-white font-medium mb-4">Two-Factor Authentication</h3>
                <p className="text-[#ffffff80] mb-4">Add an extra layer of security to your account</p>
                <Button variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]">
                  Enable 2FA
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-[#ffffff1a] border-[#ffffff33]">
              <CardContent className="p-4">
                <h3 className="text-white font-medium mb-4">Active Sessions</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-[#ffffff0d] rounded border border-[#ffffff1a]">
                    <div>
                      <p className="text-white font-medium">Current Session</p>
                      <p className="text-sm text-[#ffffff80]">Chrome on macOS • San Francisco, CA</p>
                    </div>
                    <span className="text-xs text-[#1dff00] bg-[#1dff0020] px-2 py-1 rounded">Active</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "appearance":
        return (
          <div className="space-y-6">
            <Card className="bg-[#ffffff1a] border-[#ffffff33]">
              <CardContent className="p-4">
                <h3 className="text-white font-medium mb-4">Theme</h3>
                <div className="grid grid-cols-3 gap-3">
                  {["Dark", "Light", "Auto"].map((theme) => (
                    <div
                      key={theme}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        theme === "Dark"
                          ? "border-[#1dff00] bg-[#1dff0020]"
                          : "border-[#ffffff33] hover:border-[#ffffff4d]"
                      }`}
                    >
                      <div className="text-center">
                        <div className={`w-8 h-8 rounded mx-auto mb-2 ${
                          theme === "Dark" ? "bg-black" : theme === "Light" ? "bg-white" : "bg-gradient-to-r from-black to-white"
                        }`}></div>
                        <p className="text-white text-sm">{theme}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#ffffff1a] border-[#ffffff33]">
              <CardContent className="p-4">
                <h3 className="text-white font-medium mb-4">Accent Color</h3>
                <div className="grid grid-cols-6 gap-3">
                  {["#1dff00", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981"].map((color) => (
                    <div
                      key={color}
                      className={`w-8 h-8 rounded cursor-pointer border-2 ${
                        color === "#1dff00" ? "border-white" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    ></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "privacy":
        return (
          <div className="space-y-6">
            <Card className="bg-[#ffffff1a] border-[#ffffff33]">
              <CardContent className="p-4">
                <h3 className="text-white font-medium mb-4">Data & Privacy</h3>
                <div className="space-y-4">
                  <Button variant="outline" className="w-full justify-start border-[#ffffff33] text-white hover:bg-[#ffffff1a]">
                    <Download className="w-4 h-4 mr-2" />
                    Download Your Data
                  </Button>
                  <Button variant="outline" className="w-full justify-start border-[#ffffff33] text-white hover:bg-[#ffffff1a]">
                    <Shield className="w-4 h-4 mr-2" />
                    Privacy Settings
                  </Button>
                  <Button variant="outline" className="w-full justify-start border-red-500/50 text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "billing":
        return (
          <div className="space-y-6">
            <Card className="bg-[#ffffff1a] border-[#ffffff33]">
              <CardContent className="p-4">
                <h3 className="text-white font-medium mb-4">Current Plan</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Free Plan</p>
                    <p className="text-sm text-[#ffffff80]">Basic features included</p>
                  </div>
                  <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90">
                    Upgrade to Premium
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#ffffff1a] border-[#ffffff33]">
              <CardContent className="p-4">
                <h3 className="text-white font-medium mb-4">Payment Method</h3>
                <p className="text-[#ffffff80] mb-4">No payment method on file</p>
                <Button variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]">
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
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 flex flex-col min-w-0 max-w-full mx-auto w-full sm:w-[95vw] md:w-[80vw] lg:w-[60vw] xl:w-[40vw] p-3 sm:p-6">
        {/* Responsive settings layout */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Settings Navigation */}
            <div className="lg:w-64 space-y-2">
              <h1 className="text-2xl font-bold text-white mb-6 flex items-center">
                <SettingsIcon className="w-6 h-6 mr-2" />
                Settings
              </h1>
              
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant="ghost"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full justify-start transition-all duration-200 ${
                    activeTab === tab.id
                      ? "text-white bg-[#1dff0020] border-r-2 border-[#1dff00]"
                      : "text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]"
                  }`}
                >
                  {tab.icon}
                  <span className="ml-3">{tab.label}</span>
                </Button>
              ))}
              
              <div className="pt-4 border-t border-[#ffffff1a]">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  Sign Out
                </Button>
              </div>
            </div>

            {/* Settings Content */}
            <div className="flex-1">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px]">
                  <CardContent className="p-6">
                    {renderTabContent()}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};