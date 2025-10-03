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
import autoTable from 'jspdf-autotable';

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

  // Salesman Report Builder state
  const [salesReportSalesman, setSalesReportSalesman] = useState('all');

  const stats = getStats();
  const isUnassigned = (id?: string) => String(id || '').trim().toLowerCase() === 'unassigned';
  const uniqueSalesmen = Array.from(new Set(customers.map(c => c.salesmanId)))
    .filter(Boolean)
    .filter(id => !isUnassigned(id))
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));

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
      
      autoTable(doc, {
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
      
      autoTable(doc, {
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
      
      autoTable(doc, {
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

  // ---- Salesman Report Builder helpers ----
  const BASE_SALARY = 15000;
  const ACTIVE_INCENTIVE = 500;
  const FAMILY_INCENTIVE = 250;
  const INDIVIDUAL_INCENTIVE = 150;
  const CONVERSION_MULTIPLIER = 3000;
  const HRA_RATE = 0.35;
  const MONTHLY_COMMISSION_PER_SALE = 350;
  const TRAVEL_ALLOWANCE_PER_SALE = 120;
  const PF_RATE = 0.12;
  const PROFESSIONAL_TAX_THRESHOLD = 25000;
  const PROFESSIONAL_TAX_AMOUNT = 200;
  const INCOME_TAX_THRESHOLD = 45000;
  const INCOME_TAX_RATE = 0.05;

  const numberFormatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const formatAmount = (value: number, { blankZero = false }: { blankZero?: boolean } = {}) => {
    if (blankZero && Math.abs(value) < 0.005) return '';
    return `INR ${numberFormatter.format(value)}`;
  };

  type SalaryLine = {
    label: string;
    amount: number;
  };

  type SalaryBreakdown = {
    earnings: SalaryLine[];
    deductions: SalaryLine[];
    gross: number;
    deductionTotal: number;
    net: number;
  };

  type SalaryMetrics = {
    activeCustomers: number;
    familyCustomers: number;
    individualCustomers: number;
    weekSales: number;
    monthSales: number;
    conversionRate: number;
  };

  const calculateSalaryBreakdown = (metrics: SalaryMetrics): SalaryBreakdown => {
    const baseSalary = BASE_SALARY;
    const hra = Math.round(baseSalary * HRA_RATE);
    const salesCommission = Math.round(Math.max(metrics.monthSales, 0) * MONTHLY_COMMISSION_PER_SALE);
    const travelAllowance = Math.round(Math.max(metrics.weekSales, 0) * TRAVEL_ALLOWANCE_PER_SALE);
    const activeIncentive = Math.max(metrics.activeCustomers, 0) * ACTIVE_INCENTIVE;
    const familyIncentive = Math.max(metrics.familyCustomers, 0) * FAMILY_INCENTIVE;
    const individualIncentive = Math.max(metrics.individualCustomers, 0) * INDIVIDUAL_INCENTIVE;
    const conversionBonus = Math.round(Math.max(metrics.conversionRate, 0) * CONVERSION_MULTIPLIER);
    const incentivesTotal = activeIncentive + familyIncentive + individualIncentive + conversionBonus;

    const earnings: SalaryLine[] = [
      { label: 'Basic Salary', amount: baseSalary },
      { label: 'House Rent Allowance (HRA)', amount: hra },
      { label: 'Sales Commission', amount: salesCommission },
      { label: 'Travel Allowance', amount: travelAllowance },
      { label: 'Incentives & Bonuses', amount: incentivesTotal }
    ];

    const gross = earnings.reduce((sum, line) => sum + line.amount, 0);

    const providentFundBase = baseSalary + hra;
    const providentFund = Math.round(providentFundBase * PF_RATE);
    const professionalTax = gross >= PROFESSIONAL_TAX_THRESHOLD ? PROFESSIONAL_TAX_AMOUNT : 0;
    const taxableIncome = Math.max(gross - INCOME_TAX_THRESHOLD, 0);
    const incomeTax = taxableIncome > 0 ? Math.round(taxableIncome * INCOME_TAX_RATE) : 0;
    const otherDeductions = 0;

    const deductions: SalaryLine[] = [
      { label: 'Provident Fund (PF)', amount: providentFund },
      { label: 'Professional Tax', amount: professionalTax },
      { label: 'Income Tax (TDS)', amount: incomeTax },
      { label: 'Other Deductions', amount: otherDeductions }
    ];

    const deductionTotal = deductions.reduce((sum, line) => sum + line.amount, 0);
    const net = Math.max(gross - deductionTotal, 0);

    return { earnings, deductions, gross, deductionTotal, net };
  };

  type Agg = {
    id: string;
    label: string;
    totalCustomers: number;
    activeCustomers: number;
    inactiveCustomers: number;
    familyCustomers: number;
    individualCustomers: number;
    conversionRate: number;
    salary: number;
    grossSalary: number;
    deductionTotal: number;
    performanceScore: number;
    weekSales: number;
    monthSales: number;
    yearSales: number;
  };

  const aggregateBySalesman = (): Agg[] => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const last7 = new Date(now);
    last7.setDate(now.getDate() - 7);

    const map = customers.reduce<Record<string, Omit<Agg, 'id' | 'label' | 'conversionRate' | 'salary' | 'grossSalary' | 'deductionTotal' | 'performanceScore'>>>((acc, c) => {
      const key = (c.salesmanId || '').trim() || 'Unassigned';
      if (isUnassigned(key)) return acc; // exclude unassigned from salesman reports
      if (!acc[key]) {
        acc[key] = {
          totalCustomers: 0,
          activeCustomers: 0,
          inactiveCustomers: 0,
          familyCustomers: 0,
          individualCustomers: 0,
          weekSales: 0,
          monthSales: 0,
          yearSales: 0
        } as any;
      }

      const date = new Date(c.joinDate || c.createdAt || '');
      const valid = !isNaN(date.getTime());

      acc[key].totalCustomers += 1;
      if (c.status === 'Active') acc[key].activeCustomers += 1; else acc[key].inactiveCustomers += 1;
      if (c.familyType === 'Family') acc[key].familyCustomers += 1; else acc[key].individualCustomers += 1;

      if (valid) {
        if (date >= last7) acc[key].weekSales += 1;
        if (date >= startOfMonth) acc[key].monthSales += 1;
        if (date >= startOfYear) acc[key].yearSales += 1;
      }
      return acc;
    }, {});

    const list: Agg[] = Object.entries(map).map(([id, m]) => {
      const conversionRate = m.totalCustomers ? m.activeCustomers / m.totalCustomers : 0;
      const breakdown = calculateSalaryBreakdown({
        activeCustomers: m.activeCustomers,
        familyCustomers: m.familyCustomers,
        individualCustomers: m.individualCustomers,
        weekSales: m.weekSales,
        monthSales: m.monthSales,
        conversionRate
      });
      const performanceScore = (() => {
        if (m.totalCustomers === 0) return 0;
        const volumeScore = m.totalCustomers * 1.2;
        const activityScore = m.activeCustomers * 1.5 - m.inactiveCustomers * 0.6;
        const mixScore = m.familyCustomers * 0.8 + m.individualCustomers * 0.6;
        const conversionScore = conversionRate * 60;
        return Math.max(volumeScore + activityScore + mixScore + conversionScore, 0);
      })();
      return {
        id,
        label: id,
        conversionRate,
        salary: breakdown.net,
        grossSalary: breakdown.gross,
        deductionTotal: breakdown.deductionTotal,
        performanceScore,
        ...m
      } as Agg;
    });

    return list.sort((a, b) => a.label.localeCompare(b.label));
  };

  const exportSalesmanSalaryPDF = () => {
    const aggs = aggregateBySalesman();
    const selected = salesReportSalesman === 'all' ? aggs : aggs.filter(a => a.id === salesReportSalesman);
    if (!selected.length) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36;
    const headerHeight = 96;
    const gapBetweenTables = 18;
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const paymentDate = new Date(now.getFullYear(), now.getMonth() + 1, 5);
    const payPeriod = `${periodStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} - ${periodEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    const paymentDateText = paymentDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const generatedOn = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    selected.forEach((s, idx) => {
      if (idx > 0) doc.addPage();

      const breakdown = calculateSalaryBreakdown({
        activeCustomers: s.activeCustomers,
        familyCustomers: s.familyCustomers,
        individualCustomers: s.individualCustomers,
        weekSales: s.weekSales,
        monthSales: s.monthSales,
        conversionRate: s.conversionRate
      });

      doc.setFillColor(30, 60, 114);
      doc.rect(0, 0, pageWidth, headerHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('ML Support', margin, 48);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(13);
      doc.text('Salesman Salary Slip', margin, 70);
      doc.setFontSize(10);
      doc.text(`Pay Period: ${payPeriod}`, margin, 86);
      doc.text(`Generated: ${generatedOn}`, pageWidth - margin, 86, { align: 'right' });

      doc.setTextColor(17, 24, 39);
      const infoHeadingY = headerHeight + 28;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Salesman Information', margin, infoHeadingY);

      const infoRowHeight = 18;
      const infoLeft: [string, string][] = [
        ['Salesman ID', s.id],
        ['Salesman Name', s.label],
        ['Total Customers', String(s.totalCustomers)],
        ['Active Customers', String(s.activeCustomers)]
      ];
      const infoRight: [string, string][] = [
        ['Pay Period', payPeriod],
        ['Payment Date', paymentDateText],
        ['Conversion Rate', `${(s.conversionRate * 100).toFixed(1)}%`],
        ['Performance Score', s.performanceScore.toFixed(2)]
      ];
      const infoRows = Math.max(infoLeft.length, infoRight.length);
      const infoBoxY = infoHeadingY + 10;
      const infoBoxHeight = infoRows * infoRowHeight + 32;

      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, infoBoxY, pageWidth - margin * 2, infoBoxHeight, 8, 8, 'FD');

      const leftColumnX = margin + 16;
      const rightColumnX = margin + (pageWidth - margin * 2) / 2 + 8;
      const valueOffset = 130;
      const infoBaseY = infoBoxY + 24;
      doc.setFontSize(10);

      infoLeft.forEach(([label, value], rowIndex) => {
        const y = infoBaseY + rowIndex * infoRowHeight;
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, leftColumnX, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.text(value || '-', leftColumnX + valueOffset, y);
      });

      infoRight.forEach(([label, value], rowIndex) => {
        const y = infoBaseY + rowIndex * infoRowHeight;
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, rightColumnX, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.text(value || '-', rightColumnX + valueOffset, y);
      });

      const tablesTop = infoBoxY + infoBoxHeight + 24;
      const availableWidth = pageWidth - margin * 2;
      const tableWidth = (availableWidth - gapBetweenTables) / 2;

      autoTable(doc, {
        startY: tablesTop,
        margin: { left: margin },
        tableWidth,
        head: [['Earnings', 'Amount (INR)']],
        body: breakdown.earnings.map(line => [line.label, formatAmount(line.amount, { blankZero: true })]),
        theme: 'grid',
        styles: {
          fontSize: 10,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.3,
          cellPadding: 6
        },
        headStyles: {
          fillColor: [30, 60, 114],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          1: { halign: 'right' }
        },
        foot: [['Total Earnings', formatAmount(breakdown.gross)]],
        footStyles: {
          fillColor: [224, 242, 254],
          textColor: [15, 23, 42],
          fontStyle: 'bold'
        }
      });

      const earningsEnd = (doc as any).lastAutoTable.finalY;

      autoTable(doc, {
        startY: tablesTop,
        margin: { left: margin + tableWidth + gapBetweenTables },
        tableWidth,
        head: [['Deductions', 'Amount (INR)']],
        body: breakdown.deductions.map(line => [line.label, formatAmount(line.amount, { blankZero: true })]),
        theme: 'grid',
        styles: {
          fontSize: 10,
          textColor: [71, 85, 105],
          lineColor: [226, 232, 240],
          lineWidth: 0.3,
          cellPadding: 6
        },
        headStyles: {
          fillColor: [190, 18, 60],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [255, 247, 247] },
        columnStyles: {
          1: { halign: 'right' }
        },
        foot: [['Total Deductions', formatAmount(breakdown.deductionTotal)]],
        footStyles: {
          fillColor: [254, 226, 226],
          textColor: [76, 5, 25],
          fontStyle: 'bold'
        }
      });

      const deductionsEnd = (doc as any).lastAutoTable.finalY;
      const summaryTop = Math.max(earningsEnd, deductionsEnd) + 28;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('Performance Snapshot', margin, summaryTop);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);

      const snapshotLines = [
        `Week Sales (last 7 days): ${s.weekSales}`,
        `Month Sales (MTD): ${s.monthSales}`,
        `Year Sales (YTD): ${s.yearSales}`,
        `Active / Inactive Customers: ${s.activeCustomers} / ${s.inactiveCustomers}`,
        `Family / Individual Plans: ${s.familyCustomers} / ${s.individualCustomers}`
      ];

      snapshotLines.forEach((line, index) => {
        doc.text(line, margin, summaryTop + 18 * (index + 1));
      });

      const netBoxY = summaryTop + 18 * snapshotLines.length + 30;
      const netBoxHeight = 56;

      doc.setFillColor(240, 249, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(margin, netBoxY, pageWidth - margin * 2, netBoxHeight, 8, 8, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 64, 175);
      doc.text('Net Salary Payable', margin + 16, netBoxY + 22);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Gross Earnings: ${formatAmount(breakdown.gross)}`, margin + 16, netBoxY + 38);
      doc.text(`Total Deductions: ${formatAmount(breakdown.deductionTotal)}`, margin + 16, netBoxY + 52);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(21, 94, 117);
      doc.text(formatAmount(breakdown.net), pageWidth - margin - 16, netBoxY + 38, { align: 'right' });

      const footerY = netBoxY + netBoxHeight + 36;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text('This is a computer-generated document. No signature is required.', margin, footerY);
      doc.text(`Page ${idx + 1} of ${selected.length}`, pageWidth - margin, footerY, { align: 'right' });
    });

    const fileLabel = salesReportSalesman === 'all' ? 'all' : salesReportSalesman;
    doc.save(`salary_slips_${fileLabel}.pdf`);
  };

  const exportSalesmanExcel = () => {
    const aggs = aggregateBySalesman();
    const selected = salesReportSalesman === 'all' ? aggs : aggs.filter(a => a.id === salesReportSalesman);
    if (!selected.length) return;

    const rows = selected.map(s => ({
      Salesman: s.label,
      'Week Sales (last 7d)': s.weekSales,
      'Month Sales (MTD)': s.monthSales,
      'Year Sales (YTD)': s.yearSales,
      'Total Customers': s.totalCustomers,
      Active: s.activeCustomers,
      Inactive: s.inactiveCustomers,
      Family: s.familyCustomers,
      Individual: s.individualCustomers,
      'Conversion %': Number((s.conversionRate * 100).toFixed(1)),
      'Gross Salary': Math.round(s.grossSalary),
      'Total Deductions': Math.round(s.deductionTotal),
      'Net Salary': Math.round(s.salary),
      'Performance Score': Number(s.performanceScore.toFixed(2)),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salesmen');
    XLSX.writeFile(wb, salesReportSalesman === 'all' ? 'salesmen_performance.xlsx' : `salesman_${salesReportSalesman}_performance.xlsx`);
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

        {/* Salesman Report Builder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5" />
              <span>Salesmen Report Builder</span>
            </CardTitle>
            <CardDescription>
              Export salary slips (PDF) or detailed performance (Excel) for selected salesmen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-1">
                <Label className="text-sm font-medium text-gray-700">Salesman</Label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm mt-1"
                  value={salesReportSalesman}
                  onChange={(e) => setSalesReportSalesman(e.target.value)}
                >
                  <option value="all">All Salesmen</option>
                  {uniqueSalesmen.map(id => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button onClick={exportSalesmanSalaryPDF} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  Export Salary Slip (PDF)
                </Button>
                <Button onClick={exportSalesmanExcel} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  Export Performance (Excel)
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
