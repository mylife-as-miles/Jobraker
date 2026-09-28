import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BULK_MAX_PER_EMPLOYER_30D, BULK_MIN_MATCH_SCORE, type BulkPlan, type BulkPlanItem } from "@/lib/bulkApplyPlan";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: BulkPlan | null;
  onConfirm: (jobIds: string[]) => void;
};

function Row({ item, checked, onToggle }: { item: BulkPlanItem; checked: boolean; onToggle: () => void }) {
  return (
    <label className='flex cursor-pointer items-start gap-3 rounded-lg border border-foreground/10 p-3 hover:border-brand/30'>
      <input type='checkbox' className='mt-1' checked={checked} onChange={onToggle} />
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm font-medium'>{item.title}</span>
        <span className='block truncate text-xs text-muted-foreground'>
          {item.company}
          {item.location ? ` · ${item.location}` : ""}
          {item.matchScore !== null ? ` · ${item.matchScore}% match` : ""}
        </span>
        <span className='mt-1 block text-xs'>
          {item.readiness === "ready" ? (
            <span className='text-brand'>Ready: no questions expected</span>
          ) : item.readiness === "needs" ? (
            <span className='text-amber-400' title={(item.missing ?? []).join(", ")}>
              Will ask {item.missing?.length ?? 0} {item.missing?.length === 1 ? "question" : "questions"}: {(item.missing ?? []).slice(0, 2).join(", ")}
              {(item.missing?.length ?? 0) > 2 ? "…" : ""}
            </span>
          ) : (
            <span className='text-muted-foreground'>Questions not published by this employer</span>
          )}
        </span>
        {item.reason ? <span className='mt-1 block text-xs text-amber-400'>{item.reason}</span> : null}
      </span>
    </label>
  );
}

// Shown before a bulk auto-apply: what will be submitted, what was skipped
// and why. Nothing is sent until the user confirms.
export function BulkApplyConfirmDialog({ open, onOpenChange, plan, onConfirm }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showSkipped, setShowSkipped] = useState(false);

  useEffect(() => {
    if (open && plan) {
      setChecked(new Set(plan.selected.map((j) => j.id)));
      setShowSkipped(false);
    }
  }, [open, plan]);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const all = useMemo(() => (plan ? [...plan.selected, ...plan.skipped] : []), [plan]);
  const chosen = all.filter((j) => checked.has(j.id));
  const companies = new Set(chosen.map((j) => j.company.toLowerCase())).size;

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName='z-[10000]' className='z-[10000] w-[calc(100vw-1rem)] max-w-[640px] max-h-[calc(100dvh-1rem)] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            Ready to apply to {chosen.length} {chosen.length === 1 ? "job" : "jobs"} at {companies} {companies === 1 ? "company" : "companies"}
          </DialogTitle>
          <DialogDescription>
            Applications are submitted in your name. Bulk runs include jobs with at least {BULK_MIN_MATCH_SCORE}% fit
            that you can work from your country, and at most {BULK_MAX_PER_EMPLOYER_30D} per employer each month.
          </DialogDescription>
        </DialogHeader>

        {plan.selected.some((j) => j.readiness === "ready") ? (
          <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
            <span>Jobs that will not stop to ask go first.</span>
            <button
              type='button'
              className='font-medium text-brand hover:underline'
              onClick={() => setChecked(new Set(plan.selected.filter((j) => j.readiness === "ready").map((j) => j.id)))}
            >
              Only jobs ready now
            </button>
          </div>
        ) : null}

        <div className='flex flex-col gap-2'>
          {plan.selected.length === 0 ? (
            <p className='text-sm text-muted-foreground'>No job passed the checks. Tick a skipped job below to include it anyway.</p>
          ) : (
            plan.selected.map((item) => <Row key={item.id} item={item} checked={checked.has(item.id)} onToggle={() => toggle(item.id)} />)
          )}
        </div>

        {plan.skipped.length > 0 ? (
          <div className='flex flex-col gap-2'>
            <button type='button' className='self-start text-sm font-medium text-brand hover:underline' onClick={() => setShowSkipped((v) => !v)}>
              {showSkipped ? "Hide" : "Show"} skipped ({plan.skipped.length})
            </button>
            {showSkipped
              ? plan.skipped.map((item) => <Row key={item.id} item={item} checked={checked.has(item.id)} onToggle={() => toggle(item.id)} />)
              : null}
          </div>
        ) : null}

        <DialogFooter className='flex-col-reverse gap-2 sm:flex-row'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type='button' disabled={chosen.length === 0} onClick={() => onConfirm(chosen.map((j) => j.id))}>
            Apply to {chosen.length} {chosen.length === 1 ? "job" : "jobs"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
