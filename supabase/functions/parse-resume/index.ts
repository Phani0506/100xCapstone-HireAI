import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple PDF text extraction function
async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false });
    let text = decoder.decode(uint8Array);
    
    // Clean up PDF artifacts and extract readable text
    text = text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ') // Remove control chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\x20-\x7E\n\r\t]/g, '') // Keep only printable ASCII
      .trim();
    
    // If we get very little text, try a different approach
    if (text.length < 50) {
      // Look for text patterns between common PDF delimiters
      const pdfText = String.fromCharCode(...uint8Array);
      const textMatches = pdfText.match(/\((.*?)\)/g) || [];
      const streamMatches = pdfText.match(/stream(.*?)endstream/gs) || [];
      
      let extractedText = '';
      textMatches.forEach(match => {
        const cleaned = match.slice(1, -1).replace(/\\[rnt]/g, ' ');
        if (cleaned.length > 2 && /[a-zA-Z]/.test(cleaned)) {
          extractedText += cleaned + ' ';
        }
      });
      
      if (extractedText.length > text.length) {
        text = extractedText;
      }
    }
    
    return text.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    return '';
  }
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

    const requestBody = await req.json()
    const { resumeId, filePath } = requestBody
    console.log('Processing resume:', { resumeId, filePath })
    
    // Download the resume file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('resumes')
      .download(filePath)

    if (downloadError) {
      console.error('Download error:', downloadError)
      throw new Error(`Failed to download file: ${downloadError.message}`)
    }

    let extractedText = '';
    
    // Handle different file types
    if (filePath.toLowerCase().endsWith('.pdf')) {
      console.log('Processing PDF file')
      const arrayBuffer = await fileData.arrayBuffer()
      extractedText = await extractTextFromPDF(arrayBuffer)
    } else {
      // For DOC/DOCX files, try text extraction
      extractedText = await fileData.text()
    }
    
    console.log('Extracted text length:', extractedText.length)
    
    // Aggressively truncate to minimize tokens (keep only first 2000 chars)
    const truncatedText = extractedText.length > 2000 ? extractedText.substring(0, 2000) : extractedText
    console.log('Final text length for AI:', truncatedText.length)
    
    if (truncatedText.length < 10) {
      throw new Error('Could not extract readable text from the resume file')
    }
    
    // Minimal, focused prompt to maximize output quality
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
            content: `Extract resume data as JSON:
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

Rules:
- Name is the largest text at top (no "Name:" prefix)
- Find sections: Skills, Experience, Education
- Use null if field not found
- Return only valid JSON`
          },
          {
            role: 'user',
            content: truncatedText
          }
        ],
        temperature: 0,
        max_tokens: 1500,
      }),
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('Groq API error:', errorText)
      throw new Error(`Groq API failed: ${groqResponse.status} ${errorText}`)
    }

    const groqData = await groqResponse.json()
    console.log('Groq response received')

    if (!groqData.choices || !groqData.choices[0] || !groqData.choices[0].message) {
      console.error('Invalid Groq response structure:', groqData)
      throw new Error('Invalid response from Groq API')
    }

    let parsedContent;
    try {
      const content = groqData.choices[0].message.content.trim()
      console.log('AI response length:', content.length)
      
      // Try to extract JSON if response contains extra text
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      const jsonString = jsonMatch ? jsonMatch[0] : content
      
      parsedContent = JSON.parse(jsonString)
      console.log('Successfully parsed AI response')
    } catch (parseError) {
      console.error('Failed to parse AI response:', groqData.choices[0].message.content)
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

    // Store parsed data
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
        raw_text_content: truncatedText,
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
    
    // Update resume status to failed
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      // Get resumeId from original request
      const originalBody = await req.clone().json()
      if (originalBody.resumeId) {
        await supabaseClient
          .from('resumes')
          .update({ parsing_status: 'failed' })
          .eq('id', originalBody.resumeId)
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
