-- Create ai_calibration table for tracking coaching bias and AI settings per workspace
CREATE TABLE IF NOT EXISTS public.ai_calibration (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    coaching_bias text DEFAULT 'neutral', -- e.g. 'direct', 'encouraging', 'neutral'
    calibration_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(workspace_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS ai_calibration_workspace_id_idx ON public.ai_calibration(workspace_id);

-- Enable RLS
ALTER TABLE public.ai_calibration ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view calibration for their workspaces" ON public.ai_calibration
    FOR SELECT USING (
        exists (
            select 1 from public.workspace_members
            where workspace_id = ai_calibration.workspace_id
            and user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update calibration for their workspaces" ON public.ai_calibration
    FOR UPDATE USING (
        exists (
            select 1 from public.workspace_members
            where workspace_id = ai_calibration.workspace_id
            and user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert calibration for their workspaces" ON public.ai_calibration
    FOR INSERT WITH CHECK (
        exists (
            select 1 from public.workspace_members
            where workspace_id = ai_calibration.workspace_id
            and user_id = auth.uid()
        )
    );
