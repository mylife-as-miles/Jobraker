import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DESIRED_SALARY_MAX_LENGTH,
  EMPTY_WORK_ELIGIBILITY,
  isWorkEligibilityComplete,
  saveWorkEligibility,
  type WorkEligibility,
} from "@/services/profile/workEligibility";

type BooleanField = Exclude<keyof WorkEligibility, "desired_salary">;

const QUESTIONS: Array<{ field: BooleanField; label: string }> = [
  { field: "work_authorized", label: "Are you legally authorized to work in the countries you apply to?" },
  { field: "requires_visa_sponsorship", label: "Will you now or in the future require visa sponsorship?" },
  { field: "has_security_clearance", label: "Do you hold an active government or defense security clearance?" },
  { field: "willing_to_relocate", label: "Are you willing to relocate if a role requires it?" },
];

type WorkEligibilityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: WorkEligibility | null;
  // Called after the answers are saved to the profile.
  onSaved?: (value: WorkEligibility) => void;
  // Shown under the title, for example why the dialog opened.
  description?: string;
};

export function WorkEligibilityDialog({
  open,
  onOpenChange,
  initialValue,
  onSaved,
  description,
}: WorkEligibilityDialogProps) {
  const [value, setValue] = useState<WorkEligibility>(initialValue ?? EMPTY_WORK_ELIGIBILITY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue ?? EMPTY_WORK_ELIGIBILITY);
      setSaveError(null);
    }
  }, [open, initialValue]);

  const complete = isWorkEligibilityComplete(value);

  const handleSave = async () => {
    if (!complete || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveWorkEligibility(value);
      onOpenChange(false);
      onSaved?.(value);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save your answers.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!saving ? onOpenChange(next) : undefined)}>
      <DialogContent className='w-[calc(100vw-1rem)] max-w-[560px] max-h-[calc(100dvh-1rem)] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Work eligibility</DialogTitle>
          <DialogDescription>
            {description ??
              "Employers ask these on most applications. Autopilot uses your answers exactly as given and never guesses them."}
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4 py-2'>
          {QUESTIONS.map(({ field, label }) => (
            <fieldset key={field} className='flex flex-col gap-2'>
              <legend className='text-sm font-medium'>{label}</legend>
              <div className='flex gap-2' role='radiogroup' aria-label={label}>
                {[true, false].map((option) => {
                  const selected = value[field] === option;
                  return (
                    <Button
                      key={String(option)}
                      type='button'
                      role='radio'
                      aria-checked={selected}
                      variant={selected ? "default" : "outline"}
                      size='sm'
                      className='min-w-[72px]'
                      onClick={() => setValue((prev) => ({ ...prev, [field]: option }))}
                    >
                      {option ? "Yes" : "No"}
                    </Button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className='flex flex-col gap-2'>
            <Label htmlFor='work-eligibility-salary'>Desired salary</Label>
            <Input
              id='work-eligibility-salary'
              placeholder='For example: 90000 USD per year'
              maxLength={DESIRED_SALARY_MAX_LENGTH}
              value={value.desired_salary ?? ""}
              onChange={(event) =>
                setValue((prev) => ({ ...prev, desired_salary: event.target.value }))
              }
            />
          </div>

          {saveError ? (
            <p className='text-sm text-destructive' role='alert'>
              {saveError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type='button' onClick={handleSave} disabled={!complete || saving}>
            {saving ? "Saving..." : "Save answers"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
