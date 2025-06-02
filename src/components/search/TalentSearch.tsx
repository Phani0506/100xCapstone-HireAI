
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User } from 'lucide-react';

export const TalentSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    // TODO: Implement AI-powered search with Groq API
    setTimeout(() => {
      setSearching(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Search Talent</h2>
        <p className="text-gray-600">Use AI-powered semantic search to find the perfect candidates</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Smart Search</CardTitle>
          <CardDescription>
            Use natural language to describe the candidate you're looking for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="e.g., 'Find a full stack developer in New York with React and Node.js experience'"
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
          <CardTitle>Search Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <User className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4">No search results yet</p>
            <p className="text-sm">Upload resumes and try searching for candidates</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
