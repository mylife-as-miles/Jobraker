import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../routes'
import { createClient } from '../lib/supabaseClient'
import { events } from '@/lib/analytics'

type Props = { children: React.ReactNode }

export const RequireAuth: React.FC<Props> = ({ children }) => {
  const navigate = useNavigate()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [onboardingCheck, setOnboardingCheck] = useState<{ done: boolean; complete: boolean }>({ done: false, complete: false });

  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        // First look at local session; avoids /auth/v1/user when logged out
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        // If there's an auth error (like invalid refresh token), redirect to signin
        if (sessionError) {
          console.error('Session error:', sessionError);
          if (!mounted) return;
          navigate(ROUTES.SIGNIN, { replace: true });
          return;
        }
        
        if (!session?.access_token) {
          if (!mounted) return
          navigate(ROUTES.SIGNIN, { replace: true })
          return
        }
        
        const { data, error: userError } = await supabase.auth.getUser()
        
        // If there's an error getting user, redirect to signin
        if (userError) {
          console.error('User error:', userError);
          if (!mounted) return;
          navigate(ROUTES.SIGNIN, { replace: true });
          return;
        }
        
        if (!mounted) return
        if (!data.user) {
          navigate(ROUTES.SIGNIN, { replace: true })
          return;
        }
        
        // Fetch profile to determine onboarding status
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', data.user.id)
          .single();
        if (profErr) {
          // Profile row not found yet — create a stub so onboarding flow can safely upsert details
          try {
            if (data.user?.id) {
              await supabase.from('profiles').upsert({ id: data.user.id, onboarding_complete: false }, { onConflict: 'id' });
              try { events.onboardingStubProfileCreated(); } catch {}
            }
          } catch {}
          setOnboardingCheck({ done: true, complete: false });
          // Ensure redirect to onboarding if we're not already there
          if (window.location.pathname !== ROUTES.ONBOARDING) {
            try { events.onboardingRedirect('missing_profile'); } catch {}
            navigate(ROUTES.ONBOARDING, { replace: true });
          }
        } else {
          const complete = !!profile?.onboarding_complete;
          setOnboardingCheck({ done: true, complete });
          // If not complete and we're not already on onboarding route -> redirect
          if (!complete && window.location.pathname !== ROUTES.ONBOARDING) {
            try { events.onboardingRedirect('incomplete'); } catch {}
            navigate(ROUTES.ONBOARDING, { replace: true });
          }
          // If complete and user is on onboarding, push to dashboard
          if (complete && window.location.pathname === ROUTES.ONBOARDING) {
            navigate('/dashboard/overview', { replace: true });
          }
          // Fire profile_completed if we newly observe completion and haven't emitted yet (hard refresh safety)
          try {
            if (complete && !(window as any).__profileCompletedTracked) {
              events.profileCompleted();
              (window as any).__profileCompletedTracked = true;
            }
          } catch {}
        }
        setChecking(false)
      } catch (error) {
        // Catch any unexpected errors during auth check
        console.error('Auth check error:', error);
        if (!mounted) return;
        navigate(ROUTES.SIGNIN, { replace: true });
        return;
      }
    }
    check()

    const { data: sub } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
  if (!session?.user) navigate(ROUTES.SIGNIN, { replace: true })
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [navigate, supabase])

  if (checking || !onboardingCheck.done) {
    return (
      <div className="min-h-screen grid place-items-center bg-black">
        <div className="w-6 h-6 border-2 border-white/20 border-t-[#1dff00] rounded-full animate-spin" />
      </div>
    )
  }
  return <>{children}</>
}
