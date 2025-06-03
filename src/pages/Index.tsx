
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/auth/AuthForm';
import { Sidebar } from '@/components/layout/Sidebar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { ResumeUpload } from '@/components/upload/ResumeUpload';
import { TalentSearch } from '@/components/search/TalentSearch';
import { MyCandidates } from '@/components/candidates/MyCandidates';
import { AIScreeningAndOutreach } from '@/components/screening/AIScreeningAndOutreach';
import { Analytics } from '@/components/analytics/Analytics';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'upload':
        return <ResumeUpload />;
      case 'search':
        return <TalentSearch />;
      case 'candidates':
        return <MyCandidates />;
      case 'screening':
        return <AIScreeningAndOutreach />;
      case 'analytics':
        return <Analytics />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onSignOut={signOut}
      />
      <main className="flex-1 overflow-auto p-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
