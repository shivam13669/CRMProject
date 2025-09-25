import React, { useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import { useCustomers } from '@/contexts/CustomerContext';
import EditCustomerModal from '@/components/EditCustomerModal';
import FamilyMembersModal from '@/components/FamilyMembersModal';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import AddCustomerModal from '@/components/AddCustomerModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  Phone,
  User,
  FileSpreadsheet,
  FileText,
  UserCheck,
  UsersRound,
  Edit,
  Trash2,
  Plus,
  Minus
} from 'lucide-react';
import { Customer } from '@shared/api';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { formatDateForDisplay, computeExpiryDate, formatDateLocalISO } from '@/utils/dateUtils';

export default function Customers() {
  const { customers, getStats, deleteCustomer, deleteSelectedCustomers, clearAllCustomers, loading } = useCustomers();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [salesmanFilter, setSalesmanFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'selected' | 'all';
    customer?: Customer;
  }>({ isOpen: false, type: 'single' });
  const [isDeleting, setIsDeleting] = useState(false);
  const [familyModalCustomer, setFamilyModalCustomer] = useState<Customer | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const itemsPerPage = 10;
  const stats = getStats();

  // Get unique salesmen for filter
  const uniqueSalesmen = Array.from(new Set(customers.map(c => c.salesmanId))).filter(Boolean);

  // Effective status considers expiry: expired -> Inactive
  const getEffectiveStatus = (c: Customer): 'Active' | 'Inactive' => {
    const today = formatDateLocalISO(new Date());
    const expiry = c.expireDate || computeExpiryDate(c.joinDate);
    if (expiry && expiry < today) return 'Inactive';
    return c.status;
  };

  // Filter customers based on search and filters
  const filteredCustomers = useMemo(() => {
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    return customers
      .filter(customer => {
        const matchesSearch =
          customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.regId.toLowerCase().includes(searchTerm.toLowerCase());

        const effectiveStatus = getEffectiveStatus(customer);
        const matchesStatus = statusFilter === 'all' || effectiveStatus === statusFilter;
        const matchesType = typeFilter === 'all' || customer.familyType === typeFilter;
        const matchesSalesman = salesmanFilter === 'all' || customer.salesmanId === salesmanFilter;

        return matchesSearch && matchesStatus && matchesType && matchesSalesman;
      })
      .slice()
      .sort((a, b) => collator.compare(a.regId || '', b.regId || ''));
  }, [customers, searchTerm, statusFilter, typeFilter, salesmanFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + itemsPerPage);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCustomers(paginatedCustomers.map(c => c.id));
    } else {
      setSelectedCustomers([]);
    }
  };

  const handleSelectCustomer = (customerId: string, checked: boolean) => {
    if (checked) {
      setSelectedCustomers(prev => [...prev, customerId]);
    } else {
      setSelectedCustomers(prev => prev.filter(id => id !== customerId));
    }
  };

  // Delete handlers
  const handleDeleteSingle = (customer: Customer) => {
    setDeleteModal({
      isOpen: true,
      type: 'single',
      customer
    });
  };

  const handleDeleteSelected = () => {
    setDeleteModal({
      isOpen: true,
      type: 'selected'
    });
  };

  const handleDeleteAll = () => {
    setDeleteModal({
      isOpen: true,
      type: 'all'
    });
  };

  const confirmDelete = async () => {
    setIsDeleting(true);

    try {
      let result;
      if (deleteModal.type === 'single' && deleteModal.customer) {
        result = await deleteCustomer(deleteModal.customer.id);
      } else if (deleteModal.type === 'selected') {
        result = await deleteSelectedCustomers(selectedCustomers);
        setSelectedCustomers([]);
      } else if (deleteModal.type === 'all') {
        result = await clearAllCustomers();
        setSelectedCustomers([]);
      }

      if (result && !result.success) {
        console.error('Delete operation failed:', result.message);
        // You could show an error toast here
      }

      setDeleteModal({ isOpen: false, type: 'single' });
    } catch (error) {
      console.error('Error during delete operation:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    const csvData = filteredCustomers.map(customer => ({
      'Reg ID': customer.regId,
      'Name': customer.name,
      'Contact': customer.contact,
      'Salesman ID': customer.salesmanId,
      'Status': getEffectiveStatus(customer),
      'Family Type': customer.familyType,
      'Family Members': customer.familyMembers,
      'Join Date': customer.joinDate,
      'Expire Date': customer.expireDate || computeExpiryDate(customer.joinDate),
      'Membership': customer.membership
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportExcel = () => {
    const excelData = filteredCustomers.map(customer => ({
      'Reg ID': customer.regId,
      'Name': customer.name,
      'Contact': customer.contact,
      'Salesman ID': customer.salesmanId,
      'Status': getEffectiveStatus(customer),
      'Family Type': customer.familyType,
      'Family Members': customer.familyMembers,
      'Join Date': customer.joinDate,
      'Expire Date': customer.expireDate || computeExpiryDate(customer.joinDate),
      'Membership': customer.membership
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, `customers_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Delete modal content
  const getDeleteModalContent = () => {
    switch (deleteModal.type) {
      case 'single':
        return {
          title: 'Delete Customer',
          description: `Are you sure you want to delete ${deleteModal.customer?.name}? This action cannot be undone.`,
          confirmText: 'Delete Customer'
        };
      case 'selected':
        return {
          title: 'Delete Selected Customers',
          description: `Are you sure you want to delete ${selectedCustomers.length} selected customers? This action cannot be undone.`,
          confirmText: `Delete ${selectedCustomers.length} Customers`
        };
      case 'all':
        return {
          title: 'Delete All Customer Data',
          description: 'Are you sure you want to delete ALL customer data? This will permanently remove all customer records and cannot be undone.',
          confirmText: 'Delete All Data'
        };
      default:
        return {
          title: 'Delete',
          description: 'Are you sure?',
          confirmText: 'Delete'
        };
    }
  };

  const modalContent = getDeleteModalContent();

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
            <p className="text-gray-600 mt-1">
              View, search, edit, and manage customer enrollment data
            </p>
          </div>
          <div className="flex space-x-2">
            <Button onClick={() => setIsAddOpen(true)} className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </Button>
            <Button onClick={handleExportCSV} variant="outline" className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Export CSV</span>
            </Button>
            <Button onClick={handleExportExcel} variant="outline" className="flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        {customers.length > 0 && (
          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-4">
              {selectedCustomers.length > 0 && (
                <>
                  <span className="text-sm text-gray-600">
                    {selectedCustomers.length} customer(s) selected
                  </span>
                  <Button 
                    onClick={handleDeleteSelected}
                    variant="destructive"
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <Minus className="w-4 h-4" />
                    <span>Delete Selected</span>
                  </Button>
                </>
              )}
            </div>
            <Button 
              onClick={handleDeleteAll}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear All Data</span>
            </Button>
          </div>
        )}

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="w-5 h-5" />
              <span>Search & Filters</span>
            </CardTitle>
            <CardDescription>
              Find customers using various criteria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Search by name or contact..." 
                  className="pl-10" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select 
                className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <select 
                className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="Family">Family</option>
                <option value="Individual">Individual</option>
              </select>
              <select 
                className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white"
                value={salesmanFilter}
                onChange={(e) => setSalesmanFilter(e.target.value)}
              >
                <option value="all">All Salesmen</option>
                {uniqueSalesmen.map(salesman => (
                  <option key={salesman} value={salesman}>{salesman}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Customer Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Customer Data ({filteredCustomers.length} records)</span>
            </CardTitle>
            <CardDescription>
              {filteredCustomers.length !== customers.length && 
                `Filtered from ${customers.length} total customers`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {customers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Customers Found</h3>
                <p className="text-gray-500 mb-4">Upload customer data to get started.</p>
                <Button asChild>
                  <a href="/upload">Upload Customer Data</a>
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-900">
                          <Checkbox
                            checked={selectedCustomers.length === paginatedCustomers.length && paginatedCustomers.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Reg ID</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Contact</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Salesman</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Type</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Membership</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Join Date</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Expire Date</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCustomers.map((customer) => (
                        <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <Checkbox
                              checked={selectedCustomers.includes(customer.id)}
                              onCheckedChange={(checked) => handleSelectCustomer(customer.id, checked as boolean)}
                            />
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">{customer.regId}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span>{customer.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span>{customer.contact}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">{customer.salesmanId}</td>
                          <td className="py-3 px-4">
                            {(() => {
                              const effective = getEffectiveStatus(customer);
                              return (
                                <Badge
                                  variant={effective === 'Active' ? 'default' : 'secondary'}
                                  className={effective === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                                >
                                  {effective}
                                </Badge>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4">
                            {customer.familyType === 'Family' ? (
                              <button
                                type="button"
                                onClick={() => setFamilyModalCustomer(customer)}
                                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-blue-200 text-blue-800 hover:bg-blue-50"
                                title="View family members"
                              >
                                Family
                              </button>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-purple-200 text-purple-800"
                              >
                                Individual
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Badge 
                              variant="outline"
                              className={
                                customer.membership === 'Gold' ? 'border-yellow-200 text-yellow-800' :
                                customer.membership === 'Platinum' ? 'border-purple-200 text-purple-800' :
                                'border-gray-200 text-gray-800'
                              }
                            >
                              {customer.membership}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span>{formatDateForDisplay(customer.joinDate)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              {(() => { const exp = customer.expireDate || computeExpiryDate(customer.joinDate); const today = formatDateLocalISO(new Date()); const expired = !!exp && exp < today; return <span className={expired ? 'text-red-700 font-medium' : ''}>{formatDateForDisplay(exp)}</span>; })()}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingCustomer(customer)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSingle(customer)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length} customers
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Customers</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <UsersRound className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Family Plans</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.families}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                  <User className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Individual Plans</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.individuals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Customer Modal */}
        <AddCustomerModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />

        {/* Edit Customer Modal */}
        <EditCustomerModal
          customer={editingCustomer}
          isOpen={!!editingCustomer}
          onClose={() => setEditingCustomer(null)}
        />

        {/* Family Members Modal */}
        <FamilyMembersModal
          customer={familyModalCustomer}
          isOpen={!!familyModalCustomer}
          onClose={() => setFamilyModalCustomer(null)}
        />

        {/* Delete Confirmation Modal */}
        <DeleteConfirmModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, type: 'single' })}
          onConfirm={confirmDelete}
          title={modalContent.title}
          description={modalContent.description}
          confirmText={modalContent.confirmText}
          isDeleting={isDeleting}
        />
      </div>
    </Layout>
  );
}
