import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import type { Profile } from "../../../hooks/useProfileSettings";
import { Skeleton } from "../../../components/ui/skeleton";

export type WeeklyDaySlot = { start: string; end: string };
export type WeeklyAvailability = Record<string, WeeklyDaySlot[]>;
export type DateException = {
  id: string;
  date: string;
  unavailable: boolean;
  slots: WeeklyDaySlot[];
};

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"] as const;

const START_OPTIONS = [
  { value: "immediately", label: "Immediately" },
  { value: "two_weeks", label: "Within 2 weeks" },
  { value: "one_month", label: "Within 1 month" },
  { value: "flexible", label: "Flexible" },
  { value: "negotiating", label: "Depends on offer" },
] as const;

function defaultWeeklyTemplate(): WeeklyAvailability {
  const w: WeeklyAvailability = {};
  for (let i = 0; i < 7; i++) w[String(i)] = [];
  const slot: WeeklyDaySlot = { start: "09:00", end: "17:00" };
  for (const d of [1, 2, 3, 4, 5]) w[String(d)] = [{ ...slot }];
  return w;
}

function parseWeekly(raw: unknown): WeeklyAvailability {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaultWeeklyTemplate();
  }
  const o = raw as Record<string, unknown>;
  const out: WeeklyAvailability = {};
  let anyDay = false;
  for (let i = 0; i < 7; i++) {
    const key = String(i);
    const arr = o[key];
    if (Array.isArray(arr)) {
      const slots = arr
        .filter(
          (s): s is WeeklyDaySlot =>
            !!s &&
            typeof s === "object" &&
            typeof (s as WeeklyDaySlot).start === "string" &&
            typeof (s as WeeklyDaySlot).end === "string",
        )
        .map((s) => ({ start: s.start, end: s.end }));
      out[key] = slots;
      if (slots.length) anyDay = true;
    } else {
      out[key] = [];
    }
  }
  return anyDay ? out : defaultWeeklyTemplate();
}

function parseExceptions(raw: unknown): DateException[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row): DateException | null => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : crypto.randomUUID();
      const date = typeof r.date === "string" ? r.date : "";
      const unavailable = r.unavailable === true;
      const slotsRaw = r.slots;
      const slots: WeeklyDaySlot[] = Array.isArray(slotsRaw)
        ? slotsRaw
            .filter(
              (s): s is WeeklyDaySlot =>
                !!s &&
                typeof s === "object" &&
                typeof (s as WeeklyDaySlot).start === "string" &&
                typeof (s as WeeklyDaySlot).end === "string",
            )
            .map((s) => ({ start: s.start, end: s.end }))
        : [];
      if (!date) return null;
      return { id, date, unavailable, slots: unavailable ? [] : slots };
    })
    .filter((x): x is DateException => x !== null);
}

function useTimezoneOptions(): string[] {
  return useMemo(() => {
    try {
      const intl = globalThis.Intl as typeof globalThis.Intl & {
        supportedValuesOf?: (k: string) => string[];
      };
      if (typeof intl.supportedValuesOf === "function") {
        return intl.supportedValuesOf("timeZone").slice().sort();
      }
    } catch {
      /* ignore */
    }
    return [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "America/Phoenix",
      "Europe/London",
      "Europe/Paris",
      "Africa/Lagos",
      "Asia/Dubai",
      "Asia/Tokyo",
      "Australia/Sydney",
      "UTC",
    ];
  }, []);
}

function formatUpdated(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function ProfileAvailabilitySection({
  profile,
  loading,
  onSave,
}: {
  profile: Profile | null;
  loading: boolean;
  onSave: (patch: Partial<Profile>) => Promise<void>;
}): JSX.Element {
  const zones = useTimezoneOptions();

  const [availabilityStart, setAvailabilityStart] = useState<string>(
    profile?.availability_start || "",
  );
  const [hoursStr, setHoursStr] = useState<string>(() => {
    const h = profile?.preferred_weekly_hours;
    return h != null ? String(h) : "";
  });
  const [timezone, setTimezone] = useState<string>(
    profile?.work_timezone || "",
  );
  const [weekly, setWeekly] = useState<WeeklyAvailability>(() =>
    parseWeekly(profile?.weekly_availability),
  );
  const [exceptions, setExceptions] = useState<DateException[]>(() =>
    parseExceptions(profile?.availability_date_exceptions ?? null),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setAvailabilityStart(profile.availability_start || "");
    setHoursStr(
      profile.preferred_weekly_hours != null
        ? String(profile.preferred_weekly_hours)
        : "",
    );
    setTimezone(profile.work_timezone || "");
    setWeekly(parseWeekly(profile.weekly_availability));
    setExceptions(
      parseExceptions(profile.availability_date_exceptions ?? null),
    );
  }, [profile]);

  const missingFields = useMemo(() => {
    const list: string[] = [];
    if (!timezone.trim()) list.push("Time zone");
    if (
      !hoursStr.trim() ||
      Number.isNaN(Number(hoursStr)) ||
      Number(hoursStr) <= 0
    ) {
      list.push("Preferred weekly hours");
    }
    if (!availabilityStart) list.push("Availability to start");
    return list;
  }, [timezone, hoursStr, availabilityStart]);

  const dayEnabled = useCallback(
    (dayIndex: number) => (weekly[String(dayIndex)]?.length ?? 0) > 0,
    [weekly],
  );

  const setDaySlots = useCallback(
    (dayIndex: number, slots: WeeklyDaySlot[]) => {
      setWeekly((prev) => ({ ...prev, [String(dayIndex)]: slots }));
    },
    [],
  );

  const addSlot = (dayIndex: number) => {
    const cur = weekly[String(dayIndex)] ?? [];
    setDaySlots(dayIndex, [...cur, { start: "09:00", end: "17:00" }]);
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
    const cur = weekly[String(dayIndex)] ?? [];
    setDaySlots(
      dayIndex,
      cur.filter((_, i) => i !== slotIndex),
    );
  };

  const updateSlot = (
    dayIndex: number,
    slotIndex: number,
    patch: Partial<WeeklyDaySlot>,
  ) => {
    const cur = weekly[String(dayIndex)] ?? [];
    setDaySlots(
      dayIndex,
      cur.map((s, i) => (i === slotIndex ? { ...s, ...patch } : s)),
    );
  };

  const resetBusinessWeek = () => setWeekly(defaultWeeklyTemplate());

  const addException = () => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setExceptions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        date,
        unavailable: false,
        slots: [{ start: "09:00", end: "17:00" }],
      },
    ]);
  };

  const removeException = (id: string) => {
    setExceptions((prev) => prev.filter((e) => e.id !== id));
  };

  const updateException = (id: string, patch: Partial<DateException>) => {
    setExceptions((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  };

  const addExceptionSlot = (id: string) => {
    setExceptions((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, slots: [...e.slots, { start: "09:00", end: "17:00" }] }
          : e,
      ),
    );
  };

  const removeExceptionSlot = (id: string, idx: number) => {
    setExceptions((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, slots: e.slots.filter((_, i) => i !== idx) } : e,
      ),
    );
  };

  const handleSave = async () => {
    if (missingFields.length) return;
    const hoursNum = Math.round(Number(hoursStr));
    setSaving(true);
    try {
      await onSave({
        availability_start: availabilityStart || null,
        preferred_weekly_hours: hoursNum,
        work_timezone: timezone.trim() || null,
        weekly_availability: weekly,
        availability_date_exceptions: exceptions,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!profile && loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25 }}
        className='transition-transform duration-300'
      >
        <Card className='product-section-card p-6 sm:p-8'>
          <Skeleton className='h-7 w-40 mb-4' />
          <Skeleton className='h-24 w-full mb-4' />
          <Skeleton className='h-48 w-full' />
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.25 }}
      whileHover={{ scale: 1.01 }}
      className='transition-transform duration-300'
    >
      <Card
        id='profile-availability'
        className='relative rounded-3xl border border-brand/35 bg-[#050505] p-6 sm:p-8 shadow-2xl shadow-brand/10 transition-all duration-300 overflow-hidden'
      >
        {/* Ambient Corner Glow */}
        <div className='absolute -top-12 -right-12 h-48 w-48 bg-brand/10 rounded-full blur-3xl pointer-events-none' />

        <div className='grid grid-cols-1 lg:grid-cols-[minmax(0,260px)_1fr] gap-8 lg:gap-10 border-t border-b border-border/40 py-8 -mt-2 -mb-2 relative z-10'>
          {/* Left Summary Column */}
          <div className='space-y-5 lg:pr-4'>
            <div className='space-y-1.5'>
              <h3 className='text-xl font-bold text-foreground tracking-tight'>
                Availability
              </h3>
              <p className='text-sm text-muted-foreground leading-relaxed'>
                Set when you are typically available for work.
              </p>
            </div>

            {missingFields.length > 0 && (
              <div className='rounded-2xl border border-brand/40 bg-[#090909] p-4 text-sm text-brand shadow-inner space-y-2'>
                <p className='font-semibold text-brand text-sm'>
                  Your availability is incomplete
                </p>
                <ul className='list-disc list-inside text-brand/90 space-y-1 text-xs font-medium'>
                  {missingFields.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className='text-xs text-muted-foreground/60 pt-1 font-mono'>
              Last updated: {formatUpdated(profile?.updated_at)}
            </p>
          </div>

          {/* Right Form Controls Column */}
          <div className='space-y-8 min-w-0'>
            {/* Top Form Fields */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6'>
              <div className='space-y-1.5 sm:col-span-1'>
                <label className='text-sm font-semibold text-foreground'>
                  Availability to start <span className='text-brand'>*</span>
                </label>
                <p className='text-xs text-muted-foreground'>
                  How soon you could begin a new role if offered
                </p>
                <Select
                  value={availabilityStart || undefined}
                  onValueChange={setAvailabilityStart}
                >
                  <SelectTrigger className='w-full bg-[#0d0d0d] border border-border/50 rounded-xl focus:border-brand/60 focus:ring-1 focus:ring-brand/30 text-sm h-11 text-foreground'>
                    <SelectValue placeholder='Select' />
                  </SelectTrigger>
                  <SelectContent className='max-h-[280px] bg-[#0d0d0d] border border-border/50 text-foreground'>
                    {START_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className='focus:bg-brand/20 focus:text-brand cursor-pointer'>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1.5 sm:col-span-1'>
                <label className='text-sm font-semibold text-foreground'>
                  Preferred time commitment{" "}
                  <span className='text-brand'>*</span>
                </label>
                <p className='text-xs text-muted-foreground'>
                  Ideal number of hours you&apos;d like to work each week
                </p>
                <input
                  type='number'
                  min={1}
                  max={168}
                  placeholder='Ex: 40'
                  value={hoursStr}
                  onChange={(e) => setHoursStr(e.target.value)}
                  className='w-full rounded-xl border border-border/50 bg-[#0d0d0d] px-3.5 py-2 text-sm h-11 text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 focus:ring-1 focus:ring-brand/30 outline-none transition-all'
                />
              </div>

              <div className='space-y-1.5 sm:col-span-2'>
                <label className='text-sm font-semibold text-foreground'>
                  Timezone <span className='text-brand'>*</span>
                </label>
                <p className='text-xs text-muted-foreground'>
                  Select the time zone you primarily work from. This will be
                  used to interpret your weekly availability hours.
                </p>
                <Select
                  value={timezone || undefined}
                  onValueChange={setTimezone}
                >
                  <SelectTrigger className='w-full bg-[#0d0d0d] border border-border/50 rounded-xl focus:border-brand/60 focus:ring-1 focus:ring-brand/30 text-sm h-11 text-foreground'>
                    <SelectValue placeholder='Select timezone' />
                  </SelectTrigger>
                  <SelectContent className='max-h-[280px] bg-[#0d0d0d] border border-border/50 text-foreground'>
                    {zones.map((z) => (
                      <SelectItem key={z} value={z} className='focus:bg-brand/20 focus:text-brand cursor-pointer'>
                        {z.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Working Hours Box */}
            <div className='rounded-2xl border border-border/50 bg-[#0a0a0a] p-5 space-y-4 shadow-inner'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-3.5'>
                <div>
                  <h4 className='text-sm font-bold text-foreground'>
                    Working hours
                  </h4>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    Click days below to toggle availability
                  </p>
                </div>
                <button
                  type='button'
                  onClick={resetBusinessWeek}
                  className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand/30 bg-brand/10 text-brand text-xs font-semibold hover:bg-brand/20 transition-colors shrink-0'
                  title='Reset to Mon–Fri 9am–5pm'
                >
                  <RefreshCw className='w-3.5 h-3.5' />
                  Mon–Fri 9–5
                </button>
              </div>

              {/* Day Toggle Selector Pills */}
              <div className='flex items-center gap-2 flex-wrap'>
                {DAY_INITIALS.map((initial, dayIndex) => {
                  const enabled = dayEnabled(dayIndex);
                  return (
                    <button
                      key={dayIndex}
                      type='button'
                      onClick={() => {
                        if (enabled) {
                          setDaySlots(dayIndex, []);
                        } else {
                          setDaySlots(dayIndex, [{ start: "09:00", end: "17:00" }]);
                        }
                      }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                        enabled
                          ? "bg-brand text-black border-brand shadow-md shadow-brand/25 scale-105"
                          : "bg-[#000000] text-muted-foreground/60 border-border/40 hover:border-brand/40 hover:text-foreground"
                      }`}
                      title={`Toggle ${initial}`}
                    >
                      {initial}
                    </button>
                  );
                })}
              </div>

              {/* Compact 2-Column Active Days Grid */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3 pt-1'>
                {DAY_INITIALS.map((initial, dayIndex) => {
                  const enabled = dayEnabled(dayIndex);
                  if (!enabled) return null;
                  const slots = weekly[String(dayIndex)] ?? [];
                  const dayNames = [
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ];
                  return (
                    <div
                      key={dayIndex}
                      className='rounded-xl border border-border/40 bg-[#000000] p-3 space-y-2.5 shadow-inner'
                    >
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <div className='w-6 h-6 rounded-full bg-brand text-black text-[11px] font-extrabold flex items-center justify-center'>
                            {initial}
                          </div>
                          <span className='text-xs font-semibold text-foreground'>
                            {dayNames[dayIndex]}
                          </span>
                        </div>
                        <div className='flex items-center gap-1'>
                          <button
                            type='button'
                            onClick={() => addSlot(dayIndex)}
                            className='p-1 rounded-lg text-muted-foreground hover:text-brand hover:bg-brand/10 transition-colors'
                            title='Add another range'
                          >
                            <Plus className='w-3.5 h-3.5' />
                          </button>
                          <button
                            type='button'
                            onClick={() => setDaySlots(dayIndex, [])}
                            className='p-1 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors'
                            title='Make unavailable'
                          >
                            <X className='w-3.5 h-3.5' />
                          </button>
                        </div>
                      </div>

                      <div className='space-y-2'>
                        {slots.map((slot, si) => (
                          <div
                            key={si}
                            className='flex items-center gap-2'
                          >
                            <input
                              type='time'
                              value={slot.start}
                              onChange={(e) =>
                                updateSlot(dayIndex, si, {
                                  start: e.target.value,
                                })
                              }
                              className='rounded-lg border border-border/40 bg-[#0a0a0a] px-2.5 py-1 text-xs text-foreground focus:border-brand/60 outline-none w-[6.8rem]'
                            />
                            <span className='text-muted-foreground/60 text-xs'>
                              –
                            </span>
                            <input
                              type='time'
                              value={slot.end}
                              onChange={(e) =>
                                updateSlot(dayIndex, si, {
                                  end: e.target.value,
                                })
                              }
                              className='rounded-lg border border-border/40 bg-[#0a0a0a] px-2.5 py-1 text-xs text-foreground focus:border-brand/60 outline-none w-[6.8rem]'
                            />
                            {slots.length > 1 && (
                              <button
                                type='button'
                                onClick={() => removeSlot(dayIndex, si)}
                                className='p-1 text-muted-foreground hover:text-rose-400'
                                title='Remove range'
                              >
                                <X className='w-3 h-3' />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Date-Specific Hours Exceptions */}
            <div className='rounded-2xl border border-border/50 bg-[#0a0a0a] p-5 sm:p-6 space-y-4 shadow-inner'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                <div className='flex items-start gap-3'>
                  <Calendar className='w-5 h-5 text-brand mt-0.5 shrink-0' />
                  <div>
                    <h4 className='text-base font-bold text-foreground'>
                      Date-specific hours
                    </h4>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      Override your usual schedule for holidays, travel, or
                      one-off changes
                    </p>
                  </div>
                </div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='border-brand/40 bg-brand/5 text-brand hover:bg-brand/15 hover:border-brand/60 rounded-xl text-xs font-semibold shrink-0'
                  onClick={addException}
                >
                  <Plus className='w-3.5 h-3.5 mr-1.5' />
                  Add exceptions
                </Button>
              </div>

              {exceptions.length === 0 ? (
                <div className='rounded-xl bg-[#000000] border border-dashed border-border/40 py-8 px-4 text-center text-sm text-muted-foreground/60'>
                  No active exceptions.
                </div>
              ) : (
                <div className='space-y-3'>
                  {exceptions.map((ex) => (
                    <div
                      key={ex.id}
                      className='rounded-xl border border-border/50 bg-[#000000] p-4 space-y-3'
                    >
                      <div className='flex flex-wrap items-center gap-3'>
                        <input
                          type='date'
                          value={ex.date}
                          onChange={(e) =>
                            updateException(ex.id, { date: e.target.value })
                          }
                          className='rounded-xl border border-border/40 bg-[#0a0a0a] px-3 py-2 text-sm text-foreground focus:border-brand/60 outline-none flex-1 min-w-[140px]'
                        />
                        <label className='flex items-center gap-2 text-xs text-muted-foreground cursor-pointer'>
                          <input
                            type='checkbox'
                            checked={ex.unavailable}
                            onChange={(e) =>
                              updateException(ex.id, {
                                unavailable: e.target.checked,
                                slots: e.target.checked
                                  ? []
                                  : [{ start: "09:00", end: "17:00" }],
                              })
                            }
                            className='accent-brand rounded'
                          />
                          Unavailable this day
                        </label>
                        <button
                          type='button'
                          onClick={() => removeException(ex.id)}
                          className='p-2 rounded-xl text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 ml-auto'
                          aria-label='Remove exception'
                        >
                          <X className='w-4 h-4' />
                        </button>
                      </div>
                      {!ex.unavailable && (
                        <div className='space-y-2 pl-0 sm:pl-1'>
                          {ex.slots.map((slot, si) => (
                            <div
                              key={si}
                              className='flex flex-wrap items-center gap-2'
                            >
                              <input
                                type='time'
                                value={slot.start}
                                onChange={(e) => {
                                  const next = ex.slots.map((s, i) =>
                                    i === si
                                      ? { ...s, start: e.target.value }
                                      : s,
                                  );
                                  updateException(ex.id, { slots: next });
                                }}
                                className='rounded-xl border border-border/40 bg-[#0a0a0a] px-3 py-2 text-sm text-foreground focus:border-brand/60 outline-none w-[7.5rem]'
                              />
                              <span className='text-muted-foreground/60'>–</span>
                              <input
                                type='time'
                                value={slot.end}
                                onChange={(e) => {
                                  const next = ex.slots.map((s, i) =>
                                    i === si
                                      ? { ...s, end: e.target.value }
                                      : s,
                                  );
                                  updateException(ex.id, { slots: next });
                                }}
                                className='rounded-xl border border-border/40 bg-[#0a0a0a] px-3 py-2 text-sm text-foreground focus:border-brand/60 outline-none w-[7.5rem]'
                              />
                              <button
                                type='button'
                                onClick={() => removeExceptionSlot(ex.id, si)}
                                className='p-1.5 text-muted-foreground hover:text-rose-400'
                                aria-label='Remove slot'
                              >
                                <X className='w-3.5 h-3.5' />
                              </button>
                            </div>
                          ))}
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            className='text-xs h-8 text-brand hover:text-brand hover:bg-brand/10 rounded-lg'
                            onClick={() => addExceptionSlot(ex.id)}
                          >
                            <Plus className='w-3 h-3 mr-1' />
                            Add range
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save Button Bar */}
            <div className='flex flex-wrap items-center gap-3 pt-2 border-t border-border/40'>
              <Button
                type='button'
                size='sm'
                disabled={loading || saving || missingFields.length > 0}
                className='bg-brand text-black font-semibold hover:bg-brand/90 px-6 py-2.5 rounded-xl shadow-lg shadow-brand/20 transition-all disabled:opacity-50'
                onClick={() => void handleSave()}
              >
                {saving ? "Saving…" : "Save availability"}
              </Button>
              {missingFields.length > 0 && (
                <span className='text-xs text-muted-foreground self-center'>
                  Complete required fields to save.
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
