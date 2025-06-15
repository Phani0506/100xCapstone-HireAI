import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// A best-effort PDF text extraction function.
// WARNING: This is highly unreliable for complex or compressed PDFs.
// It attempts to find plain text streams, but may miss a lot of content.
// For production, a dedicated PDF parsing library or service is recommended.
async function extractTextFromPDF(arrayBuffer) {
  try {
    const uint8Array = new Uint8Array(arrayBuffer);
    let text = '';
    
    // Convert bytes to a string-like representation to find text patterns
    // This is a simplified approach and might not work for all encodings
    let pdfAsString = '';
    for (let i = 0; i < uint8Array.length; i++) {
        pdfAsString += String.fromCharCode(uint8Array[i]);
    }

    // Attempt to extract text from stream objects, which is where content often lives
    const streamMatches = pdfAsString.match(/stream([\s\S]*?)endstream/g) || [];
    
    for (const stream of streamMatches) {
      // Basic cleaning of stream content
      const content = stream
        .replace(/^stream\r?\n/, '')
        .replace(/\r?\nendstream$/, '');

      // Look for text within parentheses, a common pattern in PDF content (TJ operator)
      const textMatches = content.match(/\((.*?)\)/g) || [];
      textMatches.forEach((match) => {
        const cleaned = match
          .slice(1, -1) // Remove parentheses
          .replace(/\\(r|n|t)/g, ' ') // Replace escape sequences
          .replace(/\\/g, '') // Remove other backslashes
          .trim();
        
        // Add if it looks like meaningful text
        if (cleaned.length > 2 && /[a-zA-Z]/.test(cleaned)) {
          text += cleaned + ' ';
        }
      });
    }

    // Final cleanup
    text = text.replace(/\s+/g, ' ').trim();
    console.log(`Extracted ${text.length} characters from PDF.`);
    return text;
  } catch (error) {
    console.error('PDF extraction error:', error);
    return '';
  }
}

// Helper functions for fallback parsing (if AI fails)
function extractEmailFromText(text) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}
function extractPhoneFromText(text) {
    // A more robust regex for various phone formats
    const match = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    return match ? match[0] : null;
}
// Add other simple regex-based fallbacks if needed...

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Define these outside the try block so they are accessible in the catch block
  let resumeId;

  try {
    const requestBody = await req.json();
    resumeId = requestBody.resumeId; // Assign here
    const { filePath } = requestBody;

    if (!resumeId || !filePath) {
      throw new Error('Missing resumeId or filePath in the request body.');
    }
    
    console.log('Processing resume:', { resumeId, filePath });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from('resumes')
      .download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    let extractedText = '';
    const lowerFilePath = filePath.toLowerCase();

    if (lowerFilePath.endsWith('.pdf')) {
      console.log('Processing PDF file...');
      const arrayBuffer = await fileData.arrayBuffer();
      extractedText = await extractTextFromPDF(arrayBuffer);
    } else if (lowerFilePath.endsWith('.txt')) {
      console.log('Processing TXT file...');
      extractedText = await fileData.text();
    } else {
      // Reject unsupported files like .doc, .docx, .pages, etc.
      throw new Error(`Unsupported file type: ${filePath}. Please upload a PDF or TXT file.`);
    }

    console.log('Raw extracted text (first 500 chars):', extractedText.substring(0, 500));

    if (extractedText.length < 50) {
      throw new Error('Could not extract sufficient text from the file. It might be empty, corrupted, or an image-based PDF.');
    }

    // Clean and limit text for the AI
    let cleanText = extractedText.replace(/\s+/g, ' ').trim();
    if (cleanText.length > 4000) { // Keep a generous amount for the AI
      cleanText = cleanText.substring(0, 4000);
    }
    
    console.log(`Sending ${cleanText.length} characters to AI.`);

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are an expert resume parsing assistant. Analyze the provided resume text and extract key information. Your response MUST be a single, valid JSON object and nothing else. The JSON object should have these fields: "full_name" (string), "email" (string), "phone" (string), "location" (string), "summary" (string), "skills" (array of strings), "experience" (array of objects with "title", "company", "duration", "description" fields), "education" (array of objects with "degree", "institution", "year" fields). If a field is not found, use null or an empty array.'
          },
          { role: 'user', content: `Extract data from this resume text: ${cleanText}` }
        ],
        // **THIS IS THE KEY FIX FOR RELIABLE JSON**
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2048,
      })
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', errorText);
      throw new Error(`Groq API failed with status: ${groqResponse.status}`);
    }

    const groqData = await groqResponse.json();
    const messageContent = groqData.choices?.[0]?.message?.content;

    if (!messageContent) {
      throw new Error('Invalid or empty response from Groq AI.');
    }

    console.log('AI raw response:', messageContent);

    let parsedContent;
    try {
      parsedContent = JSON.parse(messageContent);
    } catch (parseError) {
      console.error('Failed to parse JSON from AI response:', parseError);
      // Fallback if AI fails to produce valid JSON despite instructions
      parsedContent = {
        full_name: null,
        email: extractEmailFromText(cleanText),
        phone: extractPhoneFromText(cleanText),
        location: null, summary: null, skills: [], experience: [], education: []
      };
      throw new Error('AI response was not valid JSON. Using fallback data.');
    }
    
    console.log('Successfully parsed AI response.');

    const { data: resumeData, error: resumeError } = await supabaseClient
      .from('resumes').select('user_id').eq('id', resumeId).single();

    if (resumeError) throw new Error(`Failed to get resume user_id: ${resumeError.message}`);

    const { error: insertError } = await supabaseClient.from('parsed_resume_details').insert({
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
      raw_text_content: cleanText
    });

    if (insertError) throw new Error(`Failed to store parsed data: ${insertError.message}`);

    await supabaseClient.from('resumes').update({ parsing_status: 'completed' }).eq('id', resumeId);

    console.log('Resume parsing completed successfully for resumeId:', resumeId);
    return new Response(JSON.stringify({ success: true, parsedData: parsedContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`Error processing resume ${resumeId}:`, error.message);
    
    // Update resume status to 'failed' only if we have a resumeId
    if (resumeId) {
      try {
        const supabaseClientForError = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          // Use service role key for error updates if needed, or pass auth from request
          { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );
        await supabaseClientForError.from('resumes').update({ parsing_status: 'failed' }).eq('id', resumeId);
        console.log(`Updated resume ${resumeId} status to 'failed'.`);
      } catch (updateError) {
        console.error('Fatal: Failed to update resume status to failed.', updateError);
      }
    }
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});