-- Extend existing job_source_settings table with new fields
ALTER TABLE job_source_settings 
  ADD COLUMN IF NOT EXISTS cron_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cron_expression TEXT DEFAULT '0 */6 * * *',
  ADD COLUMN IF NOT EXISTS firecrawl_api_key TEXT,
  ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Update existing rows to have created_at if they don't
UPDATE job_source_settings 
SET created_at = timezone('utc'::text, now()) 
WHERE created_at IS NULL;

-- Make created_at NOT NULL after updating existing rows
ALTER TABLE job_source_settings 
  ALTER COLUMN created_at SET NOT NULL;

-- Create table for user-specific scraped jobs
CREATE TABLE IF NOT EXISTS user_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT,
  location TEXT,
  remote_type TEXT, -- 'remote', 'hybrid', 'onsite'
  employment_type TEXT, -- 'full-time', 'part-time', 'contract', 'internship'
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT DEFAULT 'USD',
  experience_level TEXT, -- 'entry', 'mid', 'senior', 'executive'
  tags TEXT[],
  apply_url TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active', -- 'active', 'applied', 'rejected', 'interview', 'offer'
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  bookmarked BOOLEAN DEFAULT false,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_jobs_user_id ON user_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_jobs_status ON user_jobs(status);
CREATE INDEX IF NOT EXISTS idx_user_jobs_bookmarked ON user_jobs(bookmarked);
CREATE INDEX IF NOT EXISTS idx_user_jobs_source_type ON user_jobs(source_type);
CREATE INDEX IF NOT EXISTS idx_user_jobs_posted_at ON user_jobs(posted_at);
CREATE INDEX IF NOT EXISTS idx_user_jobs_search_text ON user_jobs USING gin(to_tsvector('english', title || ' ' || company || ' ' || COALESCE(description, '')));

-- Create unique constraint for job deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_jobs_unique_per_user ON user_jobs(user_id, source_type, source_id);

-- Enable RLS
ALTER TABLE user_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_jobs
CREATE POLICY "Users can view their own jobs" 
  ON user_jobs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs" 
  ON user_jobs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs" 
  ON user_jobs FOR UPDATE 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs" 
  ON user_jobs FOR DELETE 
  USING (auth.uid() = user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_job_source_settings_updated_at 
  BEFORE UPDATE ON job_source_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_jobs_updated_at 
  BEFORE UPDATE ON user_jobs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for job statistics
CREATE OR REPLACE VIEW user_job_stats AS
SELECT 
  user_id,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'active') as active_jobs,
  COUNT(*) FILTER (WHERE status = 'applied') as applied_jobs,
  COUNT(*) FILTER (WHERE status = 'interview') as interview_jobs,
  COUNT(*) FILTER (WHERE status = 'offer') as offer_jobs,
  COUNT(*) FILTER (WHERE bookmarked = true) as bookmarked_jobs,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as jobs_this_week,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as jobs_this_month
FROM user_jobs
GROUP BY user_id;

-- Grant permissions
GRANT ALL ON user_jobs TO authenticated;
GRANT SELECT ON user_job_stats TO authenticated;

-- Enable realtime for the new table
ALTER PUBLICATION supabase_realtime ADD TABLE user_jobs;
