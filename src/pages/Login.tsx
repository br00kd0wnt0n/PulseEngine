import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  return (
    <div className="min-h-screen bg-charcoal-900 flex items-center justify-center">
      <div className="bg-charcoal-800 border border-white/10 rounded-2xl p-10 w-full max-w-md text-center shadow-xl">
        <div className="text-4xl font-bold tracking-tight text-white mb-1" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
          ralph
        </div>
        <div className="text-xs uppercase tracking-widest text-white/50 mb-8">
          Storytelling Intelligence
        </div>
        <p className="text-sm text-white/60 mb-6">Sign in to continue</p>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={(res) => { if (res.credential) login(res.credential) }}
            onError={() => console.error('Google login failed')}
            theme="filled_black"
            size="large"
            shape="pill"
            text="signin_with"
          />
        </div>
      </div>
    </div>
  )
}
