import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '../../lib/supabaseClient'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const supabase = createClient()

const Login = () => {
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      if (data.user) navigate('/dashboard', { replace: true })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) navigate('/dashboard', { replace: true })
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [navigate])
  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg">
        <div className="relative bg-[#ffffff0d] border border-[#ffffff15] rounded-xl sm:rounded-2xl shadow-2xl backdrop-blur-[18px] p-4 sm:p-6 lg:p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-[#1dff00]/20 via-transparent to-[#1dff00]/20 opacity-50 rounded-xl sm:rounded-2xl pointer-events-none" />
          <div className="relative z-10">
            <Auth
              supabaseClient={supabase}
              providers={["google", "linkedin_oidc"]}
              redirectTo={`${window.location.origin}/dashboard`}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#1dff00',
                      brandAccent: '#0a8246',
                      inputBackground: 'transparent',
                      inputText: 'white',
                      defaultButtonBackground: 'rgba(255,255,255,0.15)',
                      defaultButtonBackgroundHover: 'rgba(255,255,255,0.2)',
                      defaultButtonBorder: 'rgba(255,255,255,0.1)'
                    },
                    fonts: {
                      bodyFontFamily: 'Inter, system-ui, sans-serif',
                      buttonFontFamily: 'Inter, system-ui, sans-serif',
                      inputFontFamily: 'Inter, system-ui, sans-serif'
                    }
                  }
                },
                style: {
                  button: {
                    background: 'linear-gradient(270deg, rgba(29,255,0,1) 0%, rgba(10,130,70,1) 85%)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.15)',
                    boxShadow: '0px 3px 14px #00000040'
                  },
                  input: {
                    background: 'transparent',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)'
                  },
                  anchor: {
                    color: '#1dff00'
                  },
                  divider: {
                    background: 'rgba(255,255,255,0.2)'
                  },
                  label: {
                    color: '#ffffffcc'
                  },
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
