import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuthStore()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password)
    setLoading(false)
    if (err) setError(err)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Trckr</h1>
          <p className="text-slate-400 mt-1 text-sm">Track your time, simply.</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-3xl p-6 space-y-5">
          {/* Mode toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => { setMode('signin'); setError(null) }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                mode === 'signin' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >Sign in</button>
            <button
              onClick={() => { setMode('signup'); setError(null) }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                mode === 'signup' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >Create account</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-700 text-white placeholder-slate-400 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-white/20 text-sm"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-700 text-white placeholder-slate-400 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-white/20 text-sm"
            />

            {error && (
              <p className="text-red-400 text-sm px-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-white text-slate-900 font-semibold disabled:opacity-50 text-sm"
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
