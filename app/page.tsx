'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Mic, Users, Trophy, Zap } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')

  const handleJoin = () => {
    if (!roomCode.trim()) { setError('Please enter a room code.'); return }
    if (!nickname.trim()) { setError('Please enter a nickname.'); return }
    setError('')
    router.push(`/room/${roomCode.trim().toUpperCase()}?nickname=${encodeURIComponent(nickname.trim())}`)
  }

  const handleHostLogin = () => {
    router.push('/host/login')
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 gap-12">
        {/* Logo / Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            Live Party Quiz
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-foreground text-balance leading-tight">
            You<span className="text-primary">Describe</span><br />We<span className="text-accent-foreground" style={{color: 'var(--game-highlight)'}}>Guess</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto text-pretty leading-relaxed">
            One person describes. Everyone guesses. Real-time scores. Pure fun.
          </p>
        </div>

        {/* Join Card */}
        <Card className="w-full max-w-sm shadow-lg border-border">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-card-foreground">Join a Room</h2>
            <div className="space-y-3">
              <Input
                placeholder="Room Code (e.g. ABC123)"
                value={roomCode}
                onChange={e => { setRoomCode(e.target.value.toUpperCase()); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                className="text-center tracking-widest font-mono text-lg uppercase"
                maxLength={6}
              />
              <Input
                placeholder="Your Nickname"
                value={nickname}
                onChange={e => { setNickname(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                maxLength={20}
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button className="w-full" size="lg" onClick={handleJoin}>
                <Users className="w-4 h-4 mr-2" />
                Join Room
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs text-muted-foreground bg-card px-2">
                or
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleHostLogin}>
              Host Login
            </Button>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
          {[
            { icon: Mic, title: 'Describe It', desc: 'A random player gets the secret word and describes it — no spelling it out!' },
            { icon: Users, title: 'Everyone Guesses', desc: 'Audience types their guesses in real time. First to get it right wins points.' },
            { icon: Trophy, title: 'Live Leaderboard', desc: 'Scores update instantly. Watch the rankings shift after every round.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center text-center gap-2 p-4 rounded-xl bg-card border border-border">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-card-foreground">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="text-center text-muted-foreground text-xs py-4 border-t border-border">
        YouDescribeWeGuess &mdash; Built for party fun
      </footer>
    </main>
  )
}
