import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HostRoomClient from './host-room-client'

export default async function HostRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/host/login')

  const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single()
  if (!room || room.host_id !== user.id) redirect('/host/setup')

  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('room_id', roomId)
    .order('order_index')

  const { data: participants } = await supabase
    .from('participants')
    .select('*')
    .eq('room_id', roomId)
    .order('score', { ascending: false })

  return (
    <HostRoomClient
      initialRoom={room}
      initialQuestions={questions ?? []}
      initialParticipants={participants ?? []}
    />
  )
}
