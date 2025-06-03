
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, Award, MapPin, GraduationCap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsData {
  totalCandidates: number;
  skillsDistribution: Array<{ skill: string; count: number }>;
  locationDistribution: Array<{ location: string; count: number }>;
  experienceDistribution: Array<{ level: string; count: number }>;
  educationDistribution: Array<{ degree: string; count: number }>;
  topSkills: string[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export const Analytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('parsed_resume_details')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;

      const candidates = data || [];
      
      // Process skills distribution
      const skillsMap = new Map<string, number>();
      candidates.forEach(candidate => {
        if (Array.isArray(candidate.skills_json)) {
          candidate.skills_json.forEach((skill: string) => {
            skillsMap.set(skill, (skillsMap.get(skill) || 0) + 1);
          });
        }
      });
      
      const skillsDistribution = Array.from(skillsMap.entries())
        .map(([skill, count]) => ({ skill, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Process location distribution
      const locationMap = new Map<string, number>();
      candidates.forEach(candidate => {
        if (candidate.location) {
          const location = candidate.location.split(',')[0].trim(); // Get city/state
          locationMap.set(location, (locationMap.get(location) || 0) + 1);
        }
      });
      
      const locationDistribution = Array.from(locationMap.entries())
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // Process experience distribution
      const experienceMap = new Map<string, number>();
      candidates.forEach(candidate => {
        if (Array.isArray(candidate.experience_json)) {
          const expCount = candidate.experience_json.length;
          let level = 'Entry Level';
          if (expCount >= 5) level = 'Senior Level';
          else if (expCount >= 2) level = 'Mid Level';
          
          experienceMap.set(level, (experienceMap.get(level) || 0) + 1);
        }
      });
      
      const experienceDistribution = Array.from(experienceMap.entries())
        .map(([level, count]) => ({ level, count }));

      // Process education distribution
      const educationMap = new Map<string, number>();
      candidates.forEach(candidate => {
        if (Array.isArray(candidate.education_json)) {
          candidate.education_json.forEach((edu: any) => {
            if (edu.degree) {
              const degreeType = edu.degree.toLowerCase().includes('master') ? 'Masters' :
                               edu.degree.toLowerCase().includes('phd') ? 'PhD' :
                               edu.degree.toLowerCase().includes('bachelor') ? 'Bachelors' : 'Other';
              educationMap.set(degreeType, (educationMap.get(degreeType) || 0) + 1);
            }
          });
        }
      });
      
      const educationDistribution = Array.from(educationMap.entries())
        .map(([degree, count]) => ({ degree, count }));

      setAnalytics({
        totalCandidates: candidates.length,
        skillsDistribution,
        locationDistribution,
        experienceDistribution,
        educationDistribution,
        topSkills: skillsDistribution.slice(0, 5).map(item => item.skill)
      });

    } catch (error: any) {
      toast({
        title: "Error fetching analytics",
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
        <h2 className="text-3xl font-bold text-gray-900">Analytics</h2>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics || analytics.totalCandidates === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900">Analytics</h2>
        <Card>
          <CardContent className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">No data yet</p>
            <p className="text-sm text-gray-400">Upload and parse resumes to see analytics</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Analytics</h2>
        <p className="text-gray-600">Insights from your talent pool</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalCandidates}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Skills</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.skillsDistribution.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.locationDistribution.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Education Types</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.educationDistribution.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Skills */}
      <Card>
        <CardHeader>
          <CardTitle>Top Skills</CardTitle>
          <CardDescription>Most common skills across your talent pool</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {analytics.topSkills.map((skill, index) => (
              <Badge key={index} variant="secondary" className="text-sm">
                {skill}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skills Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Skills Distribution</CardTitle>
            <CardDescription>Number of candidates per skill</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.skillsDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="skill" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Experience Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Experience Distribution</CardTitle>
            <CardDescription>Candidates by experience level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.experienceDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ level, count, percent }) => 
                    `${level}: ${count} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analytics.experienceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Location Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Location Distribution</CardTitle>
            <CardDescription>Candidates by location</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.locationDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="location" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Education Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Education Distribution</CardTitle>
            <CardDescription>Candidates by education level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.educationDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ degree, count, percent }) => 
                    `${degree}: ${count} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analytics.educationDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
