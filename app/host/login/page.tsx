'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Lock } from 'lucide-react'
import Link from 'next/link'

export default function HostLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('admin@ydwg.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!password) { setError('Enter your password.'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError('Invalid credentials. Default password is admin.')
      return
    }
    router.push('/host/setup')
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-2xl">Host Login</CardTitle>
            <CardDescription>Sign in to create and manage rooms.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                type="password"
                placeholder="Default: admin"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button className="w-full" onClick={handleLogin} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
            <p className="text-muted-foreground text-xs text-center">
              Default credentials: admin@ydwg.com / admin
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
