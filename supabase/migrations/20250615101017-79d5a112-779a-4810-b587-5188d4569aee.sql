-- Create resumes storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Enable RLS on main tables
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parsed_resume_details ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policies for resumes table
DROP POLICY IF EXISTS "Users can view their own resumes" ON public.resumes;
DROP POLICY IF EXISTS "Users can create their own resumes" ON public.resumes;
DROP POLICY IF EXISTS "Users can update their own resumes" ON public.resumes;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON public.resumes;

CREATE POLICY "Users can view their own resumes" 
ON public.resumes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own resumes" 
ON public.resumes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own resumes" 
ON public.resumes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resumes" 
ON public.resumes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Drop and recreate RLS policies for parsed_resume_details table
DROP POLICY IF EXISTS "Users can view their own parsed resume details" ON public.parsed_resume_details;
DROP POLICY IF EXISTS "Users can create their own parsed resume details" ON public.parsed_resume_details;
DROP POLICY IF EXISTS "Users can update their own parsed resume details" ON public.parsed_resume_details;
DROP POLICY IF EXISTS "Users can delete their own parsed resume details" ON public.parsed_resume_details;

CREATE POLICY "Users can view their own parsed resume details" 
ON public.parsed_resume_details 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own parsed resume details" 
ON public.parsed_resume_details 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own parsed resume details" 
ON public.parsed_resume_details 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own parsed resume details" 
ON public.parsed_resume_details 
FOR DELETE 
USING (auth.uid() = user_id);