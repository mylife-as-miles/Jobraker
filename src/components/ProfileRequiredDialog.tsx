import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const LABELS: Record<string, string> = {
  country_residence: "Country you live in",
  work_authorization: "Countries you can work in",
  sponsorship: "Sponsorship needs",
  expected_salary: "Expected salary",
  current_salary: "Current salary",
  notice_period: "Notice period",
};

// Shown when Autopilot is launched before the required application profile
// answers are saved (Phase 3 decision 2).
export function ProfileRequiredDialog({
  open,
  onOpenChange,
  missing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missing: string[];
}) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName='z-[10000]' className='z-[10000] w-[calc(100vw-1rem)] max-w-[480px]'>
        <DialogHeader>
          <DialogTitle>Complete your application profile first</DialogTitle>
          <DialogDescription>
            Autopilot answers employers' questions from your application profile. These answers are still missing:
          </DialogDescription>
        </DialogHeader>
        <ul className='list-disc space-y-1 pl-5 text-sm'>
          {missing.map((key) => <li key={key}>{LABELS[key] ?? key}</li>)}
        </ul>
        <DialogFooter className='flex-col-reverse gap-2 sm:flex-row'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Not now</Button>
          <Button
            type='button'
            onClick={() => {
              onOpenChange(false);
              navigate("/dashboard/resume/profile");
            }}
          >
            Complete profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
