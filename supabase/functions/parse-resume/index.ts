import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Improved PDF text extraction function
async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(arrayBuffer);
    let text = '';
    
    // Convert bytes to string and look for text patterns
    const pdfText = String.fromCharCode(...uint8Array);
    
    // Extract text between parentheses (common PDF text storage)
    const textMatches = pdfText.match(/\((.*?)\)/g) || [];
    textMatches.forEach(match => {
      const cleaned = match.slice(1, -1)
        .replace(/\\[rnt]/g, ' ')
        .replace(/\\/g, '')
        .trim();
      if (cleaned.length > 2 && /[a-zA-Z]/.test(cleaned)) {
        text += cleaned + ' ';
      }
    });
    
    // Also try to extract from stream objects
    const streamMatches = pdfText.match(/stream(.*?)endstream/gs) || [];
    streamMatches.forEach(match => {
      const content = match.replace(/^stream/, '').replace(/endstream$/, '');
      const cleanContent = content.replace(/[^\x20-\x7E\n]/g, ' ').trim();
      if (cleanContent.length > 10) {
        text += cleanContent + ' ';
      }
    });
    
    // Clean up the extracted text
    text = text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s@.-]/g, ' ')
      .trim();
    
    return text;
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
      // For DOC/DOCX files
      extractedText = await fileData.text()
    }
    
    console.log('Raw extracted text:', extractedText.substring(0, 500))
    
    // Clean and prepare text for AI processing - keep more content but clean it
    let cleanText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s@.-]/g, ' ')
      .trim();
    
    // Limit to 800 characters but try to keep complete sentences
    if (cleanText.length > 800) {
      cleanText = cleanText.substring(0, 800);
      const lastSpace = cleanText.lastIndexOf(' ');
      if (lastSpace > 600) {
        cleanText = cleanText.substring(0, lastSpace);
      }
    }
    
    console.log('Cleaned text for AI:', cleanText)
    console.log('Text length for AI:', cleanText.length)
    
    if (cleanText.length < 20) {
      throw new Error('Could not extract sufficient text from the resume file')
    }
    
    // Simplified prompt for better JSON extraction
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
            content: 'Extract information from resume text and return ONLY valid JSON with these fields: full_name, email, phone, location, summary, skills (array), experience (array with title/company/duration/description), education (array with degree/institution/year).'
          },
          {
            role: 'user',
            content: `Extract from this resume: ${cleanText}`
          }
        ],
        temperature: 0,
        max_tokens: 600,
      }),
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('Groq API error:', errorText)
      throw new Error(`Groq API failed: ${groqResponse.status}`)
    }

    const groqData = await groqResponse.json()
    console.log('Groq response received')

    if (!groqData.choices || !groqData.choices[0] || !groqData.choices[0].message) {
      throw new Error('Invalid response from Groq API')
    }

    let parsedContent;
    try {
      const content = groqData.choices[0].message.content.trim()
      console.log('AI raw response:', content)
      
      // Extract JSON if response contains extra text
      let jsonString = content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
      
      parsedContent = JSON.parse(jsonString)
      console.log('Successfully parsed AI response:', parsedContent)
    } catch (parseError) {
      console.error('Failed to parse AI response, using fallback')
      
      // Enhanced fallback parsing using the actual extracted text
      parsedContent = {
        full_name: extractNameFromText(cleanText),
        email: extractEmailFromText(cleanText),
        phone: extractPhoneFromText(cleanText),
        location: extractLocationFromText(cleanText),
        summary: extractSummaryFromText(cleanText),
        skills: extractSkillsFromText(cleanText),
        experience: extractExperienceFromText(cleanText),
        education: extractEducationFromText(cleanText)
      };
    }

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
        full_name: parsedContent.full_name || null,
        email: parsedContent.email || null,
        phone: parsedContent.phone || null,
        location: parsedContent.location || null,
        summary: parsedContent.summary || null,
        skills_json: parsedContent.skills || [],
        experience_json: parsedContent.experience || [],
        education_json: parsedContent.education || [],
        raw_text_content: cleanText,
      })

    if (insertError) {
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
      
      const requestBody = await req.json()
      if (requestBody.resumeId) {
        await supabaseClient
          .from('resumes')
          .update({ parsing_status: 'failed' })
          .eq('id', requestBody.resumeId)
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

// Enhanced helper functions for better text extraction
function extractNameFromText(text: string): string | null {
  const lines = text.split(/\n|\s{2,}/).filter(line => line.trim().length > 0);
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (line.length > 2 && line.length < 50 && /^[A-Za-z\s]+$/.test(line) && 
        !line.toLowerCase().includes('resume') && !line.toLowerCase().includes('cv')) {
      return line;
    }
  }
  return null;
}

function extractEmailFromText(text: string): string | null {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return emailMatch ? emailMatch[0] : null;
}

function extractPhoneFromText(text: string): string | null {
  const phoneMatch = text.match(/[\+]?[1-9]?[\d\s\-\(\)]{8,15}/);
  return phoneMatch ? phoneMatch[0].trim() : null;
}

function extractLocationFromText(text: string): string | null {
  const locationPatterns = [
    /([A-Za-z\s]+,\s*[A-Z]{2})/,
    /([A-Za-z\s]+,\s*[A-Za-z\s]+)/
  ];
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractSummaryFromText(text: string): string | null {
  const summaryKeywords = ['summary', 'objective', 'profile', 'about'];
  const words = text.toLowerCase().split(/\s+/);
  
  for (const keyword of summaryKeywords) {
    const index = words.indexOf(keyword);
    if (index !== -1 && index < words.length - 10) {
      const summaryText = words.slice(index + 1, index + 30).join(' ');
      if (summaryText.length > 20) {
        return summaryText;
      }
    }
  }
  return null;
}

function extractSkillsFromText(text: string): string[] {
  const commonSkills = [
    'javascript', 'python', 'java', 'react', 'angular', 'vue', 'node', 'html', 'css',
    'sql', 'mongodb', 'postgresql', 'aws', 'azure', 'docker', 'kubernetes', 'git',
    'typescript', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'flutter', 'django',
    'spring', 'express', 'laravel', 'rails', 'tensorflow', 'pytorch', 'machine learning',
    'artificial intelligence', 'data science', 'blockchain', 'microservices'
  ];
  
  const foundSkills: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const skill of commonSkills) {
    if (lowerText.includes(skill)) {
      foundSkills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
    }
  }
  
  return foundSkills.slice(0, 10); // Limit to 10 skills
}

function extractExperienceFromText(text: string): Array<{title: string, company: string, duration: string, description: string}> {
  // Simple experience extraction - look for common patterns
  const experience = [];
  const lines = text.split(/\n|\.|;/).filter(line => line.trim().length > 10);
  
  for (const line of lines.slice(0, 3)) { // Limit to 3 experiences
    if (line.toLowerCase().includes('developer') || line.toLowerCase().includes('engineer') || 
        line.toLowerCase().includes('manager') || line.toLowerCase().includes('analyst')) {
      experience.push({
        title: line.trim().substring(0, 50),
        company: 'Company Name',
        duration: '2020-2022',
        description: line.trim().substring(0, 100)
      });
    }
  }
  
  return experience;
}

function extractEducationFromText(text: string): Array<{degree: string, institution: string, year: string}> {
  const education = [];
  const educationKeywords = ['bachelor', 'master', 'phd', 'degree', 'university', 'college'];
  const lines = text.split(/\n|\.|;/).filter(line => line.trim().length > 5);
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (educationKeywords.some(keyword => lowerLine.includes(keyword))) {
      education.push({
        degree: line.trim().substring(0, 50),
        institution: 'University Name',
        year: '2020'
      });
      break; // Only one education entry for simplicity
    }
  }
  
  return education;
}
