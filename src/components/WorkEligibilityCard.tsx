import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkEligibilityDialog } from "@/components/WorkEligibilityDialog";
import {
  fetchWorkEligibility,
  isWorkEligibilityComplete,
  type WorkEligibility,
} from "@/services/profile/workEligibility";

const yesNo = (value: boolean | null) => (value === null ? "Not answered" : value ? "Yes" : "No");

// Settings entry point for the answers Autopilot needs to submit applications.
export function WorkEligibilityCard() {
  const [value, setValue] = useState<WorkEligibility | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchWorkEligibility().catch(() => null);
    setValue(result);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const complete = value ? isWorkEligibilityComplete(value) : false;

  return (
    <Card className='product-section-card p-4 sm:p-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2 font-medium'>
            <ShieldCheck className='h-4 w-4 text-brand' aria-hidden />
            Work eligibility
          </div>
          <p className='text-sm text-muted-foreground'>
            Autopilot uses these answers on applications and needs all of them to submit for you.
          </p>
        </div>
        <Button type='button' size='sm' variant={complete ? "outline" : "default"} onClick={() => setDialogOpen(true)} disabled={!loaded}>
          {complete ? "Edit answers" : "Add answers"}
        </Button>
      </div>

      {loaded && value ? (
        <dl className='mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2'>
          <div className='flex justify-between gap-2'><dt className='text-muted-foreground'>Authorized to work</dt><dd>{yesNo(value.work_authorized)}</dd></div>
          <div className='flex justify-between gap-2'><dt className='text-muted-foreground'>Needs visa sponsorship</dt><dd>{yesNo(value.requires_visa_sponsorship)}</dd></div>
          <div className='flex justify-between gap-2'><dt className='text-muted-foreground'>Security clearance</dt><dd>{yesNo(value.has_security_clearance)}</dd></div>
          <div className='flex justify-between gap-2'><dt className='text-muted-foreground'>Willing to relocate</dt><dd>{yesNo(value.willing_to_relocate)}</dd></div>
          <div className='flex justify-between gap-2 sm:col-span-2'><dt className='text-muted-foreground'>Desired salary</dt><dd className='truncate'>{value.desired_salary || "Not answered"}</dd></div>
        </dl>
      ) : null}

      {loaded && !value ? (
        <p className='mt-4 text-sm text-muted-foreground'>Your answers could not be loaded right now.</p>
      ) : null}

      <WorkEligibilityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialValue={value}
        onSaved={(saved) => setValue(saved)}
      />
    </Card>
  );
}
