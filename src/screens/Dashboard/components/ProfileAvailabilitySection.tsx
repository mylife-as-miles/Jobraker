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
      const intl = Intl as Intl & {
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
        className='product-section-card p-6 sm:p-8 hover:border-brand/60 hover:shadow-lg transition-all duration-300 overflow-hidden'
      >
        <div className='grid grid-cols-1 lg:grid-cols-[minmax(0,240px)_1fr] gap-8 lg:gap-10 border-t border-b border-foreground/10 py-8 -mt-2 -mb-2'>
          <div className='space-y-4 lg:pr-4'>
            <h3 className='text-lg font-semibold text-foreground tracking-tight'>
              Availability
            </h3>
            <p className='text-sm product-helper-text leading-relaxed'>
              Set when you are typically available for work.
            </p>
            {missingFields.length > 0 && (
              <div className='rounded-lg border border-brand/30 bg-brand/5 px-3 py-2.5 text-sm text-brand/95'>
                <p className='font-medium mb-1'>
                  Your availability is incomplete
                </p>
                <ul className='list-disc list-inside text-brand/80 space-y-0.5'>
                  {missingFields.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className='text-xs product-helper-text pt-2'>
              Last updated: {formatUpdated(profile?.updated_at)}
            </p>
          </div>

          <div className='space-y-8 min-w-0'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6'>
              <div className='space-y-1.5 sm:col-span-1'>
                <label className='text-sm font-semibold text-foreground'>
                  Availability to start <span className='text-brand'>*</span>
                </label>
                <p className='text-xs product-helper-text'>
                  How soon you could begin a new role if offered
                </p>
                <Select
                  value={availabilityStart || undefined}
                  onValueChange={setAvailabilityStart}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select' />
                  </SelectTrigger>
                  <SelectContent className='max-h-[280px]'>
                    {START_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
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
                <p className='text-xs product-helper-text'>
                  Ideal number of hours you&apos;d like to work each week
                </p>
                <input
                  type='number'
                  min={1}
                  max={168}
                  placeholder='Ex: 40'
                  value={hoursStr}
                  onChange={(e) => setHoursStr(e.target.value)}
                  className='product-input-surface w-full rounded-xl px-3 py-2 text-sm h-10'
                />
              </div>

              <div className='space-y-1.5 sm:col-span-2'>
                <label className='text-sm font-semibold text-foreground'>
                  Timezone <span className='text-brand'>*</span>
                </label>
                <p className='text-xs product-helper-text'>
                  Select the time zone you primarily work from. This will be
                  used to interpret your weekly availability hours.
                </p>
                <Select
                  value={timezone || undefined}
                  onValueChange={setTimezone}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select timezone' />
                  </SelectTrigger>
                  <SelectContent className='max-h-[280px]'>
                    {zones.map((z) => (
                      <SelectItem key={z} value={z}>
                        {z.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 sm:p-5 space-y-4'>
              <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3'>
                <div className='flex items-start gap-2.5'>
                  <button
                    type='button'
                    onClick={resetBusinessWeek}
                    className='mt-0.5 p-1.5 rounded-lg text-brand hover:bg-brand/10 transition-colors'
                    title='Reset to Mon–Fri 9am–5pm'
                    aria-label='Reset working hours to weekday default'
                  >
                    <RefreshCw className='w-4 h-4' />
                  </button>
                  <div>
                    <h4 className='text-sm font-semibold text-foreground'>
                      Working hours
                    </h4>
                    <p className='text-xs product-helper-text mt-0.5'>
                      Select when you are typically available to work
                    </p>
                  </div>
                </div>
              </div>

              <div className='space-y-3'>
                {DAY_INITIALS.map((initial, dayIndex) => {
                  const enabled = dayEnabled(dayIndex);
                  const slots = weekly[String(dayIndex)] ?? [];
                  return (
                    <div
                      key={dayIndex}
                      className='flex flex-wrap items-center gap-2 sm:gap-3 py-2 border-b border-foreground/5 last:border-0'
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                          enabled
                            ? "bg-brand text-black shadow-md shadow-brand/25"
                            : "bg-foreground/10 text-foreground/45"
                        }`}
                      >
                        {initial}
                      </div>
                      {!enabled ? (
                        <>
                          <span className='text-sm product-helper-text flex-1 min-w-[100px]'>
                            Unavailable
                          </span>
                          <button
                            type='button'
                            onClick={() => addSlot(dayIndex)}
                            className='w-8 h-8 rounded-full border border-foreground/20 flex items-center justify-center text-foreground/70 hover:border-brand/50 hover:text-brand transition-colors'
                            aria-label={`Add hours for day ${dayIndex}`}
                          >
                            <Plus className='w-4 h-4' />
                          </button>
                        </>
                      ) : (
                        <div className='flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0'>
                          <div className='flex flex-col gap-2 flex-1'>
                            {slots.map((slot, si) => (
                              <div
                                key={si}
                                className='flex flex-wrap items-center gap-2'
                              >
                                <input
                                  type='time'
                                  value={slot.start}
                                  onChange={(e) =>
                                    updateSlot(dayIndex, si, {
                                      start: e.target.value,
                                    })
                                  }
                                  className='product-input-surface rounded-lg px-2 py-1.5 text-sm w-[7.5rem]'
                                />
                                <span className='text-foreground/40 text-sm'>
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
                                  className='product-input-surface rounded-lg px-2 py-1.5 text-sm w-[7.5rem]'
                                />
                                <button
                                  type='button'
                                  onClick={() => removeSlot(dayIndex, si)}
                                  className='p-1.5 rounded-lg text-foreground/50 hover:text-brand hover:bg-brand/10 transition-colors'
                                  aria-label='Remove time range'
                                >
                                  <X className='w-4 h-4' />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type='button'
                            onClick={() => addSlot(dayIndex)}
                            className='w-8 h-8 rounded-full border border-foreground/20 flex items-center justify-center text-foreground/70 hover:border-brand/50 hover:text-brand transition-colors shrink-0'
                            aria-label='Add another range'
                          >
                            <Plus className='w-4 h-4' />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className='rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 sm:p-5 space-y-4'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                <div className='flex items-start gap-2.5'>
                  <Calendar className='w-4 h-4 text-brand mt-1 shrink-0' />
                  <div>
                    <h4 className='text-sm font-semibold text-foreground'>
                      Date-specific hours
                    </h4>
                    <p className='text-xs product-helper-text mt-0.5'>
                      Override your usual schedule for holidays, travel, or
                      one-off changes
                    </p>
                  </div>
                </div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='product-outline-button shrink-0 border-foreground/20'
                  onClick={addException}
                >
                  <Plus className='w-3.5 h-3.5 mr-1' />
                  Add exceptions
                </Button>
              </div>

              {exceptions.length === 0 ? (
                <div className='rounded-lg bg-foreground/5 border border-foreground/10 py-10 px-4 text-center text-sm product-helper-text'>
                  No active exceptions.
                </div>
              ) : (
                <div className='space-y-3'>
                  {exceptions.map((ex) => (
                    <div
                      key={ex.id}
                      className='rounded-lg border border-foreground/10 bg-background/30 p-3 sm:p-4 space-y-3'
                    >
                      <div className='flex flex-wrap items-center gap-2'>
                        <input
                          type='date'
                          value={ex.date}
                          onChange={(e) =>
                            updateException(ex.id, { date: e.target.value })
                          }
                          className='product-input-surface rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[140px]'
                        />
                        <label className='flex items-center gap-2 text-xs product-helper-text cursor-pointer'>
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
                          className='p-1.5 rounded-lg text-foreground/50 hover:text-brand ml-auto'
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
                                className='product-input-surface rounded-lg px-2 py-1.5 text-sm w-[7.5rem]'
                              />
                              <span className='text-foreground/40'>–</span>
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
                                className='product-input-surface rounded-lg px-2 py-1.5 text-sm w-[7.5rem]'
                              />
                              <button
                                type='button'
                                onClick={() => removeExceptionSlot(ex.id, si)}
                                className='p-1 text-foreground/50 hover:text-brand'
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
                            className='text-xs h-8 text-brand hover:text-brand hover:bg-brand/10'
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

            <div className='flex flex-wrap gap-2 pt-1'>
              <Button
                type='button'
                size='sm'
                disabled={loading || saving || missingFields.length > 0}
                className='bg-brand text-black hover:bg-brand/90'
                onClick={() => void handleSave()}
              >
                {saving ? "Saving…" : "Save availability"}
              </Button>
              {missingFields.length > 0 && (
                <span className='text-xs product-helper-text self-center'>
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
