import { Loader2 } from "lucide-react";

export function RouteLoadingFallback() {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-background'>
      <div className='fixed top-20 right-0 h-96 w-96 bg-brand/5 rounded-full blur-3xl opacity-30 pointer-events-none' />
      <div className='fixed bottom-0 left-0 h-96 w-96 bg-brand/5 rounded-full blur-3xl opacity-20 pointer-events-none' />
      <div className='flex flex-col items-center gap-3'>
        <Loader2 className='h-10 w-10 text-brand animate-spin' />
      </div>
    </div>
  );
}
