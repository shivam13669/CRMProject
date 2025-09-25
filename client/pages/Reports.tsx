import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { useCustomers } from '@/contexts/CustomerContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Download, BarChart3, Calendar, Users, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { formatDateLocalISO } from '@/utils/dateUtils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export default function Reports() {
  const { customers, getStats } = useCustomers();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [salesmanFilter, setSalesmanFilter] = useState('all');
  const [exportFormat, setExportFormat] = useState('csv');

  const stats = getStats();
  const uniqueSalesmen = Array.from(new Set(customers.map(c => c.salesmanId))).filter(Boolean);

  // Filter customers based on criteria
  const getFilteredCustomers = () => {
    // Normalize to YYYY-MM-DD and compare as strings to avoid timezone issues
    const normalize = (d: string) => {
      if (!d) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      const parsed = new Date(d);
      if (!isNaN(parsed.getTime())) return formatDateLocalISO(parsed);
      return '';
    };

    const from = dateFrom ? normalize(dateFrom) : '';
    const to = dateTo ? normalize(dateTo) : '';

    return customers.filter(customer => {
      const cDate = normalize(customer.joinDate);

      const matchesDateRange = (
        (!from || (cDate && cDate >= from)) &&
        (!to || (cDate && cDate <= to))
      );

      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
      const matchesType = typeFilter === 'all' || customer.familyType === typeFilter;
      const matchesSalesman = salesmanFilter === 'all' || customer.salesmanId === salesmanFilter;

      return matchesDateRange && matchesStatus && matchesType && matchesSalesman;
    });
  };

  const exportCustomerSummary = () => {
    const filteredCustomers = getFilteredCustomers();
    const summaryData = {
      'Total Customers': filteredCustomers.length,
      'Family Plans': filteredCustomers.filter(c => c.familyType === 'Family').length,
      'Individual Plans': filteredCustomers.filter(c => c.familyType === 'Individual').length,
      'Active Customers': filteredCustomers.filter(c => c.status === 'Active').length,
      'Inactive Customers': filteredCustomers.filter(c => c.status === 'Inactive').length,
      'Gold Members': filteredCustomers.filter(c => c.membership === 'Gold').length,
      'Silver Members': filteredCustomers.filter(c => c.membership === 'Silver').length,
      'Platinum Members': filteredCustomers.filter(c => c.membership === 'Platinum').length,
    };

    if (exportFormat === 'csv') {
      const csvData = Object.entries(summaryData).map(([key, value]) => ({
        'Metric': key,
        'Count': value
      }));
      const csv = Papa.unparse(csvData);
      downloadFile(csv, 'customer_summary.csv', 'text/csv');
    } else if (exportFormat === 'xlsx') {
      const excelData = Object.entries(summaryData).map(([key, value]) => ({
        'Metric': key,
        'Count': value
      }));
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Summary');
      XLSX.writeFile(wb, 'customer_summary.xlsx');
    } else if (exportFormat === 'pdf') {
      const doc = new jsPDF();
      doc.text('Customer Summary Report', 20, 20);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
      
      const tableData = Object.entries(summaryData).map(([key, value]) => [key, value.toString()]);
      
      doc.autoTable({
        startY: 40,
        head: [['Metric', 'Count']],
        body: tableData,
      });
      
      doc.save('customer_summary.pdf');
    }
  };

  const exportMonthlyEnrollment = () => {
    const monthlyData: { [key: string]: number } = {};
    customers.forEach(customer => {
      const date = new Date(customer.joinDate);
      const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
    });

    if (exportFormat === 'csv') {
      const csvData = Object.entries(monthlyData).map(([month, count]) => ({
        'Month': month,
        'Enrollments': count
      }));
      const csv = Papa.unparse(csvData);
      downloadFile(csv, 'monthly_enrollment.csv', 'text/csv');
    } else if (exportFormat === 'xlsx') {
      const excelData = Object.entries(monthlyData).map(([month, count]) => ({
        'Month': month,
        'Enrollments': count
      }));
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Trends');
      XLSX.writeFile(wb, 'monthly_enrollment.xlsx');
    } else if (exportFormat === 'pdf') {
      const doc = new jsPDF();
      doc.text('Monthly Enrollment Report', 20, 20);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
      
      const tableData = Object.entries(monthlyData).map(([month, count]) => [month, count.toString()]);
      
      doc.autoTable({
        startY: 40,
        head: [['Month', 'Enrollments']],
        body: tableData,
      });
      
      doc.save('monthly_enrollment.pdf');
    }
  };

  const generateCustomReport = () => {
    const filteredCustomers = getFilteredCustomers();
    
    if (exportFormat === 'csv') {
      const csvData = filteredCustomers.map(customer => ({
        'Reg ID': customer.regId,
        'Name': customer.name,
        'Contact': customer.contact,
        'Salesman ID': customer.salesmanId,
        'Status': customer.status,
        'Family Type': customer.familyType,
        'Family Members': customer.familyMembers,
        'Join Date': customer.joinDate,
        'Membership': customer.membership
      }));
      const csv = Papa.unparse(csvData);
      downloadFile(csv, 'custom_report.csv', 'text/csv');
    } else if (exportFormat === 'xlsx') {
      const excelData = filteredCustomers.map(customer => ({
        'Reg ID': customer.regId,
        'Name': customer.name,
        'Contact': customer.contact,
        'Salesman ID': customer.salesmanId,
        'Status': customer.status,
        'Family Type': customer.familyType,
        'Family Members': customer.familyMembers,
        'Join Date': customer.joinDate,
        'Membership': customer.membership
      }));
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Custom Report');
      XLSX.writeFile(wb, 'custom_report.xlsx');
    } else if (exportFormat === 'pdf') {
      const doc = new jsPDF();
      doc.text('Custom Customer Report', 20, 20);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
      doc.text(`Total Records: ${filteredCustomers.length}`, 20, 40);
      
      const tableData = filteredCustomers.map(customer => [
        customer.regId,
        customer.name,
        customer.contact,
        customer.status,
        customer.familyType,
        customer.joinDate
      ]);
      
      doc.autoTable({
        startY: 50,
        head: [['Reg ID', 'Name', 'Contact', 'Status', 'Type', 'Join Date']],
        body: tableData,
      });
      
      doc.save('custom_report.pdf');
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type: `${type};charset=utf-8;` });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">
            Generate and export comprehensive customer enrollment reports
          </p>
        </div>

        {/* Report Types */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>Customer Summary Report</span>
              </CardTitle>
              <CardDescription>
                Comprehensive overview of all customer data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p>• Total customers: {stats.total}</p>
                  <p>• Active customers: {stats.active}</p>
                  <p>• Family plans: {stats.families}</p>
                  <p>• Individual plans: {stats.individuals}</p>
                </div>
                <Button onClick={exportCustomerSummary} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  Export Summary
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Monthly Enrollment Report</span>
              </CardTitle>
              <CardDescription>
                Enrollment trends and monthly analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p>• Monthly enrollment numbers</p>
                  <p>• Growth rate comparisons</p>
                  <p>• Seasonal trend analysis</p>
                  <p>• Target vs actual metrics</p>
                </div>
                <Button onClick={exportMonthlyEnrollment} className="w-full bg-green-600 hover:bg-green-700 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  Export Monthly Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Custom Report Builder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Custom Report Builder</span>
            </CardTitle>
            <CardDescription>
              Create custom reports with specific filters and criteria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="dateFrom" className="text-sm font-medium text-gray-700">From Date</Label>
                    <Input 
                      id="dateFrom"
                      type="date" 
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateTo" className="text-sm font-medium text-gray-700">To Date</Label>
                    <Input 
                      id="dateTo"
                      type="date" 
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">Customer Status</Label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm mt-1"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="Active">Active Only</option>
                    <option value="Inactive">Inactive Only</option>
                  </select>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">Plan Type</Label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm mt-1"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    <option value="Family">Family Plans</option>
                    <option value="Individual">Individual Plans</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Salesman</Label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm mt-1"
                    value={salesmanFilter}
                    onChange={(e) => setSalesmanFilter(e.target.value)}
                  >
                    <option value="all">All Salesmen</option>
                    {uniqueSalesmen.map(salesman => (
                      <option key={salesman} value={salesman}>{salesman}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">Export Format</Label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm mt-1"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                  >
                    <option value="csv">CSV</option>
                    <option value="xlsx">Excel (XLSX)</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
                
                <Button onClick={generateCustomReport} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  Generate Custom Report ({getFilteredCustomers().length} records)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Export Options */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Export Options</CardTitle>
            <CardDescription>
              Common report formats ready for immediate download
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                onClick={() => {
                  const csv = Papa.unparse(customers.map(c => ({
                    'Reg ID': c.regId,
                    'Name': c.name,
                    'Contact': c.contact,
                    'Status': c.status,
                    'Type': c.familyType,
                    'Join Date': c.joinDate
                  })));
                  downloadFile(csv, 'all_customers.csv', 'text/csv');
                }}
                variant="outline" 
                className="h-20 flex flex-col space-y-2 hover:bg-blue-50"
                disabled={customers.length === 0}
              >
                <Users className="w-6 h-6 text-blue-600" />
                <span>All Customers CSV</span>
              </Button>
              
              <Button
                onClick={exportCustomerSummary}
                variant="outline" 
                className="h-20 flex flex-col space-y-2 hover:bg-green-50"
                disabled={customers.length === 0}
              >
                <BarChart3 className="w-6 h-6 text-green-600" />
                <span>Analytics Summary</span>
              </Button>
              
              <Button 
                onClick={exportMonthlyEnrollment}
                variant="outline" 
                className="h-20 flex flex-col space-y-2 hover:bg-purple-50"
                disabled={customers.length === 0}
              >
                <Calendar className="w-6 h-6 text-purple-600" />
                <span>Monthly Trends</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
