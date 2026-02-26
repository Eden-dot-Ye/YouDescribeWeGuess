import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HostSetupClient from './setup-client'

export default async function HostSetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/host/login')

  return <HostSetupClient hostId={user.id} />
}
