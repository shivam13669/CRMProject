import React, { useState, useRef } from 'react';
import Layout from '@/components/Layout';
import { useCustomers } from '@/contexts/CustomerContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Upload as UploadIcon,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  X,
  FileText,
  Download
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Customer } from '@shared/api';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseExcelDate, computeExpiryDate, formatDateLocalISO, isValidDate } from '@/utils/dateUtils';
import { normalizeContact } from '@/utils/phone';

interface ParsedCustomer {
  regId: string;
  name: string;
  contact: string;
  salesmanId: string;
  status: 'Active' | 'Inactive';
  familyMembers: string;
  joinDate: string;
  expireDate?: string;
  membership?: 'Gold' | 'Silver' | 'Platinum';
}

export default function Upload() {
  const { addCustomers, clearAllCustomers, customers, loading } = useCustomers();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [parsedData, setParsedData] = useState<ParsedCustomer[]>([]);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadStatus('idle');
      setMessage('');
      setParsedData([]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
      setUploadStatus('idle');
      setMessage('');
      setParsedData([]);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const parseFile = async (): Promise<ParsedCustomer[]> => {
    if (!file) return [];

    return new Promise((resolve, reject) => {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            try {
              const parsed = results.data.map((row: any, index: number) => ({
                regId: row['Reg ID'] || row['regId'] || `REG${String(index + 1).padStart(3, '0')}`,
                name: row['Name'] || row['name'] || '',
                contact: normalizeContact(row['Contact'] || row['contact'] || ''),
                salesmanId: row['Salesman Id'] || row['salesmanId'] || row['Salesman ID'] || '',
                status: (row['Status'] || row['status'] || 'Active') as 'Active' | 'Inactive',
                familyMembers: row['Family Members'] || row['familyMembers'] || row['Family_Members'] || 'No family',
                joinDate: parseExcelDate(row['Join Date'] || row['joinDate'] || row['Join_Date']) || formatDateLocalISO(new Date()),
                expireDate: parseExcelDate(row['Expire Date'] || row['Expiry Date'] || row['expireDate'] || row['Expire_Date'] || row['Expiry_Date']) || '',
                membership: row['Membership'] || row['membership'] || 'Silver'
              }));
              resolve(parsed);
            } catch (error) {
              reject(error);
            }
          },
          error: (error) => reject(error)
        });
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            const parsed = jsonData.map((row: any, index: number) => ({
              regId: row['Reg ID'] || row['regId'] || `REG${String(index + 1).padStart(3, '0')}`,
              name: row['Name'] || row['name'] || '',
              contact: normalizeContact(row['Contact'] || row['contact'] || ''),
              salesmanId: row['Salesman Id'] || row['salesmanId'] || row['Salesman ID'] || '',
              status: (row['Status'] || row['status'] || 'Active') as 'Active' | 'Inactive',
              familyMembers: row['Family Members'] || row['familyMembers'] || row['Family_Members'] || 'No family',
              joinDate: parseExcelDate(row['Join Date'] || row['joinDate'] || row['Join_Date']) || formatDateLocalISO(new Date()),
              expireDate: parseExcelDate(row['Expire Date'] || row['Expiry Date'] || row['expireDate'] || row['Expire_Date'] || row['Expiry_Date']) || '',
              membership: row['Membership'] || row['membership'] || 'Silver'
            }));
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        };
        reader.readAsBinaryString(file);
      } else {
        reject(new Error('Unsupported file format'));
      }
    });
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('idle');

    try {
      const parsed = await parseFile();
      setParsedData(parsed);
      setMessage(`Successfully parsed ${parsed.length} records. Review the data below and click "Save to Database" to import.`);
      setUploadStatus('success');
    } catch (error) {
      console.error('Error parsing file:', error);
      setMessage('Error parsing file. Please check the format and try again.');
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveToDatabase = async () => {
    const customers: Customer[] = parsedData.map((data, index) => ({
      id: `${data.regId}_${Date.now()}_${index}`,
      regId: data.regId,
      name: data.name,
      contact: data.contact,
      salesmanId: data.salesmanId,
      status: data.status,
      familyType: data.familyMembers.toLowerCase().includes('no family') ? 'Individual' : 'Family',
      familyMembers: data.familyMembers,
      joinDate: data.joinDate,
      expireDate: isValidDate(data.expireDate || '') ? (data.expireDate as string) : computeExpiryDate(data.joinDate),
      membership: data.membership as 'Gold' | 'Silver' | 'Platinum'
    }));

    try {
      setIsUploading(true);
      const result = await addCustomers(customers);

      if (result.success) {
        setMessage(`Successfully imported ${customers.length} customers to the database!`);
        setUploadStatus('success');
        setFile(null);
        setParsedData([]);

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setMessage(`Error importing customers: ${result.message}`);
        setUploadStatus('error');
      }
    } catch (error) {
      console.error('Error saving to database:', error);
      setMessage('Failed to save customers to database');
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setParsedData([]);
    setUploadStatus('idle');
    setMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Upload Customer Data</h1>
            <p className="text-gray-600 mt-1">
              Upload CSV or XLSX files to import customer enrollment data
            </p>
          </div>
          {customers.length > 0 && (
            <Button
              onClick={async () => {
                if (window.confirm(`Are you sure you want to delete all ${customers.length} customer records? This action cannot be undone.`)) {
                  try {
                    const result = await clearAllCustomers();
                    if (result.success) {
                      setMessage('All customer data has been cleared.');
                      setUploadStatus('success');
                    } else {
                      setMessage(`Error clearing data: ${result.message}`);
                      setUploadStatus('error');
                    }
                  } catch (error) {
                    console.error('Error clearing data:', error);
                    setMessage('Failed to clear customer data');
                    setUploadStatus('error');
                  }
                }
              }}
              variant="outline"
              className="flex items-center space-x-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              <X className="w-4 h-4" />
              <span>Clear All Data ({customers.length})</span>
            </Button>
          )}
        </div>

        {/* Status Messages */}
        {message && (
          <Alert className={uploadStatus === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
            {uploadStatus === 'error' ? (
              <AlertCircle className="h-4 w-4 text-red-600" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            <AlertDescription className={uploadStatus === 'error' ? 'text-red-800' : 'text-green-800'}>
              {message}
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UploadIcon className="w-5 h-5" />
                <span>File Upload</span>
              </CardTitle>
              <CardDescription>
                Drag and drop or select CSV/XLSX files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={handleBrowseClick}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {file ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center space-x-2">
                      <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                      <span className="font-medium text-gray-900">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile();
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600">
                      Size: {(file.size / 1024).toFixed(1)} KB
                    </p>
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpload();
                      }}
                      disabled={isUploading}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isUploading ? 'Parsing...' : 'Parse File'}
                    </Button>
                  </div>
                ) : (
                  <>
                    <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-600 mb-2">
                      Drop your files here or
                    </p>
                    <Button variant="outline">
                      Browse Files
                    </Button>
                    <p className="text-xs text-gray-500 mt-4">
                      Supports CSV and XLSX files up to 10MB
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expected File Format</CardTitle>
              <CardDescription>
                Required columns for customer data import
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium text-gray-700">Reg ID</div>
                  <div className="text-gray-500">Unique identifier</div>
                  
                  <div className="font-medium text-gray-700">Name</div>
                  <div className="text-gray-500">Customer name</div>
                  
                  <div className="font-medium text-gray-700">Contact</div>
                  <div className="text-gray-500">Phone number</div>
                  
                  <div className="font-medium text-gray-700">Salesman Id</div>
                  <div className="text-gray-500">Sales representative</div>
                  
                  <div className="font-medium text-gray-700">Status</div>
                  <div className="text-gray-500">Active/Inactive</div>
                  
                  <div className="font-medium text-gray-700">Family Members</div>
                  <div className="text-gray-500">"No family" or count</div>
                  
                  <div className="font-medium text-gray-700">Join Date</div>
                  <div className="text-gray-500">Enrollment date</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Data */}
        {parsedData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Preview Data ({parsedData.length} records)</span>
                <Button
                  onClick={handleSaveToDatabase}
                  disabled={isUploading || loading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isUploading || loading ? 'Saving...' : 'Save to Database'}
                </Button>
              </CardTitle>
              <CardDescription>
                Review the parsed data before importing to the database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium text-gray-900">Reg ID</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-900">Name</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-900">Contact</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-900">Status</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-900">Type</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-900">Join Date</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-900">Expire Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((customer, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-2 px-2 font-medium text-gray-900">{customer.regId}</td>
                        <td className="py-2 px-2">{customer.name}</td>
                        <td className="py-2 px-2">{customer.contact}</td>
                        <td className="py-2 px-2">
                          <Badge 
                            variant={customer.status === 'Active' ? 'default' : 'secondary'}
                            className={customer.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                          >
                            {customer.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Badge 
                            variant="outline"
                            className={customer.familyMembers.toLowerCase().includes('no family') ? 'border-purple-200 text-purple-800' : 'border-blue-200 text-blue-800'}
                          >
                            {customer.familyMembers.toLowerCase().includes('no family') ? 'Individual' : 'Family'}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">{customer.joinDate}</td>
                        <td className="py-2 px-2">{customer.expireDate || computeExpiryDate(customer.joinDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 10 && (
                  <p className="text-sm text-gray-500 mt-4 text-center">
                    Showing first 10 of {parsedData.length} records
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Data Processing Rules</CardTitle>
            <CardDescription>
              How the system will interpret your uploaded data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <p className="font-medium text-gray-900">Family Classification</p>
                  <p className="text-sm text-gray-600">
                    Records with "No family" in Family Members column → Individual plan
                  </p>
                  <p className="text-sm text-gray-600">
                    Records with member count (e.g., "3 members") → Family plan
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <p className="font-medium text-gray-900">Bulk Processing</p>
                  <p className="text-sm text-gray-600">
                    All valid records will be inserted into the database in batches
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <div>
                  <p className="font-medium text-gray-900">Validation</p>
                  <p className="text-sm text-gray-600">
                    Invalid records will be flagged and can be reviewed before import
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
