
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { candidate } = await req.json()
    
    // Generate screening questions based on candidate's profile
    const skills = candidate.skills?.slice(0, 3).join(', ') || 'technical skills'
    const experience = candidate.experience?.[0]?.title || 'your background'
    const name = candidate.name || 'the candidate'
    
    const questions = [
      `What specific experience do you have with ${skills}?`,
      `Can you describe a challenging project you worked on as a ${experience}?`,
      `How do you approach problem-solving when working with ${skills}?`,
      `What interests you most about this role and our company?`,
      `How do you stay updated with the latest trends in your field?`,
      `Can you walk me through your experience with team collaboration?`,
      `What are your salary expectations for this position?`,
      `When would you be available to start if selected?`
    ]
    
    return new Response(
      JSON.stringify({ questions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
