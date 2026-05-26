import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  loading?: boolean;
}

export const DeleteConfirmationDialog: React.FC<
  DeleteConfirmationDialogProps
> = ({
  open,
  onOpenChange,
  onConfirm,
  title = "Delete Resume",
  description = "Are you sure you want to delete this resume? This action cannot be undone.",
  loading = false,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='bg-zinc-950 border-zinc-800 text-foreground sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-xl text-brand'>
            <Trash2 className='w-5 h-5' />
            {title}
          </DialogTitle>
          <DialogDescription className='text-zinc-400'>
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className='gap-2 sm:gap-0'>
          <Button
            variant='ghost'
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className='hover:bg-zinc-900 text-zinc-300 hover:text-foreground'
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className='bg-brand text-black hover:bg-brand/90 font-semibold'
          >
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
