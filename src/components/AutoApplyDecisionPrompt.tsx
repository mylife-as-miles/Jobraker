import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EvaluateJobFitResponse } from "@/services/ai/evaluateJobFit";

type AutoApplyDecisionPromptProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluation: EvaluateJobFitResponse | null;
  // Set when the selected resume names a different person than the profile.
  resumeMismatch?: { resumeName: string; profileName: string } | null;
  onFixWithDraft: () => void;
  fixDisabled: boolean;
  fixing: boolean;
  onEditProfile: () => void;
  // Only offered when there are no hard missing requirements, matching the
  // auto-apply footer.
  onProceedAnyway: () => void;
};

// Blocking prompt for the job-fit check. The same details stay inline in the
// auto-apply modal; this makes sure the user actually sees them.
export function AutoApplyDecisionPrompt({
  open,
  onOpenChange,
  evaluation,
  resumeMismatch,
  onFixWithDraft,
  fixDisabled,
  fixing,
  onEditProfile,
  onProceedAnyway,
}: AutoApplyDecisionPromptProps) {
  if (!evaluation) return null;
  const missing = evaluation.missing_requirements ?? [];
  const suggestions = evaluation.tailoring_suggestions ?? [];
  const hasHardGaps = missing.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[calc(100vw-1rem)] max-w-[520px] max-h-[calc(100dvh-1rem)] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5 text-brand' aria-hidden />
            {hasHardGaps ? "This job may not be a match" : "Review before applying"}
          </DialogTitle>
          <DialogDescription>
            Fit confidence is {evaluation.confidence_score}%.{" "}
            {hasHardGaps
              ? "Your profile or resume is missing requirements this job lists as essential."
              : "You can still apply, but consider the suggestions below."}
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4 py-1 text-sm'>
          {resumeMismatch ? (
            <div className='rounded-lg border border-destructive/40 bg-destructive/10 p-3' role='alert'>
              <p className='font-medium'>The selected resume belongs to someone else</p>
              <p className='mt-1 text-foreground/75'>
                It names {resumeMismatch.resumeName}, but this profile is {resumeMismatch.profileName}.
                Choose your own resume before applying.
              </p>
            </div>
          ) : null}

          {hasHardGaps ? (
            <div>
              <p className='font-medium'>Missing requirements</p>
              <ul className='mt-2 list-disc space-y-1 pl-5 text-foreground/80'>
                {missing.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {suggestions.length > 0 ? (
            <div>
              <p className='font-medium'>Suggestions</p>
              <ul className='mt-2 list-disc space-y-1 pl-5 text-foreground/80'>
                {suggestions.map((sug, i) => (
                  <li key={i}>{sug}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className='flex-col-reverse gap-2 sm:flex-row'>
          <Button type='button' variant='ghost' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type='button' variant='outline' onClick={onEditProfile}>
            Edit profile
          </Button>
          {hasHardGaps ? (
            <Button type='button' onClick={onFixWithDraft} disabled={fixDisabled || fixing}>
              {fixing ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden />
                  Fixing draft...
                </>
              ) : (
                "Fix with AI draft"
              )}
            </Button>
          ) : (
            <Button type='button' onClick={onProceedAnyway}>
              Apply anyway
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
