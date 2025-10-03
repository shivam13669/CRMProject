import { ComponentType, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useCustomers } from '@/contexts/CustomerContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Award,
  BarChart3,
  Download,
  PieChart as PieChartIcon,
  TrendingUp,
  Users
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface SalesmanAggregate {
  id: string;
  label: string;
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  familyCustomers: number;
  individualCustomers: number;
  salary: number;
  conversionRate: number;
  performanceScore: number;
}

const BASE_SALARY = 15000;
const ACTIVE_INCENTIVE = 500;
const FAMILY_INCENTIVE = 250;
const INDIVIDUAL_INCENTIVE = 150;
const CONVERSION_MULTIPLIER = 3000;

const COLORS = ['#2563eb', '#0ea5e9', '#10b981', '#f97316', '#facc15', '#a855f7', '#ef4444'];

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

const percentageFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

const calculateSalary = (metrics: {
  activeCustomers: number;
  familyCustomers: number;
  individualCustomers: number;
  conversionRate: number;
}) =>
  BASE_SALARY +
  metrics.activeCustomers * ACTIVE_INCENTIVE +
  metrics.familyCustomers * FAMILY_INCENTIVE +
  metrics.individualCustomers * INDIVIDUAL_INCENTIVE +
  metrics.conversionRate * CONVERSION_MULTIPLIER;

const calculatePerformance = (metrics: {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  familyCustomers: number;
  individualCustomers: number;
  conversionRate: number;
}) => {
  if (metrics.totalCustomers === 0) {
    return 0;
  }
  const volumeScore = metrics.totalCustomers * 1.2;
  const activityScore = metrics.activeCustomers * 1.5 - metrics.inactiveCustomers * 0.6;
  const mixScore = metrics.familyCustomers * 0.8 + metrics.individualCustomers * 0.6;
  const conversionScore = metrics.conversionRate * 60;
  return Math.max(volumeScore + activityScore + mixScore + conversionScore, 0);
};

const getColor = (index: number) => COLORS[index % COLORS.length];
const isUnassignedId = (id: string) => String(id).trim().toLowerCase() === 'unassigned';

const SalesmenPage = () => {
  const { customers, loading } = useCustomers();
  const [exporting, setExporting] = useState(false);
  const pieChartRef = useRef<HTMLDivElement | null>(null);
  const barChartRef = useRef<HTMLDivElement | null>(null);

  const { aggregates, bestPerformer, totals } = useMemo(() => {
    if (!customers.length) {
      return {
        aggregates: [] as SalesmanAggregate[],
        bestPerformer: null as SalesmanAggregate | null,
        totals: {
          totalSalesmen: 0,
          totalCustomers: 0,
          totalActive: 0,
          totalSalary: 0
        }
      };
    }

    const bySalesman = customers.reduce<Record<string, Omit<SalesmanAggregate, 'id' | 'label' | 'salary' | 'performanceScore'>>>((acc, customer) => {
      const key = customer.salesmanId?.trim() || 'Unassigned';
      if (!acc[key]) {
        acc[key] = {
          totalCustomers: 0,
          activeCustomers: 0,
          inactiveCustomers: 0,
          familyCustomers: 0,
          individualCustomers: 0,
          conversionRate: 0
        };
      }

      acc[key].totalCustomers += 1;
      if (customer.status === 'Active') {
        acc[key].activeCustomers += 1;
      } else {
        acc[key].inactiveCustomers += 1;
      }
      if (customer.familyType === 'Family') {
        acc[key].familyCustomers += 1;
      } else {
        acc[key].individualCustomers += 1;
      }
      return acc;
    }, {});

    const aggregates = Object.entries(bySalesman).map(([id, metrics]) => {
      const conversionRate = metrics.totalCustomers
        ? metrics.activeCustomers / metrics.totalCustomers
        : 0;
      const salary = calculateSalary({
        activeCustomers: metrics.activeCustomers,
        familyCustomers: metrics.familyCustomers,
        individualCustomers: metrics.individualCustomers,
        conversionRate
      });
      const performanceScore = calculatePerformance({
        totalCustomers: metrics.totalCustomers,
        activeCustomers: metrics.activeCustomers,
        inactiveCustomers: metrics.inactiveCustomers,
        familyCustomers: metrics.familyCustomers,
        individualCustomers: metrics.individualCustomers,
        conversionRate
      });

      return {
        id,
        label: id,
        totalCustomers: metrics.totalCustomers,
        activeCustomers: metrics.activeCustomers,
        inactiveCustomers: metrics.inactiveCustomers,
        familyCustomers: metrics.familyCustomers,
        individualCustomers: metrics.individualCustomers,
        conversionRate,
        salary,
        performanceScore
      };
    });

    const sortedAggregates = aggregates.sort((a, b) => {
      if (b.performanceScore === a.performanceScore) {
        return b.totalCustomers - a.totalCustomers;
      }
      return b.performanceScore - a.performanceScore;
    });

    const totals = sortedAggregates.reduce(
      (acc, aggregate) => {
        acc.totalCustomers += aggregate.totalCustomers;
        acc.totalActive += aggregate.activeCustomers;
        acc.totalSalary += aggregate.salary;
        return acc;
      },
      {
        totalSalesmen: sortedAggregates.length,
        totalCustomers: 0,
        totalActive: 0,
        totalSalary: 0
      }
    );

    return {
      aggregates: sortedAggregates,
      bestPerformer: sortedAggregates[0] || null,
      totals
    };
  }, [customers]);

  const isUnassignedId = (id: string) => id.trim().toLowerCase() === 'unassigned';

  const yearDistribution = useMemo(() => {
    const counts = customers.reduce<Record<string, number>>((acc, c) => {
      const raw = c.joinDate || c.createdAt || '';
      let year = 'Unknown';
      if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) year = String(d.getFullYear());
      }
      acc[year] = (acc[year] || 0) + 1;
      return acc;
    }, {});
    const entries = Object.entries(counts).map(([year, total]) => ({
      id: year,
      label: year,
      totalCustomers: total
    }));
    const byYear = entries.filter(e => e.label !== 'Unknown').sort((a, b) => Number(a.label) - Number(b.label));
    const unknown = entries.find(e => e.label === 'Unknown');
    return unknown ? [...byYear, unknown] : byYear;
  }, [customers]);

  const assignedTotal = useMemo(
    () => aggregates.filter(a => !isUnassignedId(a.id)).reduce((sum, a) => sum + a.totalCustomers, 0),
    [aggregates]
  );

  const unassignedTotal = useMemo(
    () => aggregates.filter(a => isUnassignedId(a.id)).reduce((sum, a) => sum + a.totalCustomers, 0),
    [aggregates]
  );

  const handleExport = async () => {
    if (!aggregates.length || exporting) {
      return;
    }

    try {
      setExporting(true);

      const workbook = XLSX.utils.book_new();
      const maxPerformance = Math.max(...aggregates.map(item => item.performanceScore), 1);
      const rows = aggregates.map((item, index) => ({
        Rank: index + 1,
        Salesman: item.label,
        Salary: Math.round(item.salary),
        'Customers Added': item.totalCustomers,
        Active: item.activeCustomers,
        Inactive: item.inactiveCustomers,
        'Family Plans': item.familyCustomers,
        'Individual Plans': item.individualCustomers,
        'Performance (0-100)': Number(((item.performanceScore / maxPerformance) * 100).toFixed(0))
      }));
      const reportSheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, reportSheet, 'Salesmen Report');

      const chartSheet = XLSX.utils.aoa_to_sheet([
        ['Charts'],
        ['Pie chart illustrates customer distribution, bar chart shows salary comparison.']
      ]);

      const images: { name: string; dataUrl: string; origin: { r: number; c: number } }[] = [];
      if (pieChartRef.current) {
        const pie = await toPng(pieChartRef.current, { cacheBust: true, backgroundColor: '#ffffff' });
        images.push({ name: 'salesmen-pie.png', dataUrl: pie, origin: { r: 2, c: 0 } });
      }
      if (barChartRef.current) {
        const bar = await toPng(barChartRef.current, { cacheBust: true, backgroundColor: '#ffffff' });
        images.push({ name: 'salesmen-bar.png', dataUrl: bar, origin: { r: 20, c: 0 } });
      }

      if (images.length) {
        const sheetWithImages = chartSheet as XLSX.WorkSheet & { '!images'?: any[] };
        sheetWithImages['!images'] = images.map(image => ({
          name: image.name,
          data: image.dataUrl.split(',')[1],
          opts: {
            base64: true,
            origin: image.origin,
            dpi: 144
          }
        }));
      }

      XLSX.utils.book_append_sheet(workbook, chartSheet, 'Charts');
      workbook.SheetNames = ['Salesmen Report', ...workbook.SheetNames.filter(name => name !== 'Salesmen Report')];

      const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm');
      XLSX.writeFile(workbook, `salesmen-report-${timestamp}.xlsx`, { compression: true });
    } catch (error) {
      console.error('Failed to export salesmen report', error);
    } finally {
      setExporting(false);
    }
  };

  const renderEmptyState = () => (
    <Card>
      <CardHeader>
        <CardTitle>No salesmen data available</CardTitle>
        <CardDescription>Add customers with assigned salesmen to view analytics.</CardDescription>
      </CardHeader>
    </Card>
  );

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Salesmen Analytics</h1>
            <p className="text-gray-600 mt-1">
              Track sales team performance, customer distribution, and compensation insights.
            </p>
          </div>
          <Button
            onClick={handleExport}
            disabled={!aggregates.length || exporting}
            className="flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>{exporting ? 'Exporting...' : 'Export Report'}</span>
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-500">Loading salesmen insights...</CardContent>
          </Card>
        ) : !aggregates.length ? (
          renderEmptyState()
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={Users}
                label="Total Salesmen"
                value={totals.totalSalesmen}
                helperText="With assigned customers"
              />
              <StatCard
                icon={TrendingUp}
                label="Total Customers"
                value={totals.totalCustomers}
                helperText="Across all salesmen"
              />
              <StatCard
                icon={BarChart3}
                label="Active Customers"
                value={totals.totalActive}
                helperText="Currently managed"
              />
              <StatCard
                icon={Award}
                label="Average Salary"
                value={totals.totalSalesmen ? Math.round(totals.totalSalary / totals.totalSalesmen) : 0}
                helperText="Estimated monthly"
                isCurrency
              />
            </div>

            {bestPerformer && (
              <Card className="border-l-4 border-l-emerald-500">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-3 text-emerald-700">
                      <Award className="w-5 h-5" />
                      <span>Top Performer</span>
                    </CardTitle>
                    <CardDescription>
                    {`${bestPerformer.label} is leading with ${bestPerformer.totalCustomers} customers and ${percentageFormatter.format(bestPerformer.conversionRate)} conversion.`}
                  </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <MetricPill label="Customers" value={`${bestPerformer.totalCustomers}`} />
                    <MetricPill
                      label="Active"
                      value={`${bestPerformer.activeCustomers}`}
                      tone="success"
                    />
                    <MetricPill
                      label="Conversion"
                      value={percentageFormatter.format(bestPerformer.conversionRate)}
                    />
                    <MetricPill
                      label="Salary"
                      value={currencyFormatter.format(bestPerformer.salary)}
                      tone="info"
                    />
                  </div>
                </CardHeader>
              </Card>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PieChartIcon className="w-5 h-5" />
                    <span>Customer Distribution</span>
                  </CardTitle>
                  <CardDescription>Share of customers by year.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div ref={pieChartRef} className="mx-auto h-[320px] w-full">
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={yearDistribution}
                          dataKey="totalCustomers"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={110}
                          innerRadius={50}
                          paddingAngle={4}
                        >
                          {yearDistribution.map((entry, index) => (
                            <Cell key={entry.id} fill={getColor(index)} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${value} customers`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>Salary vs Performance</span>
                  </CardTitle>
                  <CardDescription>Compare incentives and performance across the team.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div ref={barChartRef} className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={aggregates} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value: number, name: string, item: any) => {
                            const isPerformance = item?.dataKey === 'performanceScore';
                            if (isPerformance) {
                              const id = String(item?.payload?.id ?? '');
                              if (isUnassignedId(id)) {
                                const percent = unassignedTotal > 0 ? 100 : 0;
                                return [`${percent.toFixed(2)}/100`, 'Performance'];
                              }
                              const percent = assignedTotal > 0
                                ? (item.payload.totalCustomers / assignedTotal) * 100
                                : 0;
                              return [`${percent.toFixed(2)}/100`, 'Performance'];
                            }
                            return [currencyFormatter.format(value as number), 'Estimated Salary'];
                          }}
                        />
                        <Legend />
                        <Bar dataKey="salary" name="Estimated Salary" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="performanceScore" name="Performance" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Salesmen Performance Table</CardTitle>
                <CardDescription>Detailed breakdown of customers, performance, and compensation.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <HeaderCell label="Salesman" />
                      <HeaderCell label="Customers" />
                      <HeaderCell label="Active" />
                      <HeaderCell label="Inactive" />
                      <HeaderCell label="Family" />
                      <HeaderCell label="Individual" />
                      <HeaderCell label="Conversion" />
                      <HeaderCell label="Performance" />
                      <HeaderCell label="Salary" />
                      <HeaderCell label="Details" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {aggregates.map((item, index) => (
                      <tr key={item.id} className={index === 0 ? 'bg-emerald-50/70' : ''}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                              #{index + 1}
                            </Badge>
                            {item.label}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{item.totalCustomers}</td>
                        <td className="px-4 py-3 text-emerald-600">{item.activeCustomers}</td>
                        <td className="px-4 py-3 text-rose-500">{item.inactiveCustomers}</td>
                        <td className="px-4 py-3 text-gray-700">{item.familyCustomers}</td>
                        <td className="px-4 py-3 text-gray-700">{item.individualCustomers}</td>
                        <td className="px-4 py-3 text-gray-700">{percentageFormatter.format(item.conversionRate)}</td>
                        <td className="px-4 py-3 text-gray-700">{isUnassignedId(item.id)
                          ? (unassignedTotal > 0 ? '100.00/100' : '-')
                          : (assignedTotal > 0 ? `${((item.totalCustomers / assignedTotal) * 100).toFixed(2)}/100` : '-')}
                        </td>
                        <td className="px-4 py-3 text-gray-900">{currencyFormatter.format(item.salary)}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {isUnassignedId(item.id) ? (
                            <span className="text-gray-400">N/A</span>
                          ) : (
                            <Link to={`/salesmen/${encodeURIComponent(item.id)}`} className="text-blue-600 hover:underline">View Details</Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  helperText,
  isCurrency
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  helperText: string;
  isCurrency?: boolean;
}) => (
  <Card className="relative overflow-hidden">
    <CardHeader className="flex items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-600">{label}</CardTitle>
      <Icon className="h-5 w-5 text-blue-500" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-gray-900">
        {isCurrency ? currencyFormatter.format(value) : value.toLocaleString()}
      </div>
      <p className="text-xs text-gray-500 mt-1">{helperText}</p>
    </CardContent>
  </Card>
);

const MetricPill = ({
  label,
  value,
  tone = 'default'
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'info';
}) => {
  const toneClasses = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-emerald-100 text-emerald-700',
    info: 'bg-blue-100 text-blue-700'
  } as const;

  return (
    <div className={`rounded-full px-4 py-1 font-medium ${toneClasses[tone]}`}>
      <span className="mr-2 text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  );
};

const HeaderCell = ({ label }: { label: string }) => (
  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
    {label}
  </th>
);

export default SalesmenPage;
