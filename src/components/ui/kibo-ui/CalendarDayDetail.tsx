"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarDays, Briefcase, Clock, Building2 } from 'lucide-react';
import MatchScoreBadge from '../../jobs/MatchScoreBadge';
import { ApplicationRecord } from '../../../hooks/useApplications';

export interface CalendarDayDetailProps {
  date: Date | null;
  onClose: () => void;
  applications: ApplicationRecord[];
  onUpdateApplication?: (id: string, patch: Partial<ApplicationRecord>) => Promise<void> | void;
}


const ALL_STATUSES: ApplicationRecord['status'][] = ["Pending","Applied","Interview","Offer","Rejected","Withdrawn"];

export const CalendarDayDetail: React.FC<CalendarDayDetailProps> = ({ date, onClose, applications, onUpdateApplication }) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [activeStatuses, setActiveStatuses] = useState<Record<string, boolean>>(() => Object.fromEntries(ALL_STATUSES.map(s => [s, true])));
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [qaJob, setQaJob] = useState('');
  const [qaCompany, setQaCompany] = useState('');
  const [qaStatus, setQaStatus] = useState<ApplicationRecord['status']>('Applied');
  const [qaSaving, setQaSaving] = useState(false);

  const toggleStatus = (s: string) => {
    setActiveStatuses(prev => ({ ...prev, [s]: !prev[s] }));
  };

  // Load persisted filters
  useEffect(() => {
    try {
      const raw = localStorage.getItem('calendar_day_filters');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setActiveStatuses(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Reset ephemeral UI when date changes
    setCopyState('idle');
    setQuickAddOpen(false);
  }, [date]);

  // Persist filters when they change
  useEffect(() => {
    try { localStorage.setItem('calendar_day_filters', JSON.stringify(activeStatuses)); } catch {}
  }, [activeStatuses]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    if (date) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [date, onClose]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (overlayRef.current && e.target instanceof Node && overlayRef.current === e.target) {
        onClose();
      }
    }
    if (date) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [date, onClose]);

  const { dayApplications, interviews, statusCounts, topCompanies } = useMemo(() => {
    if (!date) return { dayApplications: [], interviews: [], statusCounts: {}, topCompanies: [] as string[] };
    const key = date.toISOString().slice(0,10);
    const dayApplications = applications.filter(a => {
      try { return a.applied_date.slice(0,10) === key; } catch { return false; }
    });
    const interviews = applications.filter(a => {
      if (!a.interview_date) return false; 
      try { return a.interview_date.slice(0,10) === key; } catch { return false; }
    });
    const statusCounts: Record<string, number> = {};
    dayApplications.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });
    const companyMap: Record<string, number> = {};
    dayApplications.forEach(a => { if (a.company) companyMap[a.company] = (companyMap[a.company] || 0) + 1; });
    const topCompanies = Object.entries(companyMap).sort((a,b) => b[1]-a[1]).slice(0,5).map(e => e[0]);
    return { dayApplications, interviews, statusCounts, topCompanies };
  }, [date, applications]);

  const total = Object.values(statusCounts).reduce((a,b) => a + b, 0);

  const filteredApplications = dayApplications.filter(a => activeStatuses[a.status] !== false);
  const filteredInterviews = interviews.filter(a => activeStatuses[a.status] !== false);

  const copySummary = async () => {
    if (!date) return;
    try {
      const lines: string[] = [];
      lines.push(`Date: ${date.toDateString()}`);
      lines.push(`Total applications: ${filteredApplications.length}`);
      const counts: Record<string, number> = {};
      filteredApplications.forEach(a => { counts[a.status] = (counts[a.status]||0)+1; });
      Object.entries(counts).forEach(([s,c]) => lines.push(`${s}: ${c}`));
      if (filteredInterviews.length) lines.push(`Interviews: ${filteredInterviews.length}`);
      lines.push('--- Applications ---');
      filteredApplications.slice(0,50).forEach(a => {
        lines.push(`${a.job_title} @ ${a.company} [${a.status}]${typeof a.match_score==='number' ? ` (${a.match_score}%)` : ''}`);
      });
      const text = lines.join('\n');
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2500);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 3000);
    }
  };

  const cycleStatus = (a: ApplicationRecord) => {
    if (!onUpdateApplication) return;
    const order = ALL_STATUSES;
    const idx = order.indexOf(a.status);
    const next = order[(idx + 1) % order.length];
    onUpdateApplication(a.id, { status: next });
  };

  const exportDayCSV = () => {
    if (!date) return;
    const headers = ['job_title','company','status','applied_date','interview_date','match_score'];
    const rows = filteredApplications.map(a => [a.job_title, a.company, a.status, a.applied_date, a.interview_date||'', (a.match_score??'')]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `applications-${date.toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleQuickAdd = async () => {
    if (!onUpdateApplication) return; // create not provided
    if (!qaJob.trim() || !qaCompany.trim()) return;
    if (!(window as any).supabaseCreateApplication) return; // injection hook later if needed
    try {
      setQaSaving(true);
      const createFn = (window as any).supabaseCreateApplication as (input: any)=>Promise<any>;
      await createFn({ job_title: qaJob.trim(), company: qaCompany.trim(), status: qaStatus, applied_date: date?.toISOString() });
      setQaJob(''); setQaCompany('');
    } finally {
      setQaSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {date && (
        <motion.div
          ref={overlayRef}
          key="calendar-day-detail"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 160, damping: 18 }}
            className="relative w-full max-w-3xl rounded-2xl border border-[#1dff00]/30 bg-gradient-to-br from-[#0b0b0b] via-[#111111] to-[#050505] shadow-2xl p-6 overflow-hidden"
          >
            <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: 'radial-gradient(circle at 30% 20%, rgba(29,255,0,0.08), transparent 60%)' }} />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full border border-white/10 text-white/70 hover:text-[#1dff00] hover:border-[#1dff00]/40 hover:bg-[#1dff00]/10 transition"
              aria-label="Close detail"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-[#1dff00]" />
                    {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h2>
                  <p className="text-xs text-[#888] mt-1">{total} application{total === 1 ? '' : 's'} • {interviews.length} interview{interviews.length === 1 ? '' : 's'}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-wrap gap-2 justify-end max-w-[320px]">
                    {ALL_STATUSES.map(s => {
                      const count = statusCounts[s] || 0;
                      const active = activeStatuses[s] !== false;
                      return (
                        <button
                          key={s}
                          onClick={() => toggleStatus(s)}
                          className={`px-2 py-1 rounded-full text-[10px] font-medium border transition ${active ? 'border-[#1dff00]/40 bg-[#1dff00]/10 text-[#1dff00]' : 'border-white/10 bg-white/5 text-white/40 line-through'}`}
                          aria-pressed={active}
                        >
                          {s}{count ? `:${count}` : ''}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copySummary}
                      className="text-[10px] px-3 py-1 rounded border border-[#1dff00]/30 bg-[#1dff00]/10 text-[#1dff00] hover:border-[#1dff00]/60 hover:bg-[#1dff00]/20 transition"
                    >
                      {copyState === 'idle' && 'Copy Summary'}
                      {copyState === 'copied' && 'Copied!'}
                      {copyState === 'error' && 'Copy Failed'}
                    </button>
                    <button
                      onClick={exportDayCSV}
                      className="text-[10px] px-3 py-1 rounded border border-white/10 bg-white/5 text-white/70 hover:text-[#1dff00] hover:border-[#1dff00]/40 hover:bg-[#1dff00]/10 transition"
                    >CSV</button>
                    <button
                      onClick={() => setQuickAddOpen(o=>!o)}
                      className="text-[10px] px-3 py-1 rounded border border-[#1dff00]/30 bg-[#1dff00]/5 text-[#1dff00] hover:border-[#1dff00]/60 hover:bg-[#1dff00]/15 transition"
                    >{quickAddOpen ? 'Close' : 'Quick Add'}</button>
                  </div>
                </div>
              </div>

              {quickAddOpen && (
                <div className="mb-6 p-4 rounded-xl border border-white/10 bg-white/[0.04] flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      placeholder="Job title"
                      value={qaJob}
                      onChange={e=>setQaJob(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#1dff00]/50"
                    />
                    <input
                      placeholder="Company"
                      value={qaCompany}
                      onChange={e=>setQaCompany(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#1dff00]/50"
                    />
                    <select
                      value={qaStatus}
                      onChange={e=>setQaStatus(e.target.value as any)}
                      className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#1dff00]/50"
                    >
                      {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <button
                      disabled={qaSaving || !qaJob.trim() || !qaCompany.trim()}
                      onClick={handleQuickAdd}
                      className="text-[11px] px-4 py-2 rounded-md border border-[#1dff00]/40 bg-[#1dff00]/15 text-[#1dff00] hover:bg-[#1dff00]/25 hover:border-[#1dff00]/60 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
                    >{qaSaving ? 'Saving...' : 'Add'}</button>
                  </div>
                  <p className="text-[10px] text-white/40">Quick add uses the selected day as applied date. (Creation relies on injected create function.)</p>
                </div>
              )}

              {topCompanies.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Building2 className="w-4 h-4 text-[#1dff00]" /> Companies</h3>
                  <div className="flex flex-wrap gap-2">
                    {topCompanies.map(c => (
                      <span key={c} className="px-2 py-1 text-[11px] rounded border border-[#1dff00]/20 text-white/80 bg-[#1dff00]/5 hover:border-[#1dff00]/50 hover:bg-[#1dff00]/10 transition">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Interviews */}
              {filteredInterviews.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-[#1dff00]" /> Interviews</h3>
                  <div className="space-y-2">
                    {filteredInterviews.map(a => (
                      <div key={a.id} className="group p-3 rounded-xl border border-[#1dff00]/20 bg-[#1dff00]/5 hover:border-[#1dff00]/50 hover:bg-[#1dff00]/10 transition flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#1dff00]/15 border border-[#1dff00]/30 flex items-center justify-center text-[#1dff00] font-bold text-xs">
                          {(a.company||'')[0] || '•'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-white text-sm font-medium truncate">{a.job_title}</div>
                          <div className="text-[#ffffff70] text-[11px] truncate">{a.company}</div>
                          <div className="text-[#1dff00] text-[11px] mt-1">{new Date(a.interview_date as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        {typeof a.match_score === 'number' && <MatchScoreBadge score={a.match_score} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Applications */}
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Briefcase className="w-4 h-4 text-[#1dff00]" /> Applications ({filteredApplications.length})</h3>
              </div>
                {filteredApplications.length > 0 ? (
                <div className="grid gap-2 max-h-72 overflow-auto pr-1 styled-scroll">
                    {filteredApplications.map(a => (
                      <div key={a.id} className="p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#1dff00]/40 transition flex items-center gap-3 group">
                      <div className="w-10 h-10 rounded-xl bg-[#1dff00]/10 border border-[#1dff00]/30 flex items-center justify-center text-[#1dff00] font-bold text-xs">
                        {(a.company||'')[0] || '•'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-white text-sm font-medium truncate" title={a.job_title}>{a.job_title}</div>
                        <div className="text-[#ffffff70] text-[11px] truncate">{a.company}</div>
                        <div className="mt-1 flex items-center gap-2 text-[10px]">
                          <span className="px-1.5 py-0.5 rounded border border-[#1dff00]/30 bg-[#1dff00]/10 text-[#1dff00] font-medium">{a.status}</span>
                          {a.location && <span className="text-white/40 truncate max-w-[120px]">{a.location}</span>}
                            {onUpdateApplication && (
                              <button
                                onClick={() => cycleStatus(a)}
                                className="opacity-0 group-hover:opacity-100 transition text-[10px] px-2 py-0.5 rounded border border-white/10 hover:border-[#1dff00]/40 hover:text-[#1dff00]"
                                title="Cycle status"
                              >↻</button>
                            )}
                        </div>
                      </div>
                      {typeof a.match_score === 'number' && <MatchScoreBadge score={a.match_score} />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 border border-dashed border-white/10 rounded-xl text-center text-white/60 text-sm">No applications on this day.</div>
              )}

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CalendarDayDetail;
