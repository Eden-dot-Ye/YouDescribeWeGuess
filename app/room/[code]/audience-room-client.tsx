'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Room, Question, Participant, Guess } from '@/lib/types'
import { isCorrectGuess } from '@/lib/match'
import Leaderboard from '@/components/leaderboard'
import CountdownTimer from '@/components/countdown-timer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Send, Mic, Users, Trophy, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  code: string
  initialNickname: string
}

export default function AudienceRoomClient({ code, initialNickname }: Props) {
  const [room, setRoom] = useState<Room | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [guess, setGuess] = useState('')
  const [nickname, setNickname] = useState(initialNickname)
  const [nicknameInput, setNicknameInput] = useState(initialNickname)
  const [joined, setJoined] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [hasGuessedCorrect, setHasGuessedCorrect] = useState(false)
  const [firstCorrect, setFirstCorrect] = useState<{ nickname: string; guess: string } | null>(null)
  const [notFound, setNotFound] = useState(false)
  const guessInputRef = useRef<HTMLInputElement>(null)

  // Join room
  const handleJoin = async () => {
    const n = nicknameInput.trim()
    if (!n) return
    const supabase = createClient()

    // Find room by code
    const { data: roomData } = await supabase.from('rooms').select('*').eq('code', code).single()
    if (!roomData) { setNotFound(true); return }
    setRoom(roomData)

    // Insert participant
    const { data: pData, error } = await supabase
      .from('participants')
      .insert({ room_id: roomData.id, nickname: n })
      .select()
      .single()
    if (error) {
      toast.error('Could not join: ' + error.message)
      return
    }
    setParticipant(pData)
    setNickname(n)
    setJoined(true)
  }

  // After joining, load current question and subscribe to changes
  useEffect(() => {
    if (!joined || !room) return
    const supabase = createClient()

    const loadQuestion = async (qId: string | null) => {
      if (!qId) { setQuestion(null); return }
      const { data } = await supabase.from('questions').select('*').eq('id', qId).single()
      setQuestion(data)
      setHasGuessedCorrect(false)
      setGuesses([])
      setFirstCorrect(null)
    }

    loadQuestion(room.current_question_id)

    // Load existing guesses for current question
    if (room.current_question_id) {
      supabase.from('guesses').select('*').eq('question_id', room.current_question_id).then(({ data }) => {
        if (data) {
          setGuesses(data)
          const myCorrect = data.find(g => g.participant_id === participant?.id && g.is_correct)
          if (myCorrect) setHasGuessedCorrect(true)
        }
      })
    }

    const roomChannel = supabase
      .channel(`audience-room:${room.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, ({ new: updated }) => {
        const updatedRoom = updated as Room
        setRoom(updatedRoom)
        loadQuestion(updatedRoom.current_question_id)
      })
      .subscribe()

    const guessChannel = supabase
      .channel(`audience-guesses:${room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guesses', filter: `room_id=eq.${room.id}` }, ({ new: g }) => {
        const newGuess = g as Guess
        setGuesses(prev => {
          if (prev.find(x => x.id === newGuess.id)) return prev
          return [...prev, newGuess]
        })
      })
      .subscribe()

    const participantsChannel = supabase
      .channel(`audience-participants:${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${room.id}` }, () => {
        supabase.from('participants').select('*').eq('room_id', room.id).order('score', { ascending: false }).then(({ data }) => {
          if (data) setParticipants(data)
        })
      })
      .subscribe()

    // Also initial load of participants
    supabase.from('participants').select('*').eq('room_id', room.id).order('score', { ascending: false }).then(({ data }) => {
      if (data) setParticipants(data)
    })

    return () => {
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(guessChannel)
      supabase.removeChannel(participantsChannel)
    }
  }, [joined, room?.id, participant?.id])

  // Watch guesses for first correct
  useEffect(() => {
    const correct = guesses.find(g => g.is_correct)
    if (correct && !firstCorrect) {
      const guesser = participants.find(p => p.id === correct.participant_id)
      setFirstCorrect({ nickname: guesser?.nickname ?? 'Someone', guess: correct.content })
    }
  }, [guesses, participants, firstCorrect])

  const handleSubmitGuess = async () => {
    if (!guess.trim() || !room || !participant || !question || submitting) return
    if (hasGuessedCorrect) return

    setSubmitting(true)
    const supabase = createClient()
    const correct = isCorrectGuess(guess, question.answer_zh, question.answer_en)

    const { error } = await supabase.from('guesses').insert({
      room_id: room.id,
      question_id: question.id,
      participant_id: participant.id,
      content: guess.trim(),
      is_correct: correct,
    })

    if (!error && correct) {
      // Award points
      await supabase
        .from('participants')
        .update({ score: (participant.score ?? 0) + 100 })
        .eq('id', participant.id)
      setParticipant(p => p ? { ...p, score: (p.score ?? 0) + 100 } : p)
      setHasGuessedCorrect(true)
      toast.success('Correct! +100 points', { duration: 3000 })
    } else if (!error) {
      toast.error('Not quite — keep guessing!', { duration: 1500 })
    }

    setGuess('')
    setSubmitting(false)
    guessInputRef.current?.focus()
  }

  const describer = participants.find(p => p.is_describer)
  const isDescriber = participant?.id === describer?.id

  // --- Join Form ---
  if (!joined) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm shadow-lg">
          <CardContent className="p-6 space-y-4">
            {notFound ? (
              <div className="text-center space-y-3">
                <p className="text-destructive font-semibold">Room not found</p>
                <p className="text-muted-foreground text-sm">Check the room code and try again.</p>
                <Button variant="outline" className="w-full" onClick={() => setNotFound(false)}>Try Again</Button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-card-foreground">Joining Room</h1>
                <div className="text-center font-mono text-3xl font-bold text-primary">{code}</div>
                <Input
                  placeholder="Your Nickname"
                  value={nicknameInput}
                  onChange={e => setNicknameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  maxLength={20}
                  autoFocus
                />
                <Button className="w-full" onClick={handleJoin} disabled={!nicknameInput.trim()}>
                  <Users className="w-4 h-4 mr-2" />
                  Join Room
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    )
  }

  // --- Room: Waiting ---
  if (room?.status === 'waiting') {
    return (
      <main className="min-h-screen bg-background flex flex-col lg:flex-row">
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm uppercase tracking-wide">Room</p>
            <p className="font-mono text-4xl font-bold text-primary">{code}</p>
            <p className="text-foreground text-lg font-medium">Welcome, {nickname}!</p>
            <p className="text-muted-foreground">Waiting for the host to start the game…</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center max-w-sm">
            {participants.map(p => (
              <span key={p.id} className={cn('px-2.5 py-1 rounded-full text-xs font-medium', p.id === participant?.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>
                {p.nickname}
              </span>
            ))}
          </div>
        </div>
        <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-card p-4">
          <Leaderboard roomId={room.id} />
        </div>
      </main>
    )
  }

  // --- Room: Finished ---
  if (room?.status === 'finished') {
    return (
      <main className="min-h-screen bg-background flex flex-col lg:flex-row">
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-accent-foreground" style={{ color: 'var(--game-highlight)' }} />
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-foreground">Game Over!</p>
            <p className="text-muted-foreground">Thanks for playing, {nickname}!</p>
            <p className="text-foreground font-semibold">Your final score: {participant?.score ?? 0} pts</p>
          </div>
        </div>
        <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-card p-4">
          <Leaderboard roomId={room!.id} />
        </div>
      </main>
    )
  }

  // --- Room: Active / Reveal ---
  const isReveal = room?.status === 'reveal'

  return (
    <main className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Main game area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Room</p>
            <p className="font-mono font-bold text-primary text-xl">{code}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{nickname}</span>
            <Badge variant="outline">{participant?.score ?? 0} pts</Badge>
          </div>
        </div>

        {/* Timer */}
        {room && <CountdownTimer timerEndAt={room.timer_end_at} />}

        {/* Reveal Banner */}
        {isReveal && question && (
          <Card className="border-game-correct/30 bg-game-correct/10 shadow-md">
            <CardContent className="py-6 text-center space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">The Answer Was</p>
              <p className="text-3xl font-bold text-foreground">{question.answer_zh}</p>
              <p className="text-xl text-muted-foreground">{question.answer_en}</p>
              {firstCorrect && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-game-correct text-game-correct-foreground text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  {firstCorrect.nickname} guessed &ldquo;{firstCorrect.guess}&rdquo;
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Describer Role Banner */}
        {!isReveal && isDescriber && (
          <Card className="border-primary/40 bg-primary/10 shadow-md">
            <CardContent className="py-5 text-center space-y-2">
              <div className="inline-flex items-center gap-2 text-primary font-semibold">
                <Mic className="w-5 h-5" />
                You are the Describer!
              </div>
              {question && (
                <div className="space-y-1 pt-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Your word to describe</p>
                  <p className="text-3xl font-bold text-foreground">{question.answer_zh}</p>
                  <p className="text-xl text-muted-foreground">{question.answer_en}</p>
                  <p className="text-xs text-muted-foreground mt-2">Describe it without spelling it out!</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Audience Guess Input */}
        {!isReveal && !isDescriber && question && (
          <Card className="shadow-sm">
            <CardContent className="py-5 space-y-3">
              <div className="text-center">
                {describer ? (
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-primary">{describer.nickname}</strong> is describing — what is it?
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Waiting for a describer…</p>
                )}
              </div>
              {hasGuessedCorrect ? (
                <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-game-correct/10 text-game-correct text-sm font-semibold">
                  <CheckCircle2 className="w-5 h-5" />
                  You guessed it! Well done.
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    ref={guessInputRef}
                    placeholder="Type your guess…"
                    value={guess}
                    onChange={e => setGuess(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmitGuess()}
                    disabled={submitting}
                    autoFocus
                  />
                  <Button onClick={handleSubmitGuess} disabled={!guess.trim() || submitting} size="icon">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Guesses Feed */}
        {guesses.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Guesses</p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {[...guesses].reverse().map(g => {
                const guesser = participants.find(p => p.id === g.participant_id)
                return (
                  <div
                    key={g.id}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                      g.is_correct ? 'bg-game-correct/10 border border-game-correct/30' : 'bg-secondary/50'
                    )}
                  >
                    {g.is_correct && <CheckCircle2 className="w-3.5 h-3.5 text-game-correct shrink-0" />}
                    <span className={cn('font-medium shrink-0', g.participant_id === participant?.id ? 'text-primary' : 'text-foreground')}>
                      {guesser?.nickname ?? 'Unknown'}:
                    </span>
                    <span className="text-muted-foreground truncate">{g.content}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-card p-4 overflow-y-auto">
        <Leaderboard roomId={room!.id} />
      </div>
    </main>
  )
}
