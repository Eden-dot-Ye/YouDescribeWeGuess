export type RoomStatus = 'waiting' | 'active' | 'reveal' | 'finished'

export interface Room {
  id: string
  code: string
  host_id: string
  status: RoomStatus
  current_question_id: string | null
  timer_end_at: string | null
  created_at: string
}

export interface Question {
  id: string
  room_id: string
  answer_zh: string
  answer_en: string
  time_limit: number
  order_index: number
  created_at: string
}

export interface Participant {
  id: string
  room_id: string
  nickname: string
  score: number
  is_describer: boolean
  joined_at: string
}

export interface Guess {
  id: string
  room_id: string
  question_id: string
  participant_id: string
  content: string
  is_correct: boolean
  created_at: string
}
