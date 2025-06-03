
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Mail, Phone, MapPin, MessageSquare, Send, BrainCircuit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills_json: string[] | null;
  experience_json: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
  }> | null;
  education_json: Array<{
    degree: string;
    institution: string;
    year: string;
  }> | null;
}

export const AIScreeningAndOutreach = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [screeningQuestions, setScreeningQuestions] = useState<string[]>([]);
  const [outreachMessage, setOutreachMessage] = useState('');
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchCandidates();
    }
  }, [user]);

  const fetchCandidates = async () => {
    try {
      const { data, error } = await supabase
        .from('parsed_resume_details')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const transformedData: Candidate[] = (data || []).map(item => ({
        ...item,
        skills_json: Array.isArray(item.skills_json) ? item.skills_json as string[] : null,
        experience_json: Array.isArray(item.experience_json) ? item.experience_json as Array<{
          title: string;
          company: string;
          duration: string;
          description: string;
        }> : null,
        education_json: Array.isArray(item.education_json) ? item.education_json as Array<{
          degree: string;
          institution: string;
          year: string;
        }> : null,
      }));
      
      setCandidates(transformedData);
    } catch (error: any) {
      toast({
        title: "Error fetching candidates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateScreeningQuestions = async (candidate: Candidate) => {
    if (!candidate) return;
    
    setGeneratingQuestions(true);
    try {
      const response = await supabase.functions.invoke('generate-screening-questions', {
        body: {
          candidate: {
            name: candidate.full_name,
            skills: candidate.skills_json || [],
            experience: candidate.experience_json || [],
            summary: candidate.summary
          }
        }
      });

      if (response.error) throw response.error;
      
      setScreeningQuestions(response.data.questions || [
        `What specific experience do you have with ${candidate.skills_json?.[0] || 'the required technologies'}?`,
        `Can you describe a challenging project you worked on related to ${candidate.experience_json?.[0]?.title || 'your field'}?`,
        `How do you stay updated with the latest trends in ${candidate.skills_json?.[1] || 'technology'}?`,
        `What interests you most about this role and our company?`,
        `Where do you see yourself in 3-5 years?`
      ]);
      
      toast({
        title: "Screening questions generated",
        description: "AI-powered questions based on candidate's profile",
      });
    } catch (error: any) {
      toast({
        title: "Failed to generate questions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const generateOutreachMessage = async (candidate: Candidate) => {
    if (!candidate) return;
    
    setGeneratingOutreach(true);
    try {
      const skills = candidate.skills_json?.slice(0, 3).join(', ') || 'your technical skills';
      const experience = candidate.experience_json?.[0]?.title || 'your professional background';
      
      const message = `Subject: Exciting Opportunity - ${experience} Role

Hi ${candidate.full_name || 'there'},

I hope this message finds you well. I came across your profile and was impressed by your background in ${experience} and expertise in ${skills}.

We have an exciting opportunity that aligns perfectly with your skill set. Our team is looking for talented professionals like yourself who can bring fresh perspectives and drive innovation.

Key highlights of this role:
• Opportunity to work with cutting-edge technologies including ${skills}
• Collaborative environment with experienced professionals
• Competitive compensation and benefits package
• Growth opportunities and career advancement

I would love to discuss this opportunity further and learn more about your career goals. Would you be available for a brief conversation this week?

Looking forward to hearing from you!

Best regards,
[Your Name]
[Your Title]
[Company Name]
[Contact Information]`;

      setOutreachMessage(message);
      
      toast({
        title: "Outreach message generated",
        description: "Personalized message based on candidate's profile",
      });
    } catch (error: any) {
      toast({
        title: "Failed to generate message",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingOutreach(false);
    }
  };

  const sendOutreachEmail = (candidate: Candidate) => {
    if (!candidate.email || !outreachMessage) {
      toast({
        title: "Cannot send email",
        description: "Missing email address or message content",
        variant: "destructive",
      });
      return;
    }

    const subject = encodeURIComponent(`Exciting Opportunity - ${candidate.experience_json?.[0]?.title || 'Professional'} Role`);
    const body = encodeURIComponent(outreachMessage);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${candidate.email}&su=${subject}&body=${body}`;
    
    window.open(gmailUrl, '_blank');
    
    toast({
      title: "Opening Gmail",
      description: "Redirecting to Gmail to send the outreach message",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900">AI Screening & Outreach</h2>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading candidates...</p>
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900">AI Screening & Outreach</h2>
        <Card>
          <CardContent className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">No candidates yet</p>
            <p className="text-sm text-gray-400">Upload resumes to start screening and outreach</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">AI Screening & Outreach</h2>
        <p className="text-gray-600">Generate screening questions and outreach messages for candidates</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidates List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Candidates ({candidates.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedCandidate?.id === candidate.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedCandidate(candidate)}
                  >
                    <h4 className="font-medium">{candidate.full_name || 'Unknown Name'}</h4>
                    <p className="text-sm text-gray-600">{candidate.email}</p>
                    {candidate.skills_json && candidate.skills_json.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {candidate.skills_json.slice(0, 2).map((skill, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Screening & Outreach */}
        <div className="lg:col-span-2">
          {selectedCandidate ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedCandidate.full_name}</CardTitle>
                <CardDescription>
                  {selectedCandidate.email} | {selectedCandidate.phone} | {selectedCandidate.location}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="screening" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="screening">
                      <BrainCircuit className="h-4 w-4 mr-2" />
                      AI Screening
                    </TabsTrigger>
                    <TabsTrigger value="outreach">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Outreach
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="screening" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Screening Questions</h3>
                      <Button 
                        onClick={() => generateScreeningQuestions(selectedCandidate)}
                        disabled={generatingQuestions}
                      >
                        {generatingQuestions ? 'Generating...' : 'Generate Questions'}
                      </Button>
                    </div>
                    
                    {screeningQuestions.length > 0 ? (
                      <div className="space-y-3">
                        {screeningQuestions.map((question, index) => (
                          <div key={index} className="p-3 border rounded-lg bg-gray-50">
                            <p className="font-medium text-sm text-gray-700">Question {index + 1}:</p>
                            <p className="mt-1">{question}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">
                        Click "Generate Questions" to create AI-powered screening questions based on this candidate's profile
                      </p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="outreach" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Outreach Message</h3>
                      <div className="space-x-2">
                        <Button 
                          variant="outline"
                          onClick={() => generateOutreachMessage(selectedCandidate)}
                          disabled={generatingOutreach}
                        >
                          {generatingOutreach ? 'Generating...' : 'Generate Message'}
                        </Button>
                        <Button 
                          onClick={() => sendOutreachEmail(selectedCandidate)}
                          disabled={!outreachMessage || !selectedCandidate.email}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Send via Gmail
                        </Button>
                      </div>
                    </div>
                    
                    <Textarea
                      placeholder="Generate an outreach message or write your own..."
                      value={outreachMessage}
                      onChange={(e) => setOutreachMessage(e.target.value)}
                      rows={12}
                      className="w-full"
                    />
                    
                    {selectedCandidate.email && (
                      <div className="text-sm text-gray-600">
                        <strong>To:</strong> {selectedCandidate.email}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <User className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-gray-500">Select a candidate to begin</p>
                <p className="text-sm text-gray-400">Choose from the candidates list to generate screening questions and outreach messages</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
