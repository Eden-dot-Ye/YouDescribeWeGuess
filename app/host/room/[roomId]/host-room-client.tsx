'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Room, Question, Participant, Guess } from '@/lib/types'
import Leaderboard from '@/components/leaderboard'
import CountdownTimer from '@/components/countdown-timer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Shuffle, Eye, ChevronRight, Users, LogOut, Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Props {
  initialRoom: Room
  initialQuestions: Question[]
  initialParticipants: Participant[]
}

export default function HostRoomClient({ initialRoom, initialQuestions, initialParticipants }: Props) {
  const router = useRouter()
  const [room, setRoom] = useState<Room>(initialRoom)
  const [questions] = useState<Question[]>(initialQuestions)
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants)
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [loading, setLoading] = useState(false)
  const participantsRef = useRef<Participant[]>(initialParticipants)

  // Keep the ref in sync with the latest participants state
  useEffect(() => {
    participantsRef.current = participants
  }, [participants])

  const currentQuestion = questions.find(q => q.id === room.current_question_id) ?? null
  const currentQIndex = questions.findIndex(q => q.id === room.current_question_id)

  // Realtime subscriptions
  useEffect(() => {
    const supabase = createClient()

    const roomChannel = supabase
      .channel(`room-events:${room.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, ({ new: updated }) => {
        setRoom(updated as Room)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${room.id}` }, (payload) => {
        setParticipants(prev => {
          let next = [...prev]
          if (payload.eventType === 'INSERT') {
            if (!next.find(p => p.id === payload.new.id)) {
              next.push(payload.new as Participant)
            }
          } else if (payload.eventType === 'UPDATE') {
            const idx = next.findIndex(p => p.id === payload.new.id)
            if (idx !== -1) {
              next[idx] = payload.new as Participant
            } else {
              next.push(payload.new as Participant)
            }
          } else if (payload.eventType === 'DELETE') {
            next = next.filter(p => p.id !== payload.old.id)
          }
          return next.sort((a, b) => b.score - a.score)
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guesses', filter: `room_id=eq.${room.id}` }, ({ new: g }) => {
        setGuesses(prev => [...prev, g as Guess])
        if ((g as Guess).is_correct) {
          const p = participantsRef.current.find(p => p.id === (g as Guess).participant_id)
          toast.success(`${p?.nickname ?? 'Someone'} guessed correctly!`, { duration: 3000 })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(roomChannel)
    }
  }, [room.id])

  // Load existing guesses for current question
  useEffect(() => {
    if (!room.current_question_id) return
    const supabase = createClient()
    supabase.from('guesses').select('*').eq('question_id', room.current_question_id).then(({ data }) => {
      if (data) setGuesses(data)
    })
  }, [room.current_question_id])

  const handlePickQuestion = async (questionId: string) => {
    setLoading(true)
    const supabase = createClient()
    const q = questions.find(q => q.id === questionId)!
    const timerEndAt = new Date(Date.now() + q.time_limit * 1000).toISOString()

    // 1) Update room FIRST so clients load the question before describer is revealed
    await supabase.from('rooms').update({ current_question_id: questionId, status: 'active', timer_end_at: timerEndAt }).eq('id', room.id)

    // 2) Only clear the OLD describer (not all participants) to avoid N update events
    const oldDescriber = participants.find(p => p.is_describer)
    if (participants.length > 0) {
      const randomIdx = Math.floor(Math.random() * participants.length)
      const newDescriberId = participants[randomIdx].id
      if (oldDescriber && oldDescriber.id !== newDescriberId) {
        await supabase.from('participants').update({ is_describer: false }).eq('id', oldDescriber.id)
      }
      await supabase.from('participants').update({ is_describer: true }).eq('id', newDescriberId)
    }
    setLoading(false)
    toast.success('Round started!')
  }

  const handlePickRandom = async () => {
    if (participants.length === 0) { toast.error('No participants yet.'); return }
    const randomIdx = Math.floor(Math.random() * participants.length)
    const newDescriberId = participants[randomIdx].id
    setLoading(true)
    const supabase = createClient()
    // Only clear old describer instead of all participants
    const oldDescriber = participants.find(p => p.is_describer)
    if (oldDescriber && oldDescriber.id !== newDescriberId) {
      await supabase.from('participants').update({ is_describer: false }).eq('id', oldDescriber.id)
    }
    await supabase.from('participants').update({ is_describer: true }).eq('id', newDescriberId)
    setLoading(false)
    toast.success(`${participants[randomIdx].nickname} is now the describer!`)
  }

  const handleReveal = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('rooms').update({ status: 'reveal', timer_end_at: null }).eq('id', room.id)
    setLoading(false)
  }

  const handleNextQuestion = async () => {
    const nextQ = questions[currentQIndex + 1]
    if (!nextQ) {
      // Finish the game
      setLoading(true)
      const supabase = createClient()
      await supabase.from('rooms').update({ status: 'finished', current_question_id: null, timer_end_at: null }).eq('id', room.id)
      setLoading(false)
      return
    }
    await handlePickQuestion(nextQ.id)
  }

  const handleTimerExpire = useCallback(async () => {
    if (room.status !== 'active') return
    const supabase = createClient()
    await supabase.from('rooms').update({ status: 'reveal', timer_end_at: null }).eq('id', room.id)
    toast.info('Time is up! Answer revealed.')
  }, [room.status, room.id])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const correctGuesses = guesses.filter(g => g.is_correct)
  const describer = participants.find(p => p.is_describer)

  return (
    <main className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row h-screen">
        {/* Main area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Host Dashboard</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-2xl font-bold text-primary">{room.code}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(room.code); toast.success('Copied!') }}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Badge variant={room.status === 'active' ? 'default' : room.status === 'reveal' ? 'secondary' : 'outline'}>
                  {room.status}
                </Badge>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1.5" />
              Logout
            </Button>
          </div>

          {/* Current Round */}
          {currentQuestion && (
            <Card className="border-primary/30 shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Round {currentQIndex + 1} / {questions.length}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {room.status === 'active' ? 'In Progress' : room.status === 'reveal' ? 'Revealed' : 'Waiting'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Timer */}
                <CountdownTimer timerEndAt={room.timer_end_at} onExpire={handleTimerExpire} />

                {/* Answer (always visible to host) */}
                <div className="p-4 rounded-lg bg-game-surface text-game-surface-foreground space-y-1">
                  <p className="text-xs text-game-surface-foreground/60 uppercase tracking-wide">Answer</p>
                  <p className="text-2xl font-bold">{currentQuestion.answer_zh}</p>
                  <p className="text-lg text-game-surface-foreground/80">{currentQuestion.answer_en}</p>
                </div>

                {/* Describer */}
                {describer && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground">
                      Describer: <strong>{describer.nickname}</strong>
                    </span>
                  </div>
                )}

                {/* Correct guessers */}
                {correctGuesses.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Correct Guesses</p>
                    <div className="flex flex-wrap gap-1.5">
                      {correctGuesses.map(g => {
                        const p = participants.find(x => x.id === g.participant_id)
                        return (
                          <span key={g.id} className="px-2 py-1 rounded-full text-xs font-medium bg-game-correct text-game-correct-foreground">
                            {p?.nickname ?? 'Unknown'}: {g.content}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={handlePickRandom} disabled={loading}>
                    <Shuffle className="w-4 h-4 mr-1.5" />
                    Pick Describer
                  </Button>
                  {room.status === 'active' && (
                    <Button variant="outline" size="sm" onClick={handleReveal} disabled={loading}>
                      <Eye className="w-4 h-4 mr-1.5" />
                      Reveal Answer
                    </Button>
                  )}
                  {room.status === 'reveal' && (
                    <Button size="sm" onClick={handleNextQuestion} disabled={loading}>
                      <ChevronRight className="w-4 h-4 mr-1.5" />
                      {currentQIndex + 1 < questions.length ? 'Next Question' : 'Finish Game'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Game finished */}
          {room.status === 'finished' && (
            <Card className="border-game-correct/30 bg-game-correct/5">
              <CardContent className="py-8 text-center space-y-2">
                <p className="text-2xl font-bold text-foreground">Game Over!</p>
                <p className="text-muted-foreground">Check the leaderboard for final scores.</p>
              </CardContent>
            </Card>
          )}

          {/* Question List */}
          <Separator />
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Questions</h2>
            {questions.map((q, i) => (
              <div
                key={q.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border transition-colors',
                  q.id === room.current_question_id ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-muted-foreground w-5">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{q.answer_zh || '—'} / {q.answer_en || '—'}</p>
                    <p className="text-xs text-muted-foreground">{q.time_limit}s</p>
                  </div>
                </div>
                {q.id !== room.current_question_id && room.status !== 'active' && (
                  <Button variant="ghost" size="sm" onClick={() => handlePickQuestion(q.id)} disabled={loading}>
                    Start
                  </Button>
                )}
                {q.id === room.current_question_id && <Badge variant="default" className="text-xs">Active</Badge>}
              </div>
            ))}
            {room.status === 'waiting' && questions.length > 0 && (
              <Button className="w-full mt-2" onClick={() => handlePickQuestion(questions[0].id)} disabled={loading}>
                Start First Question
              </Button>
            )}
          </div>

          {/* Participants */}
          <Separator />
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participants ({participants.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {participants.map(p => (
                <span key={p.id} className={cn('px-2.5 py-1 rounded-full text-xs font-medium border', p.is_describer ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-secondary text-secondary-foreground border-border')}>
                  {p.nickname} · {p.score}pts
                </span>
              ))}
              {participants.length === 0 && <p className="text-muted-foreground text-sm">Waiting for players to join…</p>}
            </div>
          </div>
        </div>

        {/* Sidebar Leaderboard */}
        <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-card p-4 overflow-y-auto">
          <Leaderboard participants={participants} />
        </div>
      </div>
    </main>
  )
}
