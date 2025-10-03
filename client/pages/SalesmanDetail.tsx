import { useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useCustomers } from '@/contexts/CustomerContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, ArrowLeft, BarChart3, PieChart as PieChartIcon, Calendar as CalendarIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import { format, parseISO, isAfter, isBefore, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';

const COLORS = ['#2563eb', '#0ea5e9', '#10b981', '#f97316', '#facc15', '#a855f7', '#ef4444'];
const getColor = (i: number) => COLORS[i % COLORS.length];

const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const percentageFormatter = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 2 });

const isUnassignedId = (id: string) => String(id).trim().toLowerCase() === 'unassigned';

const monthKey = (dateStr: string) => {
  let d: Date;
  try { d = parseISO(dateStr); } catch { d = new Date(dateStr); }
  if (isNaN(d.getTime())) return 'Unknown';
  return format(d, 'yyyy-MM');
};

const prettyMonth = (key: string) => {
  try { const [y, m] = key.split('-').map(Number); return format(new Date(y, (m || 1) - 1, 1), 'MMM yyyy'); } catch { return key; }
};

const SalesmanDetailPage = () => {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const salesmanId = decodeURIComponent(String(paramId || ''));
  const { customers } = useCustomers();

  const [fromMonth, setFromMonth] = useState<string>(''); // yyyy-MM
  const [toMonth, setToMonth] = useState<string>(''); // yyyy-MM

  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeStatusPie, setIncludeStatusPie] = useState(true);
  const [includeTypePie, setIncludeTypePie] = useState(true);
  const [includeMonthly, setIncludeMonthly] = useState(true);

  const statusPieRef = useRef<HTMLDivElement | null>(null);
  const typePieRef = useRef<HTMLDivElement | null>(null);
  const monthlyRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);

  const { selectedCustomers, assignedTotal, unassignedTotal } = useMemo(() => {
    const normalizedId = isUnassignedId(salesmanId) ? 'Unassigned' : salesmanId;
    const forSalesman = customers.filter(c => (c.salesmanId?.trim() || 'Unassigned') === normalizedId);

    const assignedOnly = customers.filter(c => (c.salesmanId?.trim() || 'Unassigned').toLowerCase() !== 'unassigned');

    // Date filtering boundaries
    const from = fromMonth ? startOfMonth(parseISO(fromMonth + '-01')) : null;
    const to = toMonth ? endOfMonth(parseISO(toMonth + '-01')) : null;

    const inRange = (d: string) => {
      let date: Date; try { date = parseISO(d); } catch { date = new Date(d); }
      if (isNaN(date.getTime())) return true;
      if (from && isBefore(date, from)) return false;
      if (to && isAfter(date, to)) return false;
      return true;
    };

    const filtered = forSalesman.filter(c => inRange(c.joinDate));

    const assignedTotal = assignedOnly.filter(c => inRange(c.joinDate)).length;
    const unassignedTotal = customers.filter(c => (c.salesmanId?.trim() || 'Unassigned').toLowerCase() === 'unassigned' && inRange(c.joinDate)).length;

    return { selectedCustomers: filtered, assignedTotal, unassignedTotal };
  }, [customers, salesmanId, fromMonth, toMonth]);

  const metrics = useMemo(() => {
    const total = selectedCustomers.length;
    const active = selectedCustomers.filter(c => c.status === 'Active').length;
    const inactive = selectedCustomers.filter(c => c.status !== 'Active').length;
    const family = selectedCustomers.filter(c => c.familyType === 'Family').length;
    const individual = selectedCustomers.filter(c => c.familyType !== 'Family').length;

    const isUn = isUnassignedId(salesmanId);
    const perf = isUn ? (unassignedTotal > 0 ? 100 : 0) : (assignedTotal > 0 ? (total / assignedTotal) * 100 : 0);

    const safeParse = (d: string) => {
      let date: Date; try { date = parseISO(d); } catch { date = new Date(d); }
      return isNaN(date.getTime()) ? null : date;
    };

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const yearStart = startOfYear(now);
    const yearEnd = endOfYear(now);

    const addedWeek = selectedCustomers.filter(c => {
      const d = safeParse(c.joinDate); if (!d) return false;
      return !isBefore(d, weekStart) && !isAfter(d, weekEnd);
    }).length;

    const addedMonth = selectedCustomers.filter(c => {
      const d = safeParse(c.joinDate); if (!d) return false;
      return !isBefore(d, monthStart) && !isAfter(d, monthEnd);
    }).length;

    const addedYear = selectedCustomers.filter(c => {
      const d = safeParse(c.joinDate); if (!d) return false;
      return !isBefore(d, yearStart) && !isAfter(d, yearEnd);
    }).length;

    return { total, active, inactive, family, individual, perf, addedWeek, addedMonth, addedYear };
  }, [selectedCustomers, assignedTotal, unassignedTotal, salesmanId]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    selectedCustomers.forEach(c => {
      const key = monthKey(c.joinDate);
      map.set(key, (map.get(key) || 0) + 1);
    });
    const rows = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ month: prettyMonth(k), count: v }));
    return rows;
  }, [selectedCustomers]);

  const exportReport = async () => {
    if (exporting) return;
    try {
      setExporting(true);
      const wb = XLSX.utils.book_new();

      if (includeSummary) {
        const rows = [
          ['Salesman', salesmanId],
          ['Period From', fromMonth || 'All'],
          ['Period To', toMonth || 'All'],
          ['Total Customers', metrics.total],
          ['Active', metrics.active],
          ['Inactive', metrics.inactive],
          ['Family', metrics.family],
          ['Individual', metrics.individual],
          ['Added - This Week', metrics.addedWeek],
          ['Added - This Month', metrics.addedMonth],
          ['Added - This Year', metrics.addedYear],
          ['Performance (0-100)', metrics.perf.toFixed(2) + '/100']
        ];
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, sheet, 'Summary');
      }

      const images: { name: string; dataUrl: string; origin: { r: number; c: number } }[] = [];
      const capture = async (ref: HTMLDivElement | null, name: string, origin: { r: number; c: number }) => {
        if (!ref) return;
        const dataUrl = await toPng(ref, { cacheBust: true, backgroundColor: '#ffffff' });
        images.push({ name, dataUrl, origin });
      };

      const chartsSheet = XLSX.utils.aoa_to_sheet([[`Charts for ${salesmanId}`]]);

      if (includeStatusPie) await capture(statusPieRef.current, 'status-pie.png', { r: 2, c: 0 });
      if (includeTypePie) await capture(typePieRef.current, 'type-pie.png', { r: 22, c: 0 });
      if (includeMonthly) await capture(monthlyRef.current, 'monthly-bar.png', { r: 42, c: 0 });

      if (images.length) {
        const s = chartsSheet as XLSX.WorkSheet & { '!images'?: any[] };
        s['!images'] = images.map(img => ({ name: img.name, data: img.dataUrl.split(',')[1], opts: { base64: true, origin: img.origin, dpi: 144 } }));
      }

      XLSX.utils.book_append_sheet(wb, chartsSheet, 'Charts');

      const ts = format(new Date(), 'yyyy-MM-dd-HHmm');
      XLSX.writeFile(wb, `salesman-${encodeURIComponent(salesmanId)}-${ts}.xlsx`, { compression: true });
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setExporting(false);
    }
  };

  const title = isUnassignedId(salesmanId) ? 'Unassigned Customers' : `Salesman ${salesmanId}`;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{title} – Details</h1>
            <p className="text-gray-600 mt-1">Deep-dive into customers, status mix, plan types, performance share, and monthly trend. Use filters to build custom reports.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(-1)} className="flex items-center gap-2"><ArrowLeft className="h-4 w-4"/>Back</Button>
            <Button onClick={exportReport} disabled={exporting} className="flex items-center gap-2"><Download className="h-4 w-4"/>{exporting ? 'Exporting...' : 'Export'}</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5"/>Filters & Report Builder</CardTitle>
            <CardDescription>Select a month range and choose which sections to include in export.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-600">From (month)</label>
                <input type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">To (month)</label>
                <input type="month" value={toMonth} onChange={e => setToMonth(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={includeSummary} onCheckedChange={v => setIncludeSummary(!!v)} />Summary</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={includeStatusPie} onCheckedChange={v => setIncludeStatusPie(!!v)} />Active vs Inactive</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={includeTypePie} onCheckedChange={v => setIncludeTypePie(!!v)} />Family vs Individual</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={includeMonthly} onCheckedChange={v => setIncludeMonthly(!!v)} />Monthly Trend</label>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total Customers" value={metrics.total} />
          <Stat label="Active" value={metrics.active} />
          <Stat label="Inactive" value={metrics.inactive} />
          <Stat label="Performance" valueLabel={`${metrics.perf.toFixed(2)}/100`} />
          <Stat label="Added (This Week)" value={metrics.addedWeek} />
          <Stat label="Added (This Month)" value={metrics.addedMonth} />
          <Stat label="Added (This Year)" value={metrics.addedYear} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PieChartIcon className="h-5 w-5"/>Active vs Inactive</CardTitle>
              <CardDescription>Status distribution.</CardDescription>
            </CardHeader>
            <CardContent>
              <div ref={statusPieRef} className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie dataKey="value" data={[{name:'Active', value: metrics.active},{name:'Inactive', value: metrics.inactive}]} cx="50%" cy="50%" outerRadius={110} innerRadius={50} paddingAngle={4}>
                      {[metrics.active, metrics.inactive].map((_, i) => <Cell key={i} fill={getColor(i)} />)}
                    </Pie>
                    <ReTooltip formatter={(v: number) => `${v} customers`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PieChartIcon className="h-5 w-5"/>Family vs Individual</CardTitle>
              <CardDescription>Plan type distribution.</CardDescription>
            </CardHeader>
            <CardContent>
              <div ref={typePieRef} className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie dataKey="value" data={[{name:'Family', value: metrics.family},{name:'Individual', value: metrics.individual}]} cx="50%" cy="50%" outerRadius={110} innerRadius={50} paddingAngle={4}>
                      {[metrics.family, metrics.individual].map((_, i) => <Cell key={i} fill={getColor(i+2)} />)}
                    </Pie>
                    <ReTooltip formatter={(v: number) => `${v} customers`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5"/>Monthly Additions</CardTitle>
            <CardDescription>Customers added per month.</CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={monthlyRef} className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={monthlyData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ReTooltip formatter={(v: number) => `${v} customers`} />
                  <Legend />
                  <Bar dataKey="count" name="Customers" fill="#2563eb" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customers</CardTitle>
            <CardDescription>Filtered list for {salesmanId}.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Reg ID</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Join Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedCustomers.map(c => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 font-medium text-gray-900">{c.regId}</td>
                    <td className="px-4 py-2 text-gray-700">{c.name}</td>
                    <td className="px-4 py-2 text-gray-700">{c.status}</td>
                    <td className="px-4 py-2 text-gray-700">{c.familyType}</td>
                    <td className="px-4 py-2 text-gray-700">{c.joinDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

const Stat = ({ label, value, valueLabel }: { label: string; value?: number; valueLabel?: string }) => (
  <Card className="relative overflow-hidden">
    <CardHeader className="flex items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-600">{label}</CardTitle>
      <Badge className="bg-gray-100 text-gray-700">KPI</Badge>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-gray-900">{valueLabel ?? (value ?? 0).toLocaleString()}</div>
      <p className="text-xs text-gray-500 mt-1">{label === 'Performance' ? 'Share within assigned set' : 'Summary metric'}</p>
    </CardContent>
  </Card>
);

export default SalesmanDetailPage;
