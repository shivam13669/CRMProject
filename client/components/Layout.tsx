import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Activity, 
  BarChart3, 
  Upload, 
  Users, 
  LogOut, 
  Settings,
  FileText
} from 'lucide-react';
import { Link, useLocation, useInRouterContext } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Upload Data', href: '/upload', icon: Upload },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Reports', href: '/reports', icon: FileText },
];

export default function Layout({ children }: LayoutProps) {
  const { admin, logout } = useAuth();
  const inRouter = useInRouterContext();

  const DesktopNav: React.FC = () => {
    const location = useLocation();
    return (
      <nav className="hidden md:flex space-x-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    );
  };

  const MobileNav: React.FC = () => {
    const location = useLocation();
    return (
      <nav className="md:hidden bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex space-x-1 overflow-x-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-teal-600 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">HealthCare CRM</h1>
                <p className="text-xs text-gray-500">ML Support Analytics</p>
              </div>
            </div>

            {/* Navigation */}
            {inRouter ? <DesktopNav /> : (
              <nav className="hidden md:flex space-x-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 h-9">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-gradient-to-r from-blue-600 to-teal-600 text-white text-sm">
                      {admin?.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-gray-700">{admin?.username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile navigation */}
      {inRouter ? <MobileNav /> : (
        <nav className="md:hidden bg-white border-b border-gray-200 px-4 py-2">
          <div className="flex space-x-1 overflow-x-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 whitespace-nowrap text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
