DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'user_streaks'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'user_streaks'
              AND column_name = 'last_active_date'
        ) THEN
            ALTER TABLE public.user_streaks
            ADD COLUMN last_active_date DATE;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'user_streaks'
              AND column_name = 'last_activity_date'
        ) THEN
            UPDATE public.user_streaks
            SET last_active_date = COALESCE(last_active_date, last_activity_date)
            WHERE last_activity_date IS NOT NULL;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'user_streaks'
              AND column_name = 'total_xp'
        ) THEN
            ALTER TABLE public.user_streaks
            ADD COLUMN total_xp INTEGER NOT NULL DEFAULT 0;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'user_streaks'
              AND column_name = 'level'
        ) THEN
            ALTER TABLE public.user_streaks
            ADD COLUMN level INTEGER NOT NULL DEFAULT 1;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'user_streaks'
              AND column_name = 'week_activity'
        ) THEN
            ALTER TABLE public.user_streaks
            ADD COLUMN week_activity BOOLEAN[] NOT NULL DEFAULT ARRAY[false,false,false,false,false,false,false];
        END IF;

        UPDATE public.user_streaks
        SET
            total_xp = COALESCE(total_xp, 0),
            level = COALESCE(level, 1),
            week_activity = COALESCE(week_activity, ARRAY[false,false,false,false,false,false,false]);
    END IF;
END $$;
