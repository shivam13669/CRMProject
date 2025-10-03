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
  FileText,
  PieChart
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Salesmen', href: '/salesmen', icon: PieChart },
  { name: 'Upload Data', href: '/upload', icon: Upload },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Reports', href: '/reports', icon: FileText },
];

export default function Layout({ children }: LayoutProps) {
  const { admin, logout } = useAuth();
  const location = useLocation();

  const items = admin?.role === 'central'
    ? [...navigation, { name: 'Admin Users', href: '/admin-users', icon: Settings }]
    : navigation;

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas" variant="inset">
        <SidebarHeader>
          <div className="px-3 py-3 flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-teal-600 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">HealthCare CRM</div>
              <div className="text-[10px] text-gray-500">ML Support</div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild isActive={isActive} className="relative rounded-md px-3 py-2 font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 data-[active=true]:bg-blue-100 data-[active=true]:text-blue-800 data-[active=true]:shadow-sm data-[active=true]:border data-[active=true]:border-blue-200 transition-colors before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-1 before:rounded-full before:bg-blue-600 before:opacity-0 data-[active=true]:before:opacity-100">
                        <Link to={item.href} className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-white border-b">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="md:hidden">
                <SidebarTrigger />
              </div>
            </div>
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
                {admin?.role === 'central' && (
                  <Link to="/admin-users">
                    <DropdownMenuItem className="cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" />
                      Admin Users
                    </DropdownMenuItem>
                  </Link>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main content */}
        <main className="px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
