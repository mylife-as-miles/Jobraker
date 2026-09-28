-- Seed SmartRecruiters, Workable, Teamtailor, Breezy, Rippling and BambooHR
-- boards for the ATS job index (verified live with the adapters, 2026-09-27).
-- Teamtailor board_token is the careers host or subdomain.
INSERT INTO public.ats_companies (ats, board_token, name) VALUES
  ('smartrecruiters','Experian','Experian'), ('smartrecruiters','JobsForHumanity','Jobs for Humanity'),
  ('smartrecruiters','lakeshore','Lakeshore Learning'), ('smartrecruiters','Loram1','Loram'), ('smartrecruiters','PDDNINC','PDDN Inc.'),
  ('workable','hospitable','Hospitable'), ('workable','huggingface','Hugging Face'), ('workable','fuseenergy','Fuse Energy'),
  ('workable','renewhome','Renew Home'), ('workable','worknomads','WorkNomads'), ('workable','tjm-labs-1','TJM Labs'),
  ('workable','gramian','Gramian Consulting Group'), ('workable','remofirst','Remofirst'), ('workable','huzzle','Huzzle'),
  ('workable','surglobal','Sur'),
  ('teamtailor','career.teamtailor.com','Teamtailor'), ('teamtailor','virtasant','Virtasant'), ('teamtailor','upstart13','Upstart 13'),
  ('teamtailor','crystalintelligence','Crystal Intelligence'), ('teamtailor','eubestjobs','EU Best Jobs'),
  ('breezy','20four7va','20four7VA'), ('breezy','urrly','Urrly'), ('breezy','freeeup','FreeUp'), ('breezy','gsd-staffing','GSD Staffing'),
  ('breezy','continued','Continued'), ('breezy','vetsez','VetsEZ'), ('breezy','inspiring-lives-today','Inspiring Lives Today'),
  ('rippling','rippling','Rippling'), ('rippling','swoopishiring','Swoop'), ('rippling','whisker-labs-careers','Ting Labs'),
  ('rippling','engagecx','EngageCX'), ('rippling','torus','Torus'), ('rippling','scope3pbc','Scope3'),
  ('rippling','foundant-careers','Foundant'), ('rippling','aalyria-careers','Aalyria'), ('rippling','netatwork','Net at Work'),
  ('rippling','complycareers','Comply'), ('rippling','buxtoncocareers','Buxton'),
  ('bamboohr','axiosint','Axios')
ON CONFLICT (ats, board_token) DO NOTHING;
