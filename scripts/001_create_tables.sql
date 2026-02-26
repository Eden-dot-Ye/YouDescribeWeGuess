-- YouDescribeWeGuess: Full schema

-- Rooms table (without current_question_id FK yet to avoid circular dep)
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting',
  current_question_id UUID,
  timer_end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rooms' AND policyname='rooms_select_all') THEN
    CREATE POLICY "rooms_select_all" ON public.rooms FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rooms' AND policyname='rooms_insert_host') THEN
    CREATE POLICY "rooms_insert_host" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = host_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rooms' AND policyname='rooms_update_host') THEN
    CREATE POLICY "rooms_update_host" ON public.rooms FOR UPDATE USING (auth.uid() = host_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rooms' AND policyname='rooms_delete_host') THEN
    CREATE POLICY "rooms_delete_host" ON public.rooms FOR DELETE USING (auth.uid() = host_id);
  END IF;
END $$;

-- Questions table
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  answer_zh TEXT NOT NULL,
  answer_en TEXT NOT NULL,
  time_limit INTEGER NOT NULL DEFAULT 60,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questions' AND policyname='questions_select_all') THEN
    CREATE POLICY "questions_select_all" ON public.questions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questions' AND policyname='questions_insert_host') THEN
    CREATE POLICY "questions_insert_host" ON public.questions FOR INSERT WITH CHECK (
      auth.uid() = (SELECT host_id FROM public.rooms WHERE id = room_id)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questions' AND policyname='questions_update_host') THEN
    CREATE POLICY "questions_update_host" ON public.questions FOR UPDATE USING (
      auth.uid() = (SELECT host_id FROM public.rooms WHERE id = room_id)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questions' AND policyname='questions_delete_host') THEN
    CREATE POLICY "questions_delete_host" ON public.questions FOR DELETE USING (
      auth.uid() = (SELECT host_id FROM public.rooms WHERE id = room_id)
    );
  END IF;
END $$;

-- Participants table
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  is_describer BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participants' AND policyname='participants_select_all') THEN
    CREATE POLICY "participants_select_all" ON public.participants FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participants' AND policyname='participants_insert_all') THEN
    CREATE POLICY "participants_insert_all" ON public.participants FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participants' AND policyname='participants_update_all') THEN
    CREATE POLICY "participants_update_all" ON public.participants FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participants' AND policyname='participants_delete_all') THEN
    CREATE POLICY "participants_delete_all" ON public.participants FOR DELETE USING (true);
  END IF;
END $$;

-- Guesses table
CREATE TABLE IF NOT EXISTS public.guesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='guesses' AND policyname='guesses_select_all') THEN
    CREATE POLICY "guesses_select_all" ON public.guesses FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='guesses' AND policyname='guesses_insert_all') THEN
    CREATE POLICY "guesses_insert_all" ON public.guesses FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='guesses' AND policyname='guesses_update_all') THEN
    CREATE POLICY "guesses_update_all" ON public.guesses FOR UPDATE USING (true);
  END IF;
END $$;

-- Add deferred FK from rooms.current_question_id -> questions.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_current_question' AND table_name = 'rooms'
  ) THEN
    ALTER TABLE public.rooms
      ADD CONSTRAINT fk_current_question
      FOREIGN KEY (current_question_id)
      REFERENCES public.questions(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
