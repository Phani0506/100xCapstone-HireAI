
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Search, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState([
    {
      title: "Total Resumes",
      value: "0",
      description: "Resumes uploaded",
      icon: FileText,
      color: "text-blue-600"
    },
    {
      title: "Active Candidates",
      value: "0",
      description: "Parsed profiles",
      icon: Users,
      color: "text-green-600"
    },
    {
      title: "Searches Performed",
      value: "0",
      description: "AI-powered searches",
      icon: Search,
      color: "text-purple-600"
    },
    {
      title: "Success Rate",
      value: "0%",
      description: "Successful matches",
      icon: TrendingUp,
      color: "text-orange-600"
    }
  ]);

  const [recentActivity, setRecentActivity] = useState<Array<{
    id: string;
    file_name: string;
    parsing_status: string;
    created_at: string;
  }>>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Fetch resume count
      const { data: resumes, error: resumesError } = await supabase
        .from('resumes')
        .select('id')
        .eq('user_id', user.id);

      if (resumesError) throw resumesError;

      // Fetch parsed candidates count
      const { data: parsed, error: parsedError } = await supabase
        .from('parsed_resume_details')
        .select('id')
        .eq('user_id', user.id);

      if (parsedError) throw parsedError;

      // Fetch recent activity
      const { data: recent, error: recentError } = await supabase
        .from('resumes')
        .select('id, file_name, parsing_status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) throw recentError;

      const totalResumes = resumes?.length || 0;
      const totalParsed = parsed?.length || 0;
      const successRate = totalResumes > 0 ? Math.round((totalParsed / totalResumes) * 100) : 0;

      setStats(prev => [
        { ...prev[0], value: totalResumes.toString() },
        { ...prev[1], value: totalParsed.toString() },
        { ...prev[2], value: "0" }, // Will track searches later
        { ...prev[3], value: `${successRate}%` }
      ]);

      setRecentActivity(recent || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600">Welcome to your AI-powered talent matchmaking platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Start building your talent pool</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col space-y-2">
              <h4 className="text-sm font-medium">1. Upload Resumes</h4>
              <p className="text-sm text-gray-600">Start by uploading resume files to build your talent database</p>
            </div>
            <div className="flex flex-col space-y-2">
              <h4 className="text-sm font-medium">2. AI Parsing</h4>
              <p className="text-sm text-gray-600">Our AI will automatically extract and structure candidate information</p>
            </div>
            <div className="flex flex-col space-y-2">
              <h4 className="text-sm font-medium">3. Smart Search</h4>
              <p className="text-sm text-gray-600">Use natural language to find the perfect candidates</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest actions</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.file_name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      item.parsing_status === 'completed' ? 'bg-green-100 text-green-700' :
                      item.parsing_status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.parsing_status || 'pending'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2">No activity yet</p>
                <p className="text-sm">Upload your first resume to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
