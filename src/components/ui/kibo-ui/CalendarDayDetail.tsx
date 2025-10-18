"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarDays, Briefcase, Clock, Building2, BellPlus } from 'lucide-react';
import MatchScoreBadge from '../../jobs/MatchScoreBadge';
import { ApplicationRecord } from '../../../hooks/useApplications';

export interface CalendarDayDetailProps {
  date: Date | null;
  range?: { start: Date; end: Date } | null;
  onClose: () => void;
  applications: ApplicationRecord[];
  onUpdateApplication?: (id: string, patch: Partial<ApplicationRecord>) => Promise<void> | void;
  onCreateApplication?: (input: Partial<ApplicationRecord> & { job_title: string; company: string }) => Promise<any> | any;
}


const ALL_STATUSES: ApplicationRecord['status'][] = ["Pending","Applied","Interview","Offer","Rejected","Withdrawn"];

export const CalendarDayDetail: React.FC<CalendarDayDetailProps> = ({ date, range, onClose, applications, onUpdateApplication, onCreateApplication }) => {
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

  const active = !!date || !!range;
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    if (active) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (overlayRef.current && e.target instanceof Node && overlayRef.current === e.target) {
        onClose();
      }
    }
    if (active) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [active, onClose]);

  const { dayApplications, interviews, statusCounts, topCompanies, rangeApplications } = useMemo(() => {
    if (range) {
      const s = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
      const e = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), 23,59,59,999);
      const rangeApplications = applications.filter(a => {
        const d = new Date(a.applied_date);
        return d >= s && d <= e;
      });
      const interviews = rangeApplications.filter(a => a.interview_date && (() => { const d = new Date(a.interview_date as string); return d >= s && d <= e; })());
      const statusCounts: Record<string, number> = {};
      rangeApplications.forEach(a => { statusCounts[a.status] = (statusCounts[a.status]||0)+1; });
      const companyMap: Record<string, number> = {};
      rangeApplications.forEach(a => { if (a.company) companyMap[a.company] = (companyMap[a.company]||0)+1; });
      const topCompanies = Object.entries(companyMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]);
      return { dayApplications: [], interviews, statusCounts, topCompanies, rangeApplications };
    }
    if (!date) return { dayApplications: [], interviews: [], statusCounts: {}, topCompanies: [], rangeApplications: [] };
    const key = date.toISOString().slice(0,10);
    const dayApplications = applications.filter(a => { try { return a.applied_date.slice(0,10) === key; } catch { return false; } });
    const interviews = applications.filter(a => { if (!a.interview_date) return false; try { return a.interview_date.slice(0,10) === key; } catch { return false; } });
    const statusCounts: Record<string, number> = {};
    dayApplications.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });
    const companyMap: Record<string, number> = {};
    dayApplications.forEach(a => { if (a.company) companyMap[a.company] = (companyMap[a.company] || 0) + 1; });
    const topCompanies = Object.entries(companyMap).sort((a,b) => b[1]-a[1]).slice(0,5).map(e => e[0]);
    return { dayApplications, interviews, statusCounts, topCompanies, rangeApplications: [] };
  }, [date, range, applications]);


  const baseApps = range ? rangeApplications : dayApplications;
  const filteredApplications = baseApps.filter(a => activeStatuses[a.status] !== false);
  const filteredInterviews = interviews.filter(a => activeStatuses[a.status] !== false);

  // Sparkline (last 7 days or range span up to 14 days) using application counts
  const sparkline = useMemo(() => {
    const points: number[] = [];
    const labels: string[] = [];
    const refDate = date || range?.end || new Date();
    const days = range ? Math.min(14, Math.ceil((range.end.getTime()-range.start.getTime())/86400000)+1) : 7;
    for (let i = days -1; i >=0; i--) {
      const d = new Date(refDate as Date);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0,10);
      const count = applications.filter(a => a.applied_date.slice(0,10) === key).length;
      points.push(count);
      labels.push(key.slice(5));
    }
    const max = Math.max(1, ...points);
    const path = points.map((v,i) => {
      const x = (i / (points.length -1)) * 100;
      const y = 100 - (v / max) * 100;
      return `${i===0?'M':'L'}${x},${y}`;
    }).join(' ');
    return { path, points, labels, max };
  }, [applications, date, range]);

  // Match score distribution buckets
  const scoreBuckets = useMemo(() => {
    const buckets = [0,0,0,0]; // 0-24,25-49,50-74,75-100
    filteredApplications.forEach(a => {
      if (typeof a.match_score !== 'number') return;
      const s = a.match_score;
      if (s < 25) buckets[0]++; else if (s < 50) buckets[1]++; else if (s < 75) buckets[2]++; else buckets[3]++;
    });
    const total = buckets.reduce((a,b)=>a+b,0) || 1;
    return { buckets, total };
  }, [filteredApplications]);

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
    if (!onCreateApplication) return;
    if (!qaJob.trim() || !qaCompany.trim()) return;
    try {
      setQaSaving(true);
      await onCreateApplication({ job_title: qaJob.trim(), company: qaCompany.trim(), status: qaStatus as any, applied_date: (date||range?.start|| new Date()).toISOString() });
      setQaJob(''); setQaCompany('');
    } finally { setQaSaving(false); }
  };

  return (
    <AnimatePresence>
      {active && (
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
            className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-[#1dff00]/30 bg-gradient-to-br from-[#0b0b0b] via-[#111111] to-[#050505] shadow-2xl p-6 flex flex-col"
          >
            <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: 'radial-gradient(circle at 30% 20%, rgba(29,255,0,0.08), transparent 60%)' }} />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full border border-white/10 text-white/70 hover:text-[#1dff00] hover:border-[#1dff00]/40 hover:bg-[#1dff00]/10 transition"
              aria-label="Close detail"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="relative z-10 flex-1 overflow-y-auto pr-1 custom-scroll">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-[#1dff00]" />
                    {range ? `${range.start.toLocaleDateString(undefined,{ month:'short', day:'numeric'})} → ${range.end.toLocaleDateString(undefined,{ month:'short', day:'numeric', year:'numeric'})}` : date?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h2>
                  <p className="text-xs text-[#888] mt-1">{filteredApplications.length} application{filteredApplications.length === 1 ? '' : 's'} • {filteredInterviews.length} interview{filteredInterviews.length === 1 ? '' : 's'}</p>
                  <div className="mt-3">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-8">
                      <path d={sparkline.path} fill="none" stroke="#1dff00" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                      {sparkline.points.map((v,i)=>{
                        const x = (i/(sparkline.points.length-1))*100;
                        const y = 100 - (v/ (sparkline.max||1))*100;
                        return <circle key={i} cx={x} cy={y} r={1.8} fill="#1dff00" />;
                      })}
                    </svg>
                  </div>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2">
                  <div className="flex flex-wrap gap-2 justify-start sm:justify-end max-w-full sm:max-w-[320px]">
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
                          <button
                            className="opacity-0 group-hover:opacity-100 transition text-[10px] px-2 py-0.5 rounded border border-white/10 hover:border-[#1dff00]/40 hover:text-[#1dff00]"
                            title="Add follow-up reminder"
                            onClick={() => {
                              if (!onUpdateApplication) return;
                              const followup = prompt('Enter follow-up note (saved to next_step)');
                              if (followup) onUpdateApplication(a.id, { next_step: `Follow-up: ${followup}` });
                            }}
                          ><BellPlus className="w-3 h-3" /></button>
                        </div>
                      </div>
                      {typeof a.match_score === 'number' && <MatchScoreBadge score={a.match_score} />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 border border-dashed border-white/10 rounded-xl text-center text-white/60 text-sm">No applications on this day.</div>
              )}

              {/* Match Score Distribution */}
              <div className="mt-8 mb-4">
                <h3 className="text-sm font-semibold text-white mb-3">Match Score Distribution</h3>
                <div className="grid grid-cols-4 gap-3">
                  {['0-24','25-49','50-74','75-100'].map((label,i)=>{
                    const count = scoreBuckets.buckets[i];
                    const pct = Math.round((count / (scoreBuckets.total||1))*100);
                    return (
                      <div key={label} className="flex flex-col gap-1">
                        <div className="text-[10px] text-white/60">{label}</div>
                        <div className="h-6 rounded bg-white/5 border border-white/10 overflow-hidden relative">
                          <div style={{ width: pct+'%' }} className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#1dff00] to-[#0a8246]" />
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/80 font-medium">{count}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CalendarDayDetail;
