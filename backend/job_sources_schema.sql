-- Canonical: id is the PK and also a FK to auth.users(id); no user_id column
CREATE TABLE job_source_settings (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  cron_enabled BOOLEAN DEFAULT false,
  cron_expression TEXT DEFAULT '0 */6 * * *',
  firecrawl_api_key TEXT,
  notification_enabled BOOLEAN DEFAULT true,
  sources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- No index on user_id (column removed); add indexes as needed on future fields

ALTER TABLE job_source_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies (id-based)
CREATE POLICY "Read own job sources" 
  ON job_source_settings FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Insert own job sources" 
  ON job_source_settings FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Update own job sources" 
  ON job_source_settings FOR UPDATE 
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Delete own job sources" 
  ON job_source_settings FOR DELETE 
  USING (auth.uid() = id);

-- Create table for scraped jobs
CREATE TABLE jobs (
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
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_bookmarked ON jobs(bookmarked);
CREATE INDEX idx_jobs_source_type ON jobs(source_type);
CREATE INDEX idx_jobs_posted_at ON jobs(posted_at);
CREATE INDEX idx_jobs_search_text ON jobs USING gin(to_tsvector('english', title || ' ' || company || ' ' || COALESCE(description, '')));

-- Enable RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for jobs
CREATE POLICY "Users can view their own jobs" 
  ON jobs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs" 
  ON jobs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs" 
  ON jobs FOR UPDATE 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs" 
  ON jobs FOR DELETE 
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

CREATE TRIGGER update_jobs_updated_at 
  BEFORE UPDATE ON jobs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for job statistics
CREATE VIEW job_stats AS
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
FROM jobs
GROUP BY user_id;

-- Grant permissions
GRANT ALL ON job_source_settings TO authenticated;
GRANT ALL ON jobs TO authenticated;
GRANT SELECT ON job_stats TO authenticated;
