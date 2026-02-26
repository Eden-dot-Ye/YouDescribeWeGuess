import AudienceRoomClient from './audience-room-client'

export default async function AudienceRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ nickname?: string }>
}) {
  const { code } = await params
  const { nickname } = await searchParams

  return <AudienceRoomClient code={code.toUpperCase()} initialNickname={nickname ?? ''} />
}
