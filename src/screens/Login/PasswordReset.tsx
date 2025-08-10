import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createClient } from '../../lib/supabaseClient'

export const PasswordReset: React.FC = () => {
  const supabase = createClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  // Ensure we are in recovery mode with an access_token
  useEffect(() => {
    const type = params.get('type')
    const token = params.get('access_token')
    if (type !== 'recovery' || !token) {
      navigate('/login', { replace: true })
    }
  }, [navigate, params])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return alert('Password must be at least 8 characters')
    if (password !== confirm) return alert('Passwords do not match')

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      alert('Password updated. Please sign in.')
      navigate('/login', { replace: true })
    } catch (err: any) {
      alert(err?.message || 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg">
        <div className="relative bg-[#ffffff0d] border border-[#ffffff15] rounded-xl sm:rounded-2xl shadow-2xl backdrop-blur-[18px] p-4 sm:p-6 lg:p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-[#1dff00]/20 via-transparent to-[#1dff00]/20 opacity-50 rounded-xl sm:rounded-2xl pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-white text-xl font-bold mb-4">Reset Password</h1>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="flex w-full items-center relative bg-transparent border border-solid border-[#ffffff33] shadow-[0px_2px_14px_#0000000d] backdrop-blur-sm hover:border-[#ffffff4d] focus-within:border-[#1dff00] transition-all duration-300 h-12 px-4 rounded-lg">
                <input
                  className="border-none bg-transparent text-white placeholder:text-[#ffffff99] focus:outline-none w-full"
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex w-full items-center relative bg-transparent border border-solid border-[#ffffff33] shadow-[0px_2px_14px_#0000000d] backdrop-blur-sm hover:border-[#ffffff4d] focus-within:border-[#1dff00] transition-all duration-300 h-12 px-4 rounded-lg">
                <input
                  className="border-none bg-transparent text-white placeholder:text-[#ffffff99] focus:outline-none w-full"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center relative shadow-[0px_3px_14px_#00000040] bg-[linear-gradient(270deg,rgba(29,255,0,1)_0%,rgba(10,130,70,1)_85%)] font-bold text-white hover:shadow-[0px_4px_22px_#00000060] transition-all duration-300 h-10 rounded-lg disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
