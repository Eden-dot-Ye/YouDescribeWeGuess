'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Timer } from 'lucide-react'

interface CountdownTimerProps {
  timerEndAt: string | null
  onExpire?: () => void
  className?: string
}

export default function CountdownTimer({ timerEndAt, onExpire, className }: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!timerEndAt) { setSecondsLeft(null); return }

    const update = () => {
      const diff = Math.max(0, Math.ceil((new Date(timerEndAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
      if (diff === 0) onExpire?.()
    }

    update()
    const id = setInterval(update, 500)
    return () => clearInterval(id)
  }, [timerEndAt, onExpire])

  if (secondsLeft === null) return null

  const pct = Math.max(0, Math.min(1, secondsLeft / 60))
  const urgent = secondsLeft <= 10

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Timer className={cn('w-4 h-4', urgent ? 'text-destructive animate-pulse' : 'text-muted-foreground')} />
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', urgent ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span className={cn('tabular-nums font-mono text-sm font-bold w-8 text-right', urgent ? 'text-destructive' : 'text-foreground')}>
        {secondsLeft}s
      </span>
    </div>
  )
}
