import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../routes'
import { createClient } from '../lib/supabaseClient'

type Props = { children: React.ReactNode }

export const RequireAuth: React.FC<Props> = ({ children }) => {
  const navigate = useNavigate()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let mounted = true
    const check = async () => {
      // First look at local session; avoids /auth/v1/user when logged out
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        if (!mounted) return
        navigate(ROUTES.LOGIN, { replace: true })
        return
      }
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      if (!data.user) {
        navigate(ROUTES.LOGIN, { replace: true })
      } else {
        setChecking(false)
      }
    }
    check()

    const { data: sub } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!session?.user) navigate(ROUTES.LOGIN, { replace: true })
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [navigate, supabase])

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-black">
        <div className="w-6 h-6 border-2 border-white/20 border-t-[#1dff00] rounded-full animate-spin" />
      </div>
    )
  }
  return <>{children}</>
}
