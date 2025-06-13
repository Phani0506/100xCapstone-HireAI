-- Fix storage bucket to be public
UPDATE storage.buckets SET public = true WHERE id = 'resumes';

-- Enable RLS on tables (if not already enabled)
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parsed_resume_details ENABLE ROW LEVEL SECURITY;

-- Reset stuck resumes to pending so they can be reprocessed
UPDATE public.resumes 
SET parsing_status = 'pending' 
WHERE parsing_status = 'processing';