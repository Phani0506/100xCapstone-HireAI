
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
    console.log('Processing resume:', { resumeId, filePath })
    
    // Download the resume file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('resumes')
      .download(filePath)

    if (downloadError) {
      console.error('Download error:', downloadError)
      throw new Error(`Failed to download file: ${downloadError.message}`)
    }

    // Convert file to text (simplified - in production you'd use proper PDF/DOC parsing)
    const fileText = await fileData.text()
    console.log('File text length:', fileText.length)
    
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
            
            IMPORTANT PARSING RULES:
            1. For name: Look for the largest/most prominent text at the top, usually in heading format without any prefix like "Name:"
            2. For other sections: Look for section headings like "Skills", "Experience", "Education", "Work Experience", etc.
            3. If any field is not found, use null or empty array as appropriate
            4. Return ONLY valid JSON, no additional text or explanations.`
          },
          {
            role: 'user',
            content: `Parse this resume text and extract the information according to the schema: ${fileText}`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('Groq API error:', errorText)
      throw new Error(`Groq API failed: ${groqResponse.status} ${errorText}`)
    }

    const groqData = await groqResponse.json()
    console.log('Groq response:', groqData)

    if (!groqData.choices || !groqData.choices[0] || !groqData.choices[0].message) {
      console.error('Invalid Groq response structure:', groqData)
      throw new Error('Invalid response from Groq API')
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(groqData.choices[0].message.content)
      console.log('Parsed content:', parsedContent)
    } catch (parseError) {
      console.error('Failed to parse Groq response as JSON:', groqData.choices[0].message.content)
      throw new Error('Failed to parse AI response as JSON')
    }

    // Get user ID from the resume record
    const { data: resumeData, error: resumeError } = await supabaseClient
      .from('resumes')
      .select('user_id')
      .eq('id', resumeId)
      .single()

    if (resumeError) {
      console.error('Resume fetch error:', resumeError)
      throw new Error(`Failed to get resume data: ${resumeError.message}`)
    }

    // Store parsed data with proper handling of null values
    const { error: insertError } = await supabaseClient
      .from('parsed_resume_details')
      .insert({
        resume_id: resumeId,
        user_id: resumeData.user_id,
        full_name: parsedContent.full_name || null,
        email: parsedContent.email || null,
        phone: parsedContent.phone || null,
        location: parsedContent.location || null,
        summary: parsedContent.summary || null,
        skills_json: parsedContent.skills || [],
        experience_json: parsedContent.experience || [],
        education_json: parsedContent.education || [],
        raw_text_content: fileText,
      })

    if (insertError) {
      console.error('Insert error:', insertError)
      throw new Error(`Failed to store parsed data: ${insertError.message}`)
    }

    // Update resume status
    await supabaseClient
      .from('resumes')
      .update({ parsing_status: 'completed' })
      .eq('id', resumeId)

    console.log('Resume parsing completed successfully')

    return new Response(
      JSON.stringify({ success: true, parsedData: parsedContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error parsing resume:', error)
    
    // Update resume status to failed if we have the resumeId
    try {
      const body = await req.clone().json()
      if (body.resumeId) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )
        
        await supabaseClient
          .from('resumes')
          .update({ parsing_status: 'failed' })
          .eq('id', body.resumeId)
      }
    } catch (updateError) {
      console.error('Failed to update resume status:', updateError)
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
