'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Participant } from '@/lib/types'
import { Trophy, Medal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeaderboardProps {
  roomId: string
  className?: string
}

export default function Leaderboard({ roomId, className }: LeaderboardProps) {
  const [participants, setParticipants] = useState<Participant[]>([])

  useEffect(() => {
    const supabase = createClient()

    // Initial fetch
    supabase
      .from('participants')
      .select('*')
      .eq('room_id', roomId)
      .order('score', { ascending: false })
      .then(({ data }) => { if (data) setParticipants(data) })

    // Realtime subscription
    const channel = supabase
      .channel(`leaderboard:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` }, () => {
        supabase
          .from('participants')
          .select('*')
          .eq('room_id', roomId)
          .order('score', { ascending: false })
          .then(({ data }) => { if (data) setParticipants(data) })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId])

  const medalColors = ['text-yellow-500', 'text-slate-400', 'text-amber-600']
  const medalIcons = [Trophy, Medal, Medal]

  return (
    <aside className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-4 h-4 text-game-highlight" />
        <h2 className="font-semibold text-sm text-foreground uppercase tracking-wide">Leaderboard</h2>
      </div>
      {participants.length === 0 && (
        <p className="text-muted-foreground text-xs text-center py-4">No participants yet.</p>
      )}
      <div className="space-y-2">
        {participants.map((p, i) => {
          const Icon = medalIcons[i] ?? null
          return (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-all',
                i === 0 ? 'bg-accent/20 border border-accent/30' : 'bg-secondary/40'
              )}
            >
              <span className={cn('w-5 text-center font-bold text-sm shrink-0', medalColors[i] ?? 'text-muted-foreground')}>
                {i < 3 && Icon ? <Icon className="w-4 h-4 inline" /> : `${i + 1}`}
              </span>
              <span className={cn('flex-1 text-sm font-medium truncate', p.is_describer ? 'text-primary' : 'text-foreground')}>
                {p.nickname}
                {p.is_describer && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Describer</span>}
              </span>
              <span className="text-sm font-bold text-foreground tabular-nums shrink-0">{p.score}</span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
