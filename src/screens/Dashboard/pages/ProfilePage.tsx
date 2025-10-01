import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { motion } from "framer-motion";
import { Edit, Mail, Phone, MapPin, Plus, ExternalLink, Calendar, Trash2, Award, GraduationCap, Briefcase, Lightbulb } from "lucide-react";
import { EmptyState } from "../../../components/ui/empty-state";
import { Skeleton } from "../../../components/ui/skeleton";
import { useProfileSettings } from "../../../hooks/useProfileSettings";
import type { ProfileEducationRecord as TProfileEducation, ProfileExperienceRecord as TProfileExperience, ProfileSkillRecord as TProfileSkill } from "../../../hooks/useProfileSettings";
import { useApplications } from "../../../hooks/useApplications";
import { createClient } from "../../../lib/supabaseClient";

// Data now comes from Supabase via useProfileCollections

const ProfilePage = (): JSX.Element => {
  const [isEditing, setIsEditing] = useState(false);
  const { profile, updateProfile, loading: profileLoading } = useProfileSettings();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const initials = useMemo(() => {
    const a = (profile?.first_name || '').trim();
    const b = (profile?.last_name || '').trim();
    const i = `${a.charAt(0) || ''}${b.charAt(0) || ''}` || (email.charAt(0) || 'U');
    return i.toUpperCase();
  }, [profile?.first_name, profile?.last_name, email]);

  // hydrate auth email
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const em = (data as any)?.user?.email ?? "";
      setEmail(em);
    })();
  }, [supabase]);

  // resolve signed avatar URL from private storage (refresh every 8 mins)
  useEffect(() => {
    let active = true;
    const load = async () => {
      const path = (profile as any)?.avatar_url as string | undefined;
      if (!path) { if (active) setAvatarUrl(null); return; }
      try {
        const { data, error } = await (supabase as any).storage.from('avatars').createSignedUrl(path, 60 * 10);
        if (error) throw error;
        if (active) setAvatarUrl(data?.signedUrl || null);
      } catch {
        if (active) setAvatarUrl(null);
      }
    };
    load();
    const id = setInterval(load, 1000 * 60 * 8);
    return () => { active = false; clearInterval(id); };
  }, [supabase, (profile as any)?.avatar_url]);

  // Collections now sourced directly from useProfileSettings (centralized hook)
  const {
    experiences,
    education,
    skills,
    addExperience,
    addEducation,
    addSkill,
    deleteExperience,
    deleteEducation,
    deleteSkill,
    updateExperience,
    updateEducation,
    updateSkill,
  } = useProfileSettings() as any; // NOTE: duplicate hook invocation; consider consolidating later

  // Local UI state for creation / editing
  const [showAddExperience, setShowAddExperience] = useState(false);
  const [showAddEducation, setShowAddEducation] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  // Applications for realtime Quick Stats
  const { applications, loading: appsLoading, error: appsError } = useApplications();
  const totalApps = applications?.length ?? 0;
  const interviews = applications?.filter(a => a.status === 'Interview').length ?? 0;
  const offers = applications?.filter(a => a.status === 'Offer').length ?? 0;
  const successRate = totalApps > 0 ? Math.round((offers / totalApps) * 100) : 0;

  // skill level helpers
  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case "Expert":
        return "bg-green-500";
      case "Advanced":
        return "bg-blue-500";
      case "Intermediate":
        return "bg-yellow-500";
      case "Beginner":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getSkillLevelWidth = (level: string) => {
    switch (level) {
      case "Expert":
        return "w-full";
      case "Advanced":
        return "w-3/4";
      case "Intermediate":
        return "w-1/2";
      case "Beginner":
        return "w-1/4";
      default:
        return "w-1/4";
    }
  };

  // Avatar upload handler
  const onAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = (userData as any)?.user?.id as string | undefined;
      if (!userId) return;
      const path = `${userId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await (supabase as any).storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      await updateProfile({ avatar_url: path } as any);
    } catch {
      // swallow; toast handled by hook on failure
    } finally {
      e.currentTarget.value = "";
    }
  };

  const showAboutEmpty = !isEditing && !profile?.job_title && !profile?.location && !profile?.experience_years;

  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Profile Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg hover:border-[#1dff00]/30 transition-all duration-300">
                <div className="text-center">
                  <div className="relative inline-block mb-4">
                    {profile === null && (
                      <Skeleton className="w-24 h-24 rounded-full" />
                    )}
                    {profile !== null && (
                      <>
                        <div className="w-24 h-24 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center text-black font-bold text-2xl overflow-hidden">
                          {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span>{initials}</span>
                          )}
                        </div>
                        <label className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-110 transition-all duration-300 p-0 flex items-center justify-center cursor-pointer">
                          <Edit className="w-4 h-4" />
                          <input type="file" accept="image/*" className="hidden" onChange={onAvatarPick} />
                        </label>
                      </>
                    )}
                  </div>
                  
                  <h2 className="text-xl font-bold text-white mb-1">
                    {(profile?.first_name || '').trim() || 'Your'} {(profile?.last_name || '').trim() || 'Name'}
                  </h2>
                  <p className="text-[#ffffff80] mb-2">{profile?.job_title || 'Add a job title'}</p>
                  <p className="text-[#ffffff60] text-sm mb-4 flex items-center justify-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {profile?.location || 'Add location'}
                  </p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-center text-[#ffffff80] hover:text-white transition-colors duration-300">
                      <Mail className="w-4 h-4 mr-2" />
                      <span>{email || 'your@email'}</span>
                    </div>
                    <div className="flex items-center justify-center text-[#ffffff80] hover:text-white transition-colors duration-300">
                      <Phone className="w-4 h-4 mr-2" />
                      <span>{(profile as any)?.phone || 'Add phone'}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-center space-x-2 mt-4">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      LinkedIn
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      GitHub
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg hover:border-[#1dff00]/30 transition-all duration-300">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
                {appsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ) : appsError ? (
                  <p className="text-sm text-red-400">{appsError}</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[#ffffff80]">Applications</span>
                      <span className="text-[#1dff00] font-semibold">{totalApps}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#ffffff80]">Interviews</span>
                      <span className="text-[#1dff00] font-semibold">{interviews}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#ffffff80]">Offers</span>
                      <span className="text-[#1dff00] font-semibold">{offers}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#ffffff80]">Success Rate</span>
                      <span className="text-[#1dff00] font-semibold">{successRate}%</span>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          </div>

          {/* Profile Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* About Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ scale: 1.01 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg hover:border-[#1dff00]/30 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">About</h3>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a] hover:scale-110 transition-all duration-300"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
                {profileLoading && !isEditing && profile === null ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                ) : isEditing ? (
                  <AboutEditor
                    profile={{
                      job_title: profile?.job_title ?? "",
                      location: profile?.location ?? "",
                      experience_years: profile?.experience_years ?? null,
                    }}
                    onCancel={() => setIsEditing(false)}
                    onSave={async (patch) => {
                      await updateProfile(patch as any);
                      setIsEditing(false);
                    }}
                  />
                ) : (
                  <>
                    {showAboutEmpty ? (
                      <EmptyState
                        icon={Lightbulb}
                        title="Tell Your Story"
                        description="Add your role, location and years of experience so recruiters immediately understand your professional narrative."
                        primaryAction={{ label: "Start Editing", onClick: () => setIsEditing(true) }}
                        secondaryChips={["Job Title", "Location", "Years", "Impact" ]}
                        tone="info"
                      />
                    ) : (
                      <p className="text-[#ffffff80] leading-relaxed">
                        Working as <span className="text-white font-medium">{profile?.job_title}</span>
                        {profile?.experience_years ? (
                          <> with <span className="text-white font-medium">{profile.experience_years}</span> years experience</>
                        ) : null}
                        {profile?.location ? (
                          <> in <span className="text-white font-medium">{profile.location}</span></>
                        ) : null}
                        .
                      </p>
                    )}
                  </>
                )}
              </Card>
            </motion.div>

            {/* Experience Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ scale: 1.01 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg hover:border-[#1dff00]/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <Briefcase className="w-5 h-5 mr-2 text-white" />
                    Experience
                  </h3>
                  <Button 
                    size="sm" 
                    className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
                    onClick={() => setShowAddExperience(v => !v)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {showAddExperience ? 'Close' : 'Add'}
                  </Button>
                </div>
                {showAddExperience && (
                  <div className="mb-4 space-y-2 p-4 bg-[#ffffff0a] rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input placeholder="Title" id="exp-title" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                      <input placeholder="Company" id="exp-company" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                      <input placeholder="Location" id="exp-location" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                      <div className="flex gap-2">
                        <input type="month" placeholder="Start" id="exp-start" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white flex-1 placeholder:text-[#ffffff60]" />
                        <input type="month" placeholder="End" id="exp-end" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white flex-1 placeholder:text-[#ffffff60]" />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-[#ffffff80]">
                        <input type="checkbox" id="exp-current" className="accent-[#1dff00]" /> Current Role
                      </label>
                      <textarea placeholder="Description" id="exp-desc" rows={2} className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60] col-span-full resize-none" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]"
                        onClick={() => setShowAddExperience(false)}>Cancel</Button>
                      <Button size="sm" className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                        onClick={() => {
                          const title = (document.getElementById('exp-title') as HTMLInputElement)?.value.trim();
                          if (!title) return;
                          addExperience({
                            title,
                            company: (document.getElementById('exp-company') as HTMLInputElement)?.value.trim(),
                            location: (document.getElementById('exp-location') as HTMLInputElement)?.value.trim(),
                            start_date: (document.getElementById('exp-start') as HTMLInputElement)?.value ? (document.getElementById('exp-start') as HTMLInputElement).value + '-01' : new Date().toISOString(),
                            end_date: (document.getElementById('exp-current') as HTMLInputElement)?.checked ? null : ((document.getElementById('exp-end') as HTMLInputElement)?.value ? (document.getElementById('exp-end') as HTMLInputElement).value + '-01' : null),
                            is_current: (document.getElementById('exp-current') as HTMLInputElement)?.checked,
                            description: (document.getElementById('exp-desc') as HTMLTextAreaElement)?.value.trim(),
                          });
                          setShowAddExperience(false);
                        }}>Save</Button>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  {experiences.loading && (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="border-l-2 border-[#1dff00] pl-4 pb-4 relative p-3 rounded-r-lg">
                          <Skeleton className="absolute -left-2 top-3 w-4 h-4 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-32" />
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-3 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!experiences.loading && experiences.error && (
                    <p className="text-sm text-red-400">{experiences.error}</p>
                  )}
                  {!experiences.loading && !experiences.error && experiences.data.length === 0 && (
                    <EmptyState
                      icon={Briefcase}
                      title="Add Your First Role"
                      description="Showcase achievements, scope and measurable results. Strong experience entries boost credibility."
                      primaryAction={{ label: "Add Experience", onClick: () => setShowAddExperience(true) }}
                      secondaryChips={["Leadership", "Ownership", "Impact", "Growth"]}
                      tone="primary"
                    />
                  )}
                  {experiences.data.map((exp: TProfileExperience, index: number) => (
                    <motion.div
                      key={exp.id}
                      className="border-l-2 border-[#1dff00] pl-4 pb-4 relative hover:bg-[#ffffff0a] p-3 rounded-r-lg transition-all duration-300"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ x: 4 }}
                    >
                      <div className="absolute -left-2 top-3 w-4 h-4 bg-[#1dff00] rounded-full"></div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-white font-semibold">{exp.title}</h4>
                          <p className="text-white font-medium">{exp.company}</p>
                          <p className="text-[#ffffff60] text-sm flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {exp.location}
                          </p>
                          <p className="text-[#ffffff60] text-sm flex items-center mt-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            {exp.start_date?.slice(0,7)} - {exp.is_current ? "Present" : (exp.end_date ? exp.end_date.slice(0,7) : '')}
                          </p>
                          <p className="text-[#ffffff80] text-sm mt-2 leading-relaxed">{exp.description}</p>
                        </div>
                        <div className="flex space-x-1 ml-4">
                          {editingExpId === exp.id ? null : (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-[#ffffff60] hover:text-white hover:scale-110 transition-all duration-300 p-1"
                              onClick={() => setEditingExpId(exp.id)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-[#ffffff60] hover:text-red-400 hover:scale-110 transition-all duration-300 p-1"
                            onClick={() => deleteExperience(exp.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {editingExpId === exp.id && (
                        <div className="mt-3 p-3 bg-[#ffffff10] rounded-lg space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input defaultValue={exp.title} id={`exp-edit-title-${exp.id}`} placeholder="Title" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                            <input defaultValue={exp.company} id={`exp-edit-company-${exp.id}`} placeholder="Company" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                            <input defaultValue={exp.location} id={`exp-edit-location-${exp.id}`} placeholder="Location" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                            <div className="flex gap-2">
                              <input type="month" defaultValue={(exp.start_date || '').slice(0,7)} id={`exp-edit-start-${exp.id}`} className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white flex-1 placeholder:text-[#ffffff60]" />
                              <input type="month" defaultValue={exp.end_date ? exp.end_date.slice(0,7) : ''} id={`exp-edit-end-${exp.id}`} className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white flex-1 placeholder:text-[#ffffff60]" />
                            </div>
                            <label className="flex items-center gap-2 text-xs text-[#ffffff80]">
                              <input type="checkbox" defaultChecked={!!exp.is_current} id={`exp-edit-current-${exp.id}`} className="accent-[#1dff00]" /> Current Role
                            </label>
                            <textarea defaultValue={exp.description || ''} id={`exp-edit-desc-${exp.id}`} rows={2} placeholder="Description" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60] col-span-full resize-none" />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]" onClick={() => setEditingExpId(null)}>Cancel</Button>
                            <Button size="sm" className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90" onClick={async () => {
                              await updateExperience(exp.id, {
                                title: (document.getElementById(`exp-edit-title-${exp.id}`) as HTMLInputElement)?.value.trim(),
                                company: (document.getElementById(`exp-edit-company-${exp.id}`) as HTMLInputElement)?.value.trim(),
                                location: (document.getElementById(`exp-edit-location-${exp.id}`) as HTMLInputElement)?.value.trim(),
                                start_date: (document.getElementById(`exp-edit-start-${exp.id}`) as HTMLInputElement)?.value ? (document.getElementById(`exp-edit-start-${exp.id}`) as HTMLInputElement).value + '-01' : exp.start_date,
                                end_date: (document.getElementById(`exp-edit-current-${exp.id}`) as HTMLInputElement)?.checked ? null : ((document.getElementById(`exp-edit-end-${exp.id}`) as HTMLInputElement)?.value ? (document.getElementById(`exp-edit-end-${exp.id}`) as HTMLInputElement).value + '-01' : exp.end_date),
                                is_current: (document.getElementById(`exp-edit-current-${exp.id}`) as HTMLInputElement)?.checked,
                                description: (document.getElementById(`exp-edit-desc-${exp.id}`) as HTMLTextAreaElement)?.value.trim(),
                              } as any);
                              setEditingExpId(null);
                            }}>Save</Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Education Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              whileHover={{ scale: 1.01 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg hover:border-[#1dff00]/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <GraduationCap className="w-5 h-5 mr-2 text-white" />
                    Education
                  </h3>
                  <Button 
                    size="sm" 
                    className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
                    onClick={() => setShowAddEducation(v => !v)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {showAddEducation ? 'Close' : 'Add'}
                  </Button>
                </div>
                {showAddEducation && (
                  <div className="mb-4 space-y-2 p-4 bg-[#ffffff0a] rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input placeholder="Degree" id="edu-degree" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                      <input placeholder="School" id="edu-school" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                      <input placeholder="Location" id="edu-location" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                      <div className="flex gap-2">
                        <input type="month" placeholder="Start" id="edu-start" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white flex-1 placeholder:text-[#ffffff60]" />
                        <input type="month" placeholder="End" id="edu-end" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white flex-1 placeholder:text-[#ffffff60]" />
                      </div>
                      <input placeholder="GPA" id="edu-gpa" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]" onClick={() => setShowAddEducation(false)}>Cancel</Button>
                      <Button size="sm" className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90" onClick={() => {
                        const degree = (document.getElementById('edu-degree') as HTMLInputElement)?.value.trim();
                        const school = (document.getElementById('edu-school') as HTMLInputElement)?.value.trim();
                        if (!degree || !school) return;
                        addEducation({
                          degree,
                          school,
                          location: (document.getElementById('edu-location') as HTMLInputElement)?.value.trim(),
                          start_date: (document.getElementById('edu-start') as HTMLInputElement)?.value ? (document.getElementById('edu-start') as HTMLInputElement).value + '-01' : new Date().toISOString(),
                          end_date: (document.getElementById('edu-end') as HTMLInputElement)?.value ? (document.getElementById('edu-end') as HTMLInputElement).value + '-01' : null,
                          gpa: (document.getElementById('edu-gpa') as HTMLInputElement)?.value.trim() || null,
                        });
                        setShowAddEducation(false);
                      }}>Save</Button>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  {education.loading && (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="border-l-2 border-[#1dff00] pl-4 pb-4 relative p-3 rounded-r-lg">
                          <Skeleton className="absolute -left-2 top-3 w-4 h-4 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-52" />
                            <Skeleton className="h-3 w-40" />
                            <Skeleton className="h-3 w-28" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!education.loading && education.error && (
                    <p className="text-sm text-red-400">{education.error}</p>
                  )}
                  {!education.loading && !education.error && education.data.length === 0 && (
                    <EmptyState
                      icon={GraduationCap}
                      title="Add Education"
                      description="Highlight academic credentials, specializations and recognitions that support your expertise."
                      primaryAction={{ label: "Add Education", onClick: () => setShowAddEducation(true) }}
                      secondaryChips={["Degree", "School", "GPA", "Honors"]}
                      tone="warning"
                    />
                  )}
                  {education.data.map((edu: TProfileEducation, index: number) => (
                    <motion.div
                      key={edu.id}
                      className="border-l-2 border-[#1dff00] pl-4 pb-4 relative hover:bg-[#ffffff0a] p-3 rounded-r-lg transition-all duration-300"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ x: 4 }}
                    >
                      <div className="absolute -left-2 top-3 w-4 h-4 bg-[#1dff00] rounded-full"></div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-white font-semibold">{edu.degree}</h4>
                          <p className="text-white font-medium">{edu.school}</p>
                          <p className="text-[#ffffff60] text-sm flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {edu.location}
                          </p>
                          <p className="text-[#ffffff60] text-sm flex items-center mt-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            {edu.start_date?.slice(0,7)} - {edu.end_date?.slice(0,7)}
                          </p>
                          {edu.gpa && (
                            <p className="text-[#ffffff80] text-sm mt-1">GPA: {edu.gpa}</p>
                          )}
                        </div>
                        <div className="flex space-x-1 ml-4">
                          {editingEduId === edu.id ? null : (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-[#ffffff60] hover:text-white hover:scale-110 transition-all duration-300 p-1"
                              onClick={() => setEditingEduId(edu.id)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-[#ffffff60] hover:text-red-400 hover:scale-110 transition-all duration-300 p-1"
                            onClick={() => deleteEducation(edu.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {editingEduId === edu.id && (
                        <div className="mt-3 p-3 bg-[#ffffff10] rounded-lg space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input defaultValue={edu.degree} id={`edu-edit-degree-${edu.id}`} placeholder="Degree" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                            <input defaultValue={edu.school} id={`edu-edit-school-${edu.id}`} placeholder="School" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                            <input defaultValue={edu.location} id={`edu-edit-location-${edu.id}`} placeholder="Location" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                            <div className="flex gap-2">
                              <input type="month" defaultValue={(edu.start_date || '').slice(0,7)} id={`edu-edit-start-${edu.id}`} className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white flex-1 placeholder:text-[#ffffff60]" />
                              <input type="month" defaultValue={edu.end_date ? edu.end_date.slice(0,7) : ''} id={`edu-edit-end-${edu.id}`} className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white flex-1 placeholder:text-[#ffffff60]" />
                            </div>
                            <input defaultValue={edu.gpa || ''} id={`edu-edit-gpa-${edu.id}`} placeholder="GPA" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]" onClick={() => setEditingEduId(null)}>Cancel</Button>
                            <Button size="sm" className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90" onClick={async () => {
                              await updateEducation(edu.id, {
                                degree: (document.getElementById(`edu-edit-degree-${edu.id}`) as HTMLInputElement)?.value.trim(),
                                school: (document.getElementById(`edu-edit-school-${edu.id}`) as HTMLInputElement)?.value.trim(),
                                location: (document.getElementById(`edu-edit-location-${edu.id}`) as HTMLInputElement)?.value.trim(),
                                start_date: (document.getElementById(`edu-edit-start-${edu.id}`) as HTMLInputElement)?.value ? (document.getElementById(`edu-edit-start-${edu.id}`) as HTMLInputElement).value + '-01' : edu.start_date,
                                end_date: (document.getElementById(`edu-edit-end-${edu.id}`) as HTMLInputElement)?.value ? (document.getElementById(`edu-edit-end-${edu.id}`) as HTMLInputElement).value + '-01' : edu.end_date,
                                gpa: (document.getElementById(`edu-edit-gpa-${edu.id}`) as HTMLInputElement)?.value.trim() || null,
                              } as any);
                              setEditingEduId(null);
                            }}>Save</Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Skills Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              whileHover={{ scale: 1.01 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg hover:border-[#1dff00]/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <Award className="w-5 h-5 mr-2 text-white" />
                    Skills
                  </h3>
                  <Button 
                    size="sm" 
                    className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
                    onClick={() => setShowAddSkill(v => !v)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {showAddSkill ? 'Close' : 'Add'}
                  </Button>
                </div>
                {showAddSkill && (
                  <div className="mb-4 space-y-2 p-4 bg-[#ffffff0a] rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input placeholder="Name" id="skill-name" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60] md:col-span-2" />
                      <select id="skill-level" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white md:col-span-1">
                        <option value="">Level</option>
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                        <option value="Expert">Expert</option>
                      </select>
                      <input placeholder="Category" id="skill-category" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60] md:col-span-1" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]" onClick={() => setShowAddSkill(false)}>Cancel</Button>
                      <Button size="sm" className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90" onClick={() => {
                        const name = (document.getElementById('skill-name') as HTMLInputElement)?.value.trim();
                        if (!name) return;
                        addSkill({
                          name,
                          level: (document.getElementById('skill-level') as HTMLSelectElement)?.value as any || null,
                          category: (document.getElementById('skill-category') as HTMLInputElement)?.value.trim(),
                        });
                        setShowAddSkill(false);
                      }}>Save</Button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {skills.loading && (
                    <>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="space-y-2 p-3 bg-[#ffffff0a] rounded-lg col-span-1 md:col-span-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-2 w-full" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      ))}
                    </>
                  )}
                  {!skills.loading && skills.error && (
                    <p className="text-sm text-red-400 col-span-full">{skills.error}</p>
                  )}
                  {!skills.loading && !skills.error && skills.data.length === 0 && (
                    <div className="col-span-full"><EmptyState
                      icon={Award}
                      title="Show Your Skill Stack"
                      description="Add technical and soft skills. Choose realistic proficiency levels for credibility."
                      primaryAction={{ label: "Add Skill", onClick: () => setShowAddSkill(true) }}
                      secondaryChips={["React", "TypeScript", "DB Design", "Leadership", "Problem Solving"]}
                      tone="success"
                    /></div>
                  )}
                  {skills.data.map((skill: TProfileSkill, index: number) => (
                    <motion.div
                      key={skill.id}
                      className="space-y-2 p-3 bg-[#ffffff0a] rounded-lg hover:bg-[#ffffff15] transition-all duration-300"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="flex items-center justify-between">
                        {editingSkillId === skill.id ? (
                          <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input defaultValue={skill.name} id={`skill-edit-name-${skill.id}`} placeholder="Name" className="bg-[#ffffff1a] px-2 py-1 rounded text-xs text-white placeholder:text-[#ffffff60] md:col-span-2" />
                            <select defaultValue={skill.level || ''} id={`skill-edit-level-${skill.id}`} className="bg-[#ffffff1a] px-2 py-1 rounded text-xs text-white md:col-span-1">
                              <option value="">Level</option>
                              <option value="Beginner">Beginner</option>
                              <option value="Intermediate">Intermediate</option>
                              <option value="Advanced">Advanced</option>
                              <option value="Expert">Expert</option>
                            </select>
                            <input defaultValue={skill.category} id={`skill-edit-category-${skill.id}`} placeholder="Category" className="bg-[#ffffff1a] px-2 py-1 rounded text-xs text-white placeholder:text-[#ffffff60] md:col-span-1" />
                          </div>
                        ) : (
                          <>
                            <span className="text-white font-medium text-sm">{skill.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[#ffffff60] text-xs">{skill.level}</span>
                              <button
                                className="text-[#ffffff60] hover:text-white transition-colors text-xs"
                                onClick={() => setEditingSkillId(skill.id)}
                                aria-label="Edit skill"
                                title="Edit"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                className="text-[#ffffff60] hover:text-red-400 transition-colors text-xs"
                                onClick={() => deleteSkill(skill.id)}
                                aria-label="Delete skill"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      {editingSkillId === skill.id ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]"
                            onClick={() => setEditingSkillId(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90" onClick={async () => {
                            await updateSkill(skill.id, {
                              name: (document.getElementById(`skill-edit-name-${skill.id}`) as HTMLInputElement)?.value.trim(),
                              level: ((document.getElementById(`skill-edit-level-${skill.id}`) as HTMLSelectElement)?.value || null) as any,
                              category: (document.getElementById(`skill-edit-category-${skill.id}`) as HTMLInputElement)?.value.trim(),
                            } as any);
                            setEditingSkillId(null);
                          }}>Save</Button>
                        </div>
                      ) : (
                        <>
                          <div className="w-full bg-[#ffffff20] rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-500 ${getSkillLevelColor(skill.level || '')} ${getSkillLevelWidth(skill.level || '')}`}
                            ></div>
                          </div>
                          <span className="text-[#ffffff60] text-xs">{skill.category}</span>
                        </>
                      )}
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Lightweight About editor component (inline to keep file scoped)
function AboutEditor({ profile, onSave, onCancel }: { profile: { job_title: string; location: string; experience_years: number | null }; onSave: (p: { job_title: string; location: string | null; experience_years: number | null }) => Promise<void> | void; onCancel: () => void; }) {
  const [jobTitle, setJobTitle] = useState(profile.job_title);
  const [location, setLocation] = useState(profile.location || "");
  const [years, setYears] = useState<string>(profile.experience_years != null ? String(profile.experience_years) : "");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Job title" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
        <input value={years} onChange={(e) => setYears(e.target.value)} placeholder="Years experience" inputMode="numeric" className="bg-[#ffffff1a] px-3 py-2 rounded text-sm text-white placeholder:text-[#ffffff60]" />
      </div>
      <div className="flex space-x-2">
        <Button 
          size="sm" 
          className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
          onClick={() => onSave({ job_title: jobTitle.trim(), location: location.trim() || null, experience_years: years ? Number(years) : null })}
        >
          Save
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:scale-105 transition-all duration-300"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default ProfilePage;