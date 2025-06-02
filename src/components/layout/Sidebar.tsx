
import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Upload, 
  Search, 
  Users, 
  MessageSquare, 
  BarChart3, 
  LogOut,
  BrainCircuit
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSignOut: () => void;
}

export const Sidebar = ({ activeTab, onTabChange, onSignOut }: SidebarProps) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'upload', label: 'Upload Resumes', icon: Upload },
    { id: 'search', label: 'Search Talent', icon: Search },
    { id: 'candidates', label: 'My Candidates', icon: Users },
    { id: 'screening', label: 'AI Screening', icon: BrainCircuit },
    { id: 'outreach', label: 'Outreach', icon: MessageSquare },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="w-64 bg-white shadow-lg h-screen flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-gray-900">HIRE AI</h1>
        <p className="text-sm text-gray-600">Talent Matchmaking</p>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Button
                  variant={activeTab === item.id ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    activeTab === item.id ? "bg-blue-600 text-white" : "text-gray-700"
                  )}
                  onClick={() => onTabChange(item.id)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={onSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};
