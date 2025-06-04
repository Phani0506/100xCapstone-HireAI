import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@3.11.174'
import { extract } from 'https://deno.land/std@0.208.0/archive/unzip.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Enhanced PDF text extraction using pdf.js
async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log('Starting PDF extraction with pdf.js')
    
    // Configure pdf.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
    
    const typedArray = new Uint8Array(arrayBuffer)
    const pdf = await pdfjsLib.getDocument(typedArray).promise
    
    console.log(`PDF loaded successfully, ${pdf.numPages} pages found`)
    
    let fullText = ''
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        
        // Combine all text items from the page
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
        
        fullText += pageText + '\n'
        console.log(`Page ${pageNum} extracted: ${pageText.length} characters`)
      } catch (pageError) {
        console.error(`Error extracting page ${pageNum}:`, pageError)
        continue
      }
    }
    
    console.log(`Total PDF text extracted: ${fullText.length} characters`)
    return fullText.trim()
    
  } catch (error) {
    console.error('PDF.js extraction failed, attempting fallback:', error)
    
    // Fallback to basic extraction
    try {
      const uint8Array = new Uint8Array(arrayBuffer)
      let text = ''
      
      // Convert bytes to string and look for text patterns
      const pdfText = String.fromCharCode(...uint8Array)
      
      // Extract text between parentheses (common PDF text storage)
      const textMatches = pdfText.match(/\((.*?)\)/g) || []
      textMatches.forEach(match => {
        const cleaned = match.slice(1, -1)
          .replace(/\\[rnt]/g, ' ')
          .replace(/\\/g, '')
          .trim()
        if (cleaned.length > 2 && /[a-zA-Z]/.test(cleaned)) {
          text += cleaned + ' '
        }
      })
      
      // Also try to extract from stream objects
      const streamMatches = pdfText.match(/stream(.*?)endstream/gs) || []
      streamMatches.forEach(match => {
        const content = match.replace(/^stream/, '').replace(/endstream$/, '')
        const cleanContent = content.replace(/[^\x20-\x7E\n]/g, ' ').trim()
        if (cleanContent.length > 10) {
          text += cleanContent + ' '
        }
      })
      
      console.log(`Fallback PDF extraction: ${text.length} characters`)
      return text.trim()
      
    } catch (fallbackError) {
      console.error('Fallback PDF extraction also failed:', fallbackError)
      return ''
    }
  }
}

// Enhanced DOCX text extraction using ZIP reader
async function extractTextFromDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log('Starting DOCX extraction')
    
    // Create a temporary file for ZIP extraction
    const tempFileName = `/tmp/temp_docx_${Date.now()}.docx`
    await Deno.writeFile(tempFileName, new Uint8Array(arrayBuffer))
    
    let documentXml = ''
    
    // Extract the ZIP contents
    for await (const entry of extract(tempFileName)) {
      if (entry.name === 'word/document.xml') {
        const content = new TextDecoder().decode(entry.content)
        documentXml = content
        break
      }
    }
    
    // Clean up temp file
    try {
      await Deno.remove(tempFileName)
    } catch {
      // Ignore cleanup errors
    }
    
    if (!documentXml) {
      throw new Error('Could not find document.xml in DOCX file')
    }
    
    // Extract text from XML - look for <w:t> elements
    const textMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
    const extractedText = textMatches
      .map(match => {
        const textContent = match.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '')
        return textContent.trim()
      })
      .filter(text => text.length > 0)
      .join(' ')
    
    // Also try to extract from paragraph text elements
    const paragraphMatches = documentXml.match(/<w:p\b[^>]*>.*?<\/w:p>/gs) || []
    const paragraphText = paragraphMatches
      .map(match => {
        const textElements = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
        return textElements
          .map(textEl => textEl.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
          .join(' ')
      })
      .filter(text => text.trim().length > 0)
      .join('\n')
    
    const finalText = paragraphText || extractedText
    console.log(`DOCX text extracted: ${finalText.length} characters`)
    
    return finalText.trim()
    
  } catch (error) {
    console.error('DOCX extraction error:', error)
    return ''
  }
}

// Enhanced DOC file text extraction
async function extractTextFromDOC(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log('Starting DOC extraction (basic)')
    
    const uint8Array = new Uint8Array(arrayBuffer)
    const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array)
    
    // Filter out binary noise and extract readable sequences
    const readableText = text
      .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ') // Remove control characters
      .replace(/[^\x20-\x7E\s]/g, ' ') // Keep only printable ASCII and whitespace
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    // Extract sequences that look like readable text
    const readableSequences = readableText.match(/[a-zA-Z0-9\s@.,;:'"!?()-]{10,}/g) || []
    const extractedText = readableSequences.join(' ').trim()
    
    console.log(`DOC text extracted: ${extractedText.length} characters`)
    return extractedText
    
  } catch (error) {
    console.error('DOC extraction error:', error)
    return ''
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role for admin operations
      { 
        global: { 
          headers: { Authorization: req.headers.get('Authorization')! } 
        } 
      }
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

    let rawExtractedText = ''
    const lowerFilePath = filePath.toLowerCase()
    
    console.log(`Processing file type for: ${filePath}`)
    
    // Handle different file types with enhanced extraction
    if (lowerFilePath.endsWith('.pdf')) {
      console.log('Processing PDF file with pdf.js')
      const arrayBuffer = await fileData.arrayBuffer()
      rawExtractedText = await extractTextFromPDF(arrayBuffer)
    } else if (lowerFilePath.endsWith('.docx')) {
      console.log('Processing DOCX file with ZIP extraction')
      const arrayBuffer = await fileData.arrayBuffer()
      rawExtractedText = await extractTextFromDOCX(arrayBuffer)
    } else if (lowerFilePath.endsWith('.doc')) {
      console.log('Processing DOC file')
      const arrayBuffer = await fileData.arrayBuffer()
      rawExtractedText = await extractTextFromDOC(arrayBuffer)
    } else if (lowerFilePath.endsWith('.txt')) {
      console.log('Processing TXT file')
      rawExtractedText = await fileData.text()
    } else {
      // Try to process as text
      rawExtractedText = await fileData.text()
    }
    
    console.log('Raw extracted text (first 500 chars):', rawExtractedText.substring(0, 500))
    console.log('Total raw extracted text length:', rawExtractedText.length)
    
    // Clean and prepare text for AI processing - keep much more content
    let cleanText = rawExtractedText
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s@.,-]/g, ' ') // Keep letters, numbers, basic punctuation
      .trim()
    
    // Limit to substantial amount for LLM (15,000-20,000 characters)
    const maxTextLength = 18000
    if (cleanText.length > maxTextLength) {
      cleanText = cleanText.substring(0, maxTextLength)
      // Try to end at a word boundary
      const lastSpace = cleanText.lastIndexOf(' ')
      if (lastSpace > maxTextLength * 0.9) {
        cleanText = cleanText.substring(0, lastSpace)
      }
    }
    
    console.log('Cleaned text length for AI:', cleanText.length)
    
    if (cleanText.length < 100) {
      console.error('Insufficient text extracted for processing')
      
      // Update resume status to failed_no_text
      await supabaseClient
        .from('resumes')
        .update({ parsing_status: 'failed_no_text' })
        .eq('id', resumeId)
        
      throw new Error('Could not extract sufficient text from the resume file (less than 100 characters)')
    }
    
    // Enhanced Groq API call with strict JSON-only system prompt
    const systemPrompt = `You are an expert resume parsing API. Your sole function is to extract information from the provided resume text and return ONLY a valid JSON object.

CRITICAL RULES:
1. Your ENTIRE response MUST be a single, valid JSON object. It must start with { and end with }.
2. ABSOLUTELY NO other text, explanations, apologies, conversational remarks, or markdown formatting (like \`\`\`json) should be present in your response.
3. If specific information is not found, use JSON \`null\` for string/object fields and an empty array \`[]\` for list fields. DO NOT use empty strings "" unless the value is explicitly an empty string in the resume.
4. Extract information as accurately as possible. Do not invent details or infer beyond what's present.
5. For lists like skills, experience, and education, ensure they are valid JSON arrays. If multiple entries are found for experience or education, include all of them as objects within the array.
6. Pay attention to typical resume structures:
   * The candidate's full name is often a prominent heading at the top.
   * Contact information (email, phone, location) is usually grouped near the name or at the end.
   * Sections like "Skills", "Experience", "Work History", "Projects", "Education" usually have these words as headings. Extract the content listed under these headings.
   * For experience, try to capture bullet points or paragraphs describing responsibilities and achievements for each role.

REQUIRED JSON STRUCTURE (Adhere strictly to this. Field names must be exact):
{
  "full_name": "Candidate's full name or null",
  "email": "Primary email address or null",
  "phone": "Primary phone number or null",
  "location": "Candidate's location (e.g., City, ST) or null",
  "summary": "A brief professional summary or objective if clearly present (2-4 sentences), otherwise null",
  "skills": ["List of distinct skills. Examples: Python, JavaScript, Project Management, Agile Methodologies"],
  "experience": [
    {
      "title": "Job title or null",
      "company": "Company name or null",
      "duration": "Employment duration (e.g., Jan 2020 - Present, 05/2018 - 12/2019) or null",
      "description": "Detailed bullet points or paragraph describing responsibilities/achievements. This can be a single string with newlines preserved, or an array of strings. Or null."
    }
  ],
  "education": [
    {
      "degree": "Degree obtained (e.g., Bachelor of Science in Computer Science) or null",
      "institution": "Name of the educational institution or null",
      "year": "Graduation year or period (e.g., 2020, May 2019 - June 2021) or null"
    }
  ]
}`

    console.log('Calling Groq API with enhanced prompt')
    
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192', // Using the more powerful model
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Extract information from this resume text:\n\n${cleanText}`
          }
        ],
        temperature: 0.0, // Deterministic output for consistent parsing
        max_tokens: 3500, // Allow for detailed JSON with comprehensive descriptions
        top_p: 0.1, // Focus on most likely responses
      }),
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('Groq API error:', errorText)
      throw new Error(`Groq API failed: ${groqResponse.status} - ${errorText}`)
    }

    const groqData = await groqResponse.json()
    console.log('Groq response received')

    if (!groqData.choices || !groqData.choices[0] || !groqData.choices[0].message) {
      throw new Error('Invalid response structure from Groq API')
    }

    let parsedContent
    let aiParsingError = null
    
    try {
      const content = groqData.choices[0].message.content.trim()
      console.log('AI raw response (first 500 chars):', content.substring(0, 500))
      
      // Try to extract JSON from response
      let jsonString = content
      
      // Remove any markdown formatting
      jsonString = jsonString.replace(/```json\s*/, '').replace(/```\s*$/, '')
      
      // Find JSON object boundaries
      const jsonStart = jsonString.indexOf('{')
      const jsonEnd = jsonString.lastIndexOf('}')
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonString = jsonString.substring(jsonStart, jsonEnd + 1)
      }
      
      parsedContent = JSON.parse(jsonString)
      console.log('Successfully parsed AI response')
      
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError)
      console.error('Problematic AI response:', groqData.choices[0].message.content)
      
      aiParsingError = `JSON parsing failed: ${parseError.message}`
      
      // Enhanced fallback parsing using the high-quality extracted text
      console.log('Using enhanced fallback parsing')
      parsedContent = {
        full_name: extractNameFromText(cleanText),
        email: extractEmailFromText(cleanText),
        phone: extractPhoneFromText(cleanText),
        location: extractLocationFromText(cleanText),
        summary: extractSummaryFromText(cleanText),
        skills: extractSkillsFromText(cleanText),
        experience: extractExperienceFromText(cleanText),
        education: extractEducationFromText(cleanText),
        ai_parsing_error: aiParsingError
      }
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

    // Store parsed data in the database
    const insertData = {
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
    }
    
    // Add AI parsing error if it exists
    if (aiParsingError) {
      insertData.ai_parsing_error = aiParsingError
    }

    const { error: insertError } = await supabaseClient
      .from('parsed_resume_details')
      .insert(insertData)

    if (insertError) {
      throw new Error(`Failed to store parsed data: ${insertError.message}`)
    }

    // Update resume status to completed
    await supabaseClient
      .from('resumes')
      .update({ parsing_status: 'completed' })
      .eq('id', resumeId)

    console.log('Resume parsing completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        parsedData: parsedContent,
        textLength: cleanText.length,
        aiParsingUsed: !aiParsingError
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error parsing resume:', error)
    
    // Update resume status to failed
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      const requestBody = await req.json()
      if (requestBody.resumeId) {
        const status = error.message.includes('insufficient text') ? 'failed_no_text' : 'failed_exception'
        await supabaseClient
          .from('resumes')
          .update({ parsing_status: status })
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

// Enhanced helper functions for fallback parsing
function extractNameFromText(text: string): string | null {
  const lines = text.split(/\n|\r\n/).map(line => line.trim()).filter(line => line.length > 0)
  
  // Look for name patterns in first few lines
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i]
    
    // Skip obvious non-name lines
    if (line.toLowerCase().includes('resume') || 
        line.toLowerCase().includes('cv') ||
        line.toLowerCase().includes('curriculum') ||
        line.includes('@') ||
        /^\d/.test(line) ||
        line.length < 3 ||
        line.length > 60) {
      continue
    }
    
    // Look for name-like patterns
    if (/^[A-Z][a-z]+ [A-Z][a-z]+/.test(line) || 
        /^[A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+/.test(line) ||
        /^[A-Z][A-Z\s]+$/.test(line)) {
      return line.trim()
    }
  }
  
  return null
}

function extractEmailFromText(text: string): string | null {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = text.match(emailPattern)
  return matches ? matches[0] : null
}

function extractPhoneFromText(text: string): string | null {
  const phonePatterns = [
    /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/,
    /(\+?[1-9]\d{0,3}[-.\s]?)?(\d{1,4}[-.\s]?){1,4}\d{1,9}/
  ]
  
  for (const pattern of phonePatterns) {
    const match = text.match(pattern)
    if (match) {
      return match[0].trim()
    }
  }
  return null
}

function extractLocationFromText(text: string): string | null {
  const locationPatterns = [
    /([A-Z][a-z]+,\s*[A-Z]{2,})/,
    /([A-Z][a-z\s]+,\s*[A-Z][a-z\s]+)/,
    /([A-Z][a-z]+\s*,\s*[A-Z][a-z]+\s*,\s*[A-Z]{2,})/
  ]
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }
  return null
}

function extractSummaryFromText(text: string): string | null {
  const summaryKeywords = ['summary', 'objective', 'profile', 'about', 'overview']
  const sections = text.toLowerCase().split(/\n\s*\n/)
  
  for (const section of sections) {
    for (const keyword of summaryKeywords) {
      if (section.includes(keyword) && section.length > 50 && section.length < 500) {
        return section.replace(new RegExp(keyword, 'gi'), '').trim()
      }
    }
  }
  return null
}

function extractSkillsFromText(text: string): string[] {
  const skillsKeywords = ['skills', 'technical skills', 'competencies', 'technologies', 'tools']
  const commonSkills = [
    'javascript', 'python', 'java', 'react', 'angular', 'vue', 'node', 'html', 'css',
    'sql', 'mongodb', 'postgresql', 'mysql', 'aws', 'azure', 'docker', 'kubernetes', 'git',
    'typescript', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'flutter', 'django',
    'spring', 'express', 'laravel', 'rails', 'tensorflow', 'pytorch', 'machine learning',
    'artificial intelligence', 'data science', 'blockchain', 'microservices', 'devops',
    'agile', 'scrum', 'project management', 'leadership', 'communication'
  ]
  
  const foundSkills: string[] = []
  const lowerText = text.toLowerCase()
  
  // Look for skills in dedicated sections
  const sections = text.split(/\n\s*\n/)
  for (const section of sections) {
    const lowerSection = section.toLowerCase()
    if (skillsKeywords.some(keyword => lowerSection.includes(keyword))) {
      // Extract skills from this section
      for (const skill of commonSkills) {
        if (lowerSection.includes(skill) && !foundSkills.includes(skill)) {
          foundSkills.push(skill.charAt(0).toUpperCase() + skill.slice(1))
        }
      }
    }
  }
  
  // If no dedicated section found, search entire text
  if (foundSkills.length === 0) {
    for (const skill of commonSkills) {
      if (lowerText.includes(skill)) {
        foundSkills.push(skill.charAt(0).toUpperCase() + skill.slice(1))
      }
    }
  }
  
  return foundSkills.slice(0, 15) // Limit to 15 skills
}

function extractExperienceFromText(text: string): Array<{title: string, company: string, duration: string, description: string}> {
  const experience = []
  const experienceKeywords = ['experience', 'employment', 'work history', 'professional experience']
  const sections = text.split(/\n\s*\n/)
  
  for (const section of sections) {
    const lowerSection = section.toLowerCase()
    if (experienceKeywords.some(keyword => lowerSection.includes(keyword)) && section.length > 100) {
      // Try to parse experience entries
      const lines = section.split('\n').filter(line => line.trim().length > 10)
      
      for (let i = 0; i < lines.length && experience.length < 5; i++) {
        const line = lines[i].trim()
        if (line.toLowerCase().includes('developer') || 
            line.toLowerCase().includes('engineer') || 
            line.toLowerCase().includes('manager') || 
            line.toLowerCase().includes('analyst') ||
            line.toLowerCase().includes('specialist')) {
          
          const nextLines = lines.slice(i + 1, i + 4).join(' ')
          experience.push({
            title: line.length > 100 ? line.substring(0, 100) : line,
            company: 'Not specified',
            duration: 'Not specified',
            description: nextLines.length > 200 ? nextLines.substring(0, 200) : nextLines
          })
        }
      }
    }
  }
  
  return experience
}

function extractEducationFromText(text: string): Array<{degree: string, institution: string, year: string}> {
  const education = []
  const educationKeywords = ['education', 'academic background', 'qualifications', 'degree']
  const degreeKeywords = ['bachelor', 'master', 'phd', 'doctorate', 'diploma', 'certificate', 'degree']
  
  const sections = text.split(/\n\s*\n/)
  
  for (const section of sections) {
    const lowerSection = section.toLowerCase()
    if (educationKeywords.some(keyword => lowerSection.includes(keyword))) {
      const lines = section.split('\n').filter(line => line.trim().length > 5)
      
      for (const line of lines) {
        const lowerLine = line.toLowerCase()
        if (degreeKeywords.some(keyword => lowerLine.includes(keyword))) {
          education.push({
            degree: line.trim().length > 100 ? line.trim().substring(0, 100) : line.trim(),
            institution: 'Not specified',
            year: 'Not specified'
          })
          break // Only one education entry for simplicity
        }
      }
    }
  }
  
  return education
}
