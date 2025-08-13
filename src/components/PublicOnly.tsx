import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '../lib/supabaseClient'

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
        navigate('/dashboard', { replace: true })
      } else {
        setChecking(false)
      }
    }
    check()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) navigate('/dashboard', { replace: true })
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [navigate, supabase])

  if (checking) return null
  return <>{children}</>
}
