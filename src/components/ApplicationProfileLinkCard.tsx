import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Replaces the Work eligibility card: those answers now live in the
// Application profile (Resume area) with the other common questions.
export function ApplicationProfileLinkCard() {
  const navigate = useNavigate();
  return (
    <Card className='product-section-card p-4 sm:p-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2 font-medium'>
            <ShieldCheck className='h-4 w-4 text-brand' aria-hidden />
            Application profile
          </div>
          <p className='text-sm text-muted-foreground'>
            Work eligibility, salary, notice period and the other questions employers ask are now answered once in your application profile.
          </p>
        </div>
        <Button type='button' size='sm' onClick={() => navigate("/dashboard/resume/profile")}>
          Open application profile
        </Button>
      </div>
    </Card>
  );
}
