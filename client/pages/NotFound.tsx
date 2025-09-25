import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Home, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function NotFound() {
  const navigate = useNavigate();
  const { admin } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur text-center">
          <CardHeader className="space-y-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-teal-600 rounded-xl flex items-center justify-center mx-auto">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-gray-900">404</CardTitle>
            <CardDescription className="text-gray-600">
              Page Not Found
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <p className="text-gray-600">
              The page you're looking for doesn't exist or has been moved.
            </p>
            
            <div className="space-y-3">
              {admin ? (
                <Link to="/dashboard">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white">
                    <Home className="w-4 h-4 mr-2" />
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <Link to="/login">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white">
                    <Home className="w-4 h-4 mr-2" />
                    Go to Login
                  </Button>
                </Link>
              )}
              
              <Button 
                variant="outline" 
                onClick={() => navigate(-1)}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                HealthCare CRM - ML Support Analytics
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
