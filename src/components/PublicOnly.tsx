import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '../lib/supabaseClient'
import { ROUTES } from '../routes'

type Props = { children: React.ReactNode }

export const PublicOnly: React.FC<Props> = ({ children }) => {
  const navigate = useNavigate()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let mounted = true
    const check = async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      if (data.user) {
        navigate(`${ROUTES.DASHBOARD}/overview`, { replace: true })
      } else {
        setChecking(false)
      }
    }
    check()

    const { data: sub } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user) navigate(`${ROUTES.DASHBOARD}/overview`, { replace: true })
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
