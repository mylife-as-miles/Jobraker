-- Migration: Create chat_messages table for normalized chat history storage
-- This allows for better scalability, individual message queries, and future features like search

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    persona TEXT CHECK (persona IN ('concise', 'friendly', 'analyst', 'coach', 'ask', 'agent')),
    metadata JSONB DEFAULT '{}'::jsonb,
    token_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON public.chat_messages(session_id, created_at ASC);

-- Full-text search index for message content (optional, for search feature)
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_search ON public.chat_messages USING gin(to_tsvector('english', content));

-- Row-Level Security (RLS)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own messages
CREATE POLICY "Users can view their own messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add persona column to chat_sessions if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'chat_sessions' 
        AND column_name = 'persona'
    ) THEN
        ALTER TABLE public.chat_sessions ADD COLUMN persona TEXT DEFAULT 'ask';
    END IF;
END $$;

-- Add model column to chat_sessions for tracking which AI model was used
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'chat_sessions' 
        AND column_name = 'model'
    ) THEN
        ALTER TABLE public.chat_sessions ADD COLUMN model TEXT DEFAULT 'gemini-3-pro-preview';
    END IF;
END $$;

-- Function to get message count for a session
CREATE OR REPLACE FUNCTION public.get_session_message_count(p_session_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM public.chat_messages WHERE session_id = p_session_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get last message preview for session listing
CREATE OR REPLACE FUNCTION public.get_session_preview(p_session_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_preview TEXT;
BEGIN
    SELECT LEFT(content, 100) INTO v_preview
    FROM public.chat_messages
    WHERE session_id = p_session_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN COALESCE(v_preview, '');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON TABLE public.chat_messages TO authenticated;
GRANT ALL ON TABLE public.chat_messages TO service_role;
GRANT EXECUTE ON FUNCTION public.get_session_message_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_session_preview TO authenticated;

-- Comment on table
COMMENT ON TABLE public.chat_messages IS 'Stores individual chat messages for AI chat sessions';
COMMENT ON COLUMN public.chat_messages.role IS 'Message role: user, assistant, or system';
COMMENT ON COLUMN public.chat_messages.persona IS 'AI persona used: ask (concise) or agent (analyst)';
COMMENT ON COLUMN public.chat_messages.metadata IS 'Additional metadata like web_search, tools_used, etc.';
COMMENT ON COLUMN public.chat_messages.token_count IS 'Approximate token count for the message';
