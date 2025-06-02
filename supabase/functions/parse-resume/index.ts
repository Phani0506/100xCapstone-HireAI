
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { resumeId, filePath } = await req.json()
    
    // Download the resume file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('resumes')
      .download(filePath)

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`)
    }

    // Convert file to text (simplified - in production you'd use proper PDF/DOC parsing)
    const fileText = await fileData.text()
    
    // Call Groq API for parsing
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: `You are an AI resume parser. Extract structured information from resumes and return it as valid JSON with the following schema:
            {
              "full_name": "string",
              "email": "string", 
              "phone": "string",
              "location": "string",
              "summary": "string",
              "skills": ["skill1", "skill2"],
              "experience": [
                {
                  "title": "string",
                  "company": "string", 
                  "duration": "string",
                  "description": "string"
                }
              ],
              "education": [
                {
                  "degree": "string",
                  "institution": "string",
                  "year": "string"
                }
              ]
            }
            Return only valid JSON, no additional text.`
          },
          {
            role: 'user',
            content: `Parse this resume text: ${fileText}`
          }
        ],
        temperature: 0.1,
      }),
    })

    const groqData = await groqResponse.json()
    const parsedContent = JSON.parse(groqData.choices[0].message.content)

    // Get user ID from the resume record
    const { data: resumeData, error: resumeError } = await supabaseClient
      .from('resumes')
      .select('user_id')
      .eq('id', resumeId)
      .single()

    if (resumeError) {
      throw new Error(`Failed to get resume data: ${resumeError.message}`)
    }

    // Store parsed data
    const { error: insertError } = await supabaseClient
      .from('parsed_resume_details')
      .insert({
        resume_id: resumeId,
        user_id: resumeData.user_id,
        full_name: parsedContent.full_name,
        email: parsedContent.email,
        phone: parsedContent.phone,
        location: parsedContent.location,
        summary: parsedContent.summary,
        skills_json: parsedContent.skills,
        experience_json: parsedContent.experience,
        education_json: parsedContent.education,
        raw_text_content: fileText,
      })

    if (insertError) {
      throw new Error(`Failed to store parsed data: ${insertError.message}`)
    }

    // Update resume status
    await supabaseClient
      .from('resumes')
      .update({ parsing_status: 'completed' })
      .eq('id', resumeId)

    return new Response(
      JSON.stringify({ success: true, parsedData: parsedContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error parsing resume:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
