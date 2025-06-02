
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Search, TrendingUp } from 'lucide-react';

export const Dashboard = () => {
  const stats = [
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
  ];

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
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2">No activity yet</p>
              <p className="text-sm">Upload your first resume to get started</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
