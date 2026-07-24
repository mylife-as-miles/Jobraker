import React from "react";

export function RouteLoadingFallback() {
  return (
    <div className='min-h-screen bg-background p-6' role='status' aria-live='polite'>
      <div className='mx-auto max-w-6xl animate-pulse space-y-5'>
        <div className='h-10 w-48 rounded-lg bg-muted' />
        <div className='h-56 rounded-2xl bg-muted/70' />
        <div className='grid gap-4 sm:grid-cols-3'>
          <div className='h-28 rounded-xl bg-muted/60' />
          <div className='h-28 rounded-xl bg-muted/60' />
          <div className='h-28 rounded-xl bg-muted/60' />
        </div>
        <span className='sr-only'>Loading page</span>
      </div>
    </div>
  );
}
