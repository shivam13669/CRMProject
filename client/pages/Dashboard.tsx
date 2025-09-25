import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useCustomers } from '@/contexts/CustomerContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  UsersRound,
  UserCheck,
  UserX,
  TrendingUp,
  Calendar,
  BarChart3,
  PieChart,
  Upload
} from 'lucide-react';
import { DashboardStats, MonthlyTrend, ApiResponse } from '@shared/api';

// Mock data for demo - will be replaced with real API calls
const mockStats: DashboardStats = {
  totalCustomers: 1247,
  totalFamilies: 542,
  totalIndividuals: 705,
  activeCustomers: 1108,
  inactiveCustomers: 139,
  membershipBreakdown: {
    gold: 421,
    silver: 589,
    platinum: 237
  }
};

const mockTrends: MonthlyTrend[] = [
  { month: 'Jan', enrollments: 87 },
  { month: 'Feb', enrollments: 124 },
  { month: 'Mar', enrollments: 156 },
  { month: 'Apr', enrollments: 132 },
  { month: 'May', enrollments: 198 },
  { month: 'Jun', enrollments: 234 },
];

export default function Dashboard() {
  const { customers, getStats } = useCustomers();
  const [trends, setTrends] = useState<MonthlyTrend[]>(mockTrends);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate real stats from customer data
  const realStats = getStats();
  const stats: DashboardStats = {
    totalCustomers: realStats.total,
    totalFamilies: realStats.families,
    totalIndividuals: realStats.individuals,
    activeCustomers: realStats.active,
    inactiveCustomers: realStats.inactive,
    membershipBreakdown: {
      gold: customers.filter(c => c.membership === 'Gold').length,
      silver: customers.filter(c => c.membership === 'Silver').length,
      platinum: customers.filter(c => c.membership === 'Platinum').length
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [customers]); // Re-run when customer data changes

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Generate trends based on customer join dates
      const monthlyData: { [key: string]: number } = {};
      customers.forEach(customer => {
        const date = new Date(customer.joinDate);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
      });

      const trendsData = Object.entries(monthlyData).map(([month, enrollments]) => ({
        month,
        enrollments
      }));

      setTrends(trendsData.length > 0 ? trendsData : mockTrends);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setIsLoading(false);
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    description, 
    icon: Icon, 
    trend,
    className = "" 
  }: {
    title: string;
    value: number;
    description: string;
    icon: any;
    trend?: string;
    className?: string;
  }) => (
    <Card className={`relative overflow-hidden ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <Icon className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-500">{description}</p>
          {trend && (
            <Badge variant="secondary" className="text-xs">
              {trend}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Healthcare enrollment analytics and insights
            </p>
          </div>
          <Button 
            onClick={fetchDashboardData} 
            disabled={isLoading}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Refresh Data</span>
          </Button>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Customers"
            value={stats.totalCustomers}
            description="All enrolled customers"
            icon={Users}
            trend="+12%"
            className="border-l-4 border-l-blue-500"
          />
          <StatCard
            title="Family Plans"
            value={stats.totalFamilies}
            description="Family enrollments"
            icon={UsersRound}
            trend="+8%"
            className="border-l-4 border-l-green-500"
          />
          <StatCard
            title="Individual Plans"
            value={stats.totalIndividuals}
            description="Individual enrollments"
            icon={Users}
            trend="+15%"
            className="border-l-4 border-l-purple-500"
          />
          <StatCard
            title="Active Members"
            value={stats.activeCustomers}
            description={`${stats.inactiveCustomers} inactive`}
            icon={UserCheck}
            trend="89%"
            className="border-l-4 border-l-teal-500"
          />
        </div>

        {/* Charts and Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Enrollment Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="w-5 h-5" />
                <span>Enrollment Distribution</span>
              </CardTitle>
              <CardDescription>
                Family vs Individual plan breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span className="text-sm font-medium">Family Plans</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{stats.totalFamilies}</p>
                    <p className="text-xs text-gray-500">
                      {Math.round((stats.totalFamilies / stats.totalCustomers) * 100)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-sm font-medium">Individual Plans</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{stats.totalIndividuals}</p>
                    <p className="text-xs text-gray-500">
                      {Math.round((stats.totalIndividuals / stats.totalCustomers) * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Membership Tiers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>Membership Tiers</span>
              </CardTitle>
              <CardDescription>
                Distribution across Gold, Silver, Platinum
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                    <span className="text-sm font-medium">Gold</span>
                  </div>
                  <span className="text-sm font-semibold">{stats.membershipBreakdown.gold}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-gray-400 rounded"></div>
                    <span className="text-sm font-medium">Silver</span>
                  </div>
                  <span className="text-sm font-semibold">{stats.membershipBreakdown.silver}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-purple-500 rounded"></div>
                    <span className="text-sm font-medium">Platinum</span>
                  </div>
                  <span className="text-sm font-semibold">{stats.membershipBreakdown.platinum}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Enrollment Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Monthly Enrollment Trends</span>
            </CardTitle>
            <CardDescription>
              Customer enrollment over the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-4">
              {trends.map((trend, index) => (
                <div key={trend.month} className="text-center">
                  <div className="bg-gray-100 h-24 rounded-lg flex items-end justify-center p-2">
                    <div 
                      className="bg-gradient-to-t from-blue-600 to-blue-400 rounded w-full"
                      style={{ 
                        height: `${(trend.enrollments / Math.max(...trends.map(t => t.enrollments))) * 100}%`,
                        minHeight: '8px'
                      }}
                    ></div>
                  </div>
                  <p className="text-xs font-medium text-gray-600 mt-2">{trend.month}</p>
                  <p className="text-sm font-bold text-gray-900">{trend.enrollments}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and quick access to key features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link to="/upload">
                <Button variant="outline" className="h-20 flex flex-col space-y-2 w-full hover:bg-blue-50 hover:border-blue-200 transition-colors">
                  <Upload className="w-6 h-6 text-blue-600" />
                  <span>Upload Customer Data</span>
                </Button>
              </Link>
              <Link to="/customers">
                <Button variant="outline" className="h-20 flex flex-col space-y-2 w-full hover:bg-green-50 hover:border-green-200 transition-colors">
                  <Users className="w-6 h-6 text-green-600" />
                  <span>Manage Customers</span>
                </Button>
              </Link>
              <Link to="/reports">
                <Button variant="outline" className="h-20 flex flex-col space-y-2 w-full hover:bg-purple-50 hover:border-purple-200 transition-colors">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                  <span>Generate Report</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
