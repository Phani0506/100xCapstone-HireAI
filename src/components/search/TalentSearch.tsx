
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, User, Mail, Phone, MapPin, Eye } from 'lucide-react';
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
}

export const TalentSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    
    setSearching(true);
    try {
      // Search in parsed resume details
      const { data, error } = await supabase
        .from('parsed_resume_details')
        .select('*')
        .eq('user_id', user.id)
        .or(`full_name.ilike.%${searchQuery}%,skills_json::text.ilike.%${searchQuery}%,summary.ilike.%${searchQuery}%,raw_text_content.ilike.%${searchQuery}%`);

      if (error) throw error;

      const transformedResults: Candidate[] = (data || []).map(item => ({
        ...item,
        skills_json: Array.isArray(item.skills_json) ? item.skills_json as string[] : null,
        experience_json: Array.isArray(item.experience_json) ? item.experience_json as Array<{
          title: string;
          company: string;
          duration: string;
          description: string;
        }> : null,
      }));

      setSearchResults(transformedResults);
      
      if (transformedResults.length === 0) {
        toast({
          title: "No results found",
          description: "Try searching with different keywords",
        });
      }
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Search Talent</h2>
        <p className="text-gray-600">Search through your parsed candidate profiles</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Smart Search</CardTitle>
          <CardDescription>
            Search by name, skills, experience, or any other keyword
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="e.g., 'React developer', 'Python', 'John Doe', 'New York'"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching}>
              <Search className="h-4 w-4 mr-2" />
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search Results ({searchResults.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {searchResults.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <User className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4">No search results yet</p>
              <p className="text-sm">Try searching for candidates by name, skills, or experience</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((candidate) => (
                <Card key={candidate.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{candidate.full_name || 'Unknown Name'}</CardTitle>
                        <CardDescription className="mt-1">
                          {candidate.summary ? 
                            candidate.summary.substring(0, 80) + (candidate.summary.length > 80 ? '...' : '')
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
                    <div className="space-y-2">
                      {candidate.email && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="h-4 w-4 mr-2" />
                          {candidate.email}
                        </div>
                      )}
                      {candidate.skills_json && candidate.skills_json.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Skills</p>
                          <div className="flex flex-wrap gap-1">
                            {candidate.skills_json.slice(0, 3).map((skill, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {candidate.skills_json.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{candidate.skills_json.length - 3}
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
          )}
        </CardContent>
      </Card>

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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
