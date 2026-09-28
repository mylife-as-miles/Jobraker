-- Seed Ashby and Lever boards for the ATS job index (verified live 2026-09-27).
INSERT INTO public.ats_companies (ats, board_token, name) VALUES
  ('ashby','ashby','Ashby'), ('ashby','openai','OpenAI'), ('ashby','notion','Notion'), ('ashby','linear','Linear'),
  ('ashby','ramp','Ramp'), ('ashby','supabase','Supabase'), ('ashby','posthog','PostHog'), ('ashby','replit','Replit'),
  ('ashby','cursor','Cursor'), ('ashby','perplexity','Perplexity'), ('ashby','zapier','Zapier'), ('ashby','runway','Runway'),
  ('ashby','modal','Modal'), ('ashby','elevenlabs','ElevenLabs'), ('ashby','clerk','Clerk'), ('ashby','resend','Resend'),
  ('lever','superside','Superside'), ('lever','sonatype','Sonatype'), ('lever','sprypointservices','SpryPoint'),
  ('lever','planner5d','Planner 5D'), ('lever','teecom','TEECOM'), ('lever','rainfocus','RainFocus'), ('lever','veeva','Veeva'),
  ('lever','palantir','Palantir'), ('lever','spotify','Spotify'), ('lever','binance','Binance'), ('lever','toptal','Toptal'),
  ('lever','zoox','Zoox')
ON CONFLICT (ats, board_token) DO NOTHING;
