'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Plus, ArrowRight, ArrowLeft, LogOut } from 'lucide-react'
import { toast } from 'sonner'

interface QuestionDraft {
  answer_zh: string
  answer_en: string
  time_limit: number
}

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function HostSetupClient({ hostId }: { hostId: string }) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [roomCode, setRoomCode] = useState(generateCode())
  const [roomId, setRoomId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { answer_zh: '', answer_en: '', time_limit: 60 },
  ])
  const [loading, setLoading] = useState(false)

  const handleCreateRoom = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('rooms')
      .insert({ code: roomCode, host_id: hostId, status: 'waiting' })
      .select()
      .single()
    setLoading(false)
    if (error) {
      toast.error('Failed to create room: ' + error.message)
      return
    }
    setRoomId(data.id)
    setStep(2)
  }

  const handleAddQuestion = () => {
    setQuestions(q => [...q, { answer_zh: '', answer_en: '', time_limit: 60 }])
  }

  const handleRemoveQuestion = (i: number) => {
    setQuestions(q => q.filter((_, idx) => idx !== i))
  }

  const handleSaveAndGo = async () => {
    if (!roomId) return
    const valid = questions.filter(q => q.answer_zh.trim() || q.answer_en.trim())
    if (valid.length === 0) {
      toast.error('Add at least one question.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const rows = valid.map((q, i) => ({
      room_id: roomId,
      answer_zh: q.answer_zh.trim(),
      answer_en: q.answer_en.trim(),
      time_limit: q.time_limit,
      order_index: i,
    }))
    const { error } = await supabase.from('questions').insert(rows)
    setLoading(false)
    if (error) {
      toast.error('Failed to save questions: ' + error.message)
      return
    }
    router.push(`/host/room/${roomId}`)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Host Setup</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-1.5" />
            Logout
          </Button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          <div className={`px-3 py-1 rounded-full font-medium transition-colors ${step === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            1. Create Room
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className={`px-3 py-1 rounded-full font-medium transition-colors ${step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            2. Add Questions
          </div>
        </div>

        {step === 1 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Create a Room</CardTitle>
              <CardDescription>Share this code with your audience so they can join.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Room Code</Label>
                <div className="flex gap-2">
                  <Input
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    className="font-mono text-center text-2xl tracking-widest"
                    maxLength={8}
                  />
                  <Button variant="outline" onClick={() => setRoomCode(generateCode())}>
                    Random
                  </Button>
                </div>
              </div>
              <Button className="w-full" onClick={handleCreateRoom} disabled={loading || !roomCode.trim()}>
                {loading ? 'Creating…' : 'Create Room'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Card className="shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Add Questions</CardTitle>
                    <CardDescription>Each question needs a Chinese and/or English answer.</CardDescription>
                  </div>
                  <div className="font-mono text-2xl font-bold text-primary">{roomCode}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.map((q, i) => (
                  <div key={i} className="p-4 border border-border rounded-lg space-y-3 bg-secondary/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Question {i + 1}</span>
                      {questions.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemoveQuestion(i)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Chinese Answer</Label>
                        <Input
                          placeholder="e.g. 苹果"
                          value={q.answer_zh}
                          onChange={e => setQuestions(qs => qs.map((x, idx) => idx === i ? { ...x, answer_zh: e.target.value } : x))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">English Answer</Label>
                        <Input
                          placeholder="e.g. Apple"
                          value={q.answer_en}
                          onChange={e => setQuestions(qs => qs.map((x, idx) => idx === i ? { ...x, answer_en: e.target.value } : x))}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Time Limit (s)</Label>
                      <Input
                        type="number"
                        min={10}
                        max={300}
                        value={q.time_limit}
                        onChange={e => setQuestions(qs => qs.map((x, idx) => idx === i ? { ...x, time_limit: Number(e.target.value) } : x))}
                        className="w-24"
                      />
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={handleAddQuestion}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Question
                </Button>
              </CardContent>
            </Card>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back
              </Button>
              <Button className="flex-1" onClick={handleSaveAndGo} disabled={loading}>
                {loading ? 'Saving…' : 'Start Hosting'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
