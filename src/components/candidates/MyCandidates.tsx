
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, MapPin, FileText, Eye } from 'lucide-react';
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
  skills_json: string[];
  experience_json: any[];
  education_json: any[];
  created_at: string;
}

export const MyCandidates = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
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
      setCandidates(data || []);
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

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900">My Candidates</h2>
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
        <h2 className="text-3xl font-bold text-gray-900">My Candidates</h2>
        <Card>
          <CardContent className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">No candidates yet</p>
            <p className="text-sm text-gray-400">Upload resumes to start building your talent pool</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">My Candidates</h2>
        <p className="text-gray-600">Manage your parsed candidate profiles ({candidates.length} total)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {candidates.map((candidate) => (
          <Card key={candidate.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{candidate.full_name || 'Unknown Name'}</CardTitle>
                  <CardDescription className="mt-1">
                    {candidate.summary ? 
                      candidate.summary.substring(0, 100) + (candidate.summary.length > 100 ? '...' : '')
                      : 'No summary available'
                    }
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCandidate(candidate)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {candidate.email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="h-4 w-4 mr-2" />
                    {candidate.email}
                  </div>
                )}
                {candidate.phone && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="h-4 w-4 mr-2" />
                    {candidate.phone}
                  </div>
                )}
                {candidate.location && (
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    {candidate.location}
                  </div>
                )}
                
                {candidate.skills_json && candidate.skills_json.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Top Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {candidate.skills_json.slice(0, 5).map((skill, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {candidate.skills_json.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{candidate.skills_json.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-bold">{selectedCandidate.full_name}</h3>
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedCandidate(null)}
                >
                  ×
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Contact Information</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Email:</strong> {selectedCandidate.email}</p>
                    <p><strong>Phone:</strong> {selectedCandidate.phone}</p>
                    <p><strong>Location:</strong> {selectedCandidate.location}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedCandidate.skills_json?.map((skill, index) => (
                      <Badge key={index} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              
              {selectedCandidate.summary && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <p className="text-sm text-gray-700">{selectedCandidate.summary}</p>
                </div>
              )}
              
              {selectedCandidate.experience_json && selectedCandidate.experience_json.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-2">Experience</h4>
                  <div className="space-y-3">
                    {selectedCandidate.experience_json.map((exp, index) => (
                      <div key={index} className="border-l-2 border-blue-500 pl-3">
                        <h5 className="font-medium">{exp.title} at {exp.company}</h5>
                        <p className="text-sm text-gray-600">{exp.duration}</p>
                        <p className="text-sm mt-1">{exp.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedCandidate.education_json && selectedCandidate.education_json.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-2">Education</h4>
                  <div className="space-y-2">
                    {selectedCandidate.education_json.map((edu, index) => (
                      <div key={index}>
                        <p className="font-medium">{edu.degree}</p>
                        <p className="text-sm text-gray-600">{edu.institution} - {edu.year}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
