'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@/lib/auth-store';
import { useTranslation } from '@/lib/use-translation';
import { getMonthNames } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { PageHeader } from '@/components/shared/page-header';
import {
  Download,
  Calculator,
  TrendingUp,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  Receipt,
  ShoppingBag,
} from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  date: string;
  type: 'SALE' | 'PURCHASE';
  amount: number;
  description: string;
  vatPercent: number;
  receiptImage: string | null;
  invoiceId?: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  lineItems: string;
  subtotal: number;
  vatTotal: number;
  total: number;
  status: string;
  customerName: string;
}

interface VATReportProps {
  user: User;
}

const CHART_COLORS = ['#0d9488', '#7c9a82', '#c9a87c', '#9490e8', '#c9928f', '#7dabb5'];
const PURCHASE_COLORS = ['#c9a87c', '#5eead4', '#6a66d8', '#8a6644', '#0f766e', '#d4a574'];

interface VATRegisterData {
  outputVAT: Array<{ code: string; rate: number; netAmount: number; creditTotal: number; debitTotal: number }>;
  inputVAT: Array<{ code: string; rate: number; netAmount: number; creditTotal: number; debitTotal: number }>;
  totalOutputVAT: number;
  totalInputVAT: number;
  netVATPayable: number;
}

export function VATReport({ user }: VATReportProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t, tc, language } = useTranslation();
  const [vatRegisterData, setVatRegisterData] = useState<VATRegisterData | null>(null);
  const [companyYear, setCompanyYear] = useState<number | null>(null);
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());

  // Get month names based on language
  const monthNames = getMonthNames(language);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch transactions, invoices, VAT register, and company info in parallel
        const [txResponse, invResponse, vatRes, companyRes] = await Promise.all([
          fetch('/api/transactions'),
          fetch('/api/invoices'),
          fetch(`/api/vat-register?from=2000-01-01&to=2099-12-31`),
          fetch('/api/company'),
        ]);

        if (!txResponse.ok) console.error('Transactions API error:', txResponse.status);
        if (!invResponse.ok) console.error('Invoices API error:', invResponse.status);

        const txData = txResponse.ok ? await txResponse.json() : {};
        const invData = invResponse.ok ? await invResponse.json() : {};
        const vatData = vatRes.ok ? await vatRes.json() : null;
        const companyData = companyRes.ok ? await companyRes.json() : null;

        // Store company year for smarter default
        if (companyData?.companyInfo?.currentYear) {
          setCompanyYear(companyData.companyInfo.currentYear);
          // If company year differs from current year, default to company year
          // This ensures demo company (2024) shows data by default
          const cYear = companyData.companyInfo.currentYear;
          if (cYear !== currentDate.getFullYear()) {
            setSelectedYear(cYear.toString());
          }
        }

        // Check for double-entry VAT data
        if (vatData && (vatData.totalOutputVAT > 0 || vatData.totalInputVAT > 0)) {
          setVatRegisterData(vatData);
        }

        const allTransactions: Transaction[] = txData.transactions || [];
        const invoices: Invoice[] = invData.invoices || [];

        // If we got double-entry data and no legacy transactions, still set legacy for the table
        if (allTransactions.length === 0 && vatData?.entries) {
          // Create virtual transactions from journal entries for the detailed table.
          // IMPORTANT: For VAT-coded lines, the amount on the line IS the actual VAT
          // (e.g., credit 25,000 on account 4510 for S25). To make the standard
          // formula (amount * vatPercent / 100) work correctly, we reconstruct the
          // NET base amount by dividing by the rate.
          const virtualFromJE: Transaction[] = [];
          for (const entry of vatData.entries) {
            for (const line of entry.lines) {
              const vatCode = line.vatCode || 'NONE';
              if (vatCode === 'NONE') continue;
              const isOutput = ['S25', 'S12', 'S0', 'SEU'].includes(vatCode);
              const rate = line.vatCode === 'S25' || line.vatCode === 'K25' ? 25 :
                          line.vatCode === 'S12' || line.vatCode === 'K12' ? 12 : 0;
              const vatAmount = isOutput ? (line.credit || line.debit) : (line.debit || line.credit);
              // Reconstruct net base so that netBase * rate / 100 === vatAmount
              const netBase = rate > 0 ? (vatAmount / rate) * 100 : vatAmount;
              virtualFromJE.push({
                id: `je-${line.id}`,
                date: entry.date,
                type: isOutput ? 'SALE' : 'PURCHASE',
                amount: netBase,
                description: line.description || entry.description,
                vatPercent: rate,
                receiptImage: null,
              });
            }
          }
          setTransactions(virtualFromJE);
        } else {
          // Collect IDs of invoices that already have transactions (to avoid double-counting)
          const invoiceIdsWithTransactions = new Set(
            allTransactions
              .filter((tx) => tx.invoiceId)
              .map((tx) => tx.invoiceId)
          );

          // For invoices without transactions, create virtual transactions from line items
          // Only include SENT and PAID invoices (exclude DRAFT and CANCELLED)
          const virtualTransactions: Transaction[] = [];

          for (const invoice of invoices) {
            if (invoice.status === 'CANCELLED' || invoice.status === 'DRAFT') continue;
            if (invoiceIdsWithTransactions.has(invoice.id)) continue;

            try {
              const lineItems = JSON.parse(invoice.lineItems) as Array<{
                description: string;
                quantity: number;
                unitPrice: number;
                vatPercent: number;
              }>;

              for (const item of lineItems) {
                if (!item.description?.trim() || item.unitPrice <= 0) continue;

                const lineTotal = item.quantity * item.unitPrice;
                virtualTransactions.push({
                  id: `inv-${invoice.id}-${item.description.slice(0, 20)}`,
                  date: invoice.issueDate,
                  type: 'SALE',
                  amount: lineTotal,
                  description: `${invoice.invoiceNumber} - ${item.description}`,
                  vatPercent: item.vatPercent,
                  receiptImage: null,
                  invoiceId: invoice.id,
                });
              }
            } catch {
              // Skip invoices with invalid lineItems JSON
              console.warn(`Could not parse lineItems for invoice ${invoice.id}`);
            }
          }

          // Merge real transactions with virtual ones from invoices
          setTransactions([...allTransactions, ...virtualTransactions]);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    // Include company year if different from current year (e.g., demo company with 2024 data)
    const startYear = companyYear ? Math.min(currentYear, companyYear) : currentYear;
    return Array.from({ length: Math.max(4, currentYear - startYear + 2) }, (_, i) => currentYear - i);
  }, [companyYear]);

  const filteredTransactions = useMemo(() => {
    const monthStr = selectedMonth.padStart(2, '0');
    const filterPrefix = `${selectedYear}-${monthStr}`;
    return transactions.filter((t) => {
      const dateStr = t.date?.substring(0, 10) || '';
      return dateStr.startsWith(filterPrefix);
    });
  }, [transactions, selectedMonth, selectedYear]);

  // Separate sales and purchases
  // Z_REPORT (daily POS sales) treated as SALE; ADJUSTMENT treated based on vatPercent
  const { sales, purchases } = useMemo(() => {
    const sales = filteredTransactions.filter((t) => t.type === 'SALE' || (t.type as string) === 'Z_REPORT' || !t.type);
    const purchases = filteredTransactions.filter((t) => t.type === 'PURCHASE');
    return { sales, purchases };
  }, [filteredTransactions]);

  // Output VAT breakdown (Sales)
  // Always derived from the VAT register (double-entry bookkeeping)
  // to ensure consistency with the summary cards.
  const outputVATBreakdown = useMemo(() => {
    if (vatRegisterData) {
      return vatRegisterData.outputVAT.map((entry) => ({
        rate: entry.rate,
        count: 0,
        totalAmount: entry.netAmount,
        totalVAT: entry.creditTotal - entry.debitTotal,
        type: 'output' as const,
      }));
    }

    return [];
  }, [vatRegisterData]);

  // Input VAT breakdown (Purchases)
  // Always derived from the VAT register (double-entry bookkeeping)
  const inputVATBreakdown = useMemo(() => {
    if (vatRegisterData) {
      return vatRegisterData.inputVAT.map((entry) => ({
        rate: entry.rate,
        count: 0,
        totalAmount: entry.netAmount,
        totalVAT: entry.debitTotal - entry.creditTotal,
        type: 'input' as const,
      }));
    }

    return [];
  }, [vatRegisterData]);

  const totals = useMemo(() => {
    // VAT totals come exclusively from the VAT register (double-entry bookkeeping)
    const outputVAT = vatRegisterData?.totalOutputVAT || 0;
    const inputVAT = vatRegisterData?.totalInputVAT || 0;
    const netPayable = vatRegisterData?.netVATPayable || 0;
    const totalSalesAmount = sales.reduce((sum, t) => sum + t.amount, 0);
    const totalPurchasesAmount = purchases.reduce((sum, t) => sum + t.amount, 0);

    return {
      outputVAT,
      inputVAT,
      netPayable,
      totalSalesAmount,
      totalPurchasesAmount,
      salesCount: sales.length,
      purchasesCount: purchases.length,
      transactionCount: filteredTransactions.length,
    };
  }, [sales, purchases, filteredTransactions, vatRegisterData]);

  // Output VAT pie chart data (sales only)
  const outputPieData = useMemo(() => {
    return outputVATBreakdown.map((item, index) => ({
      name: `${item.rate}%`,
      value: item.totalVAT,
      count: item.count,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [outputVATBreakdown]);

  // Input VAT pie chart data (purchases only)
  const inputPieData = useMemo(() => {
    return inputVATBreakdown.map((item, index) => ({
      name: `${item.rate}%`,
      value: item.totalVAT,
      count: item.count,
      fill: PURCHASE_COLORS[index % PURCHASE_COLORS.length],
    }));
  }, [inputVATBreakdown]);

  const handleExportCSV = useCallback(() => {
    const headers = language === 'da' 
      ? ['Type', 'Dato', 'Beskrivelse', 'Beløb (kr)', 'Moms %', 'Moms (kr)']
      : ['Type', 'Date', 'Description', 'Amount (DKK)', 'VAT %', 'VAT (DKK)'];

    const rows = filteredTransactions.map((t) => [
      t.type === 'PURCHASE' ? (language === 'da' ? 'Køb' : 'Purchase') : (language === 'da' ? 'Salg' : 'Sale'),
      format(new Date(t.date), 'dd/MM/yyyy'),
      `"${t.description.replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      t.vatPercent.toFixed(1),
      ((t.amount * t.vatPercent) / 100).toFixed(2),
    ]);

    rows.push([]);
    rows.push(['', language === 'da' ? 'TOTALER' : 'TOTALS', '', '', '', '']);
    rows.push(['', language === 'da' ? 'Salgsposteringer' : 'Sales transactions', totals.salesCount.toString(), '', '', '']);
    rows.push(['', language === 'da' ? 'Købsposteringer' : 'Purchase transactions', totals.purchasesCount.toString(), '', '', '']);
    rows.push(['', language === 'da' ? 'Samlet salg' : 'Total Sales', totals.totalSalesAmount.toFixed(2), '', '', '']);
    rows.push(['', language === 'da' ? 'Samlet køb' : 'Total Purchases', totals.totalPurchasesAmount.toFixed(2), '', '', '']);
    rows.push(['', language === 'da' ? 'Udgående moms (salg)' : 'Output VAT (Sales)', totals.outputVAT.toFixed(2), '', '', '']);
    rows.push(['', language === 'da' ? 'Indgående moms (køb)' : 'Input VAT (Purchases)', totals.inputVAT.toFixed(2), '', '', '']);
    rows.push(['', language === 'da' ? (totals.netPayable >= 0 ? 'At betale' : 'Til godtgørelse') : (totals.netPayable >= 0 ? 'To Pay' : 'To Refund'), Math.abs(totals.netPayable).toFixed(2), '', '', '']);

    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = language === 'da' ? `momsafregning-${selectedMonth}-${selectedYear}.csv` : `vat-report-${selectedMonth}-${selectedYear}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filteredTransactions, totals, selectedMonth, selectedYear, language]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#0d9488]" />
          <p className="text-gray-500 dark:text-gray-400">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <PageHeader
        title={t('vatReport')}
        description={language === 'da' ? 'Momsrapport til Skattestyrelsen' : 'VAT report for Danish tax authorities'}
      />

      {/* Period Selector */}
      <Card className="stat-card card-hover-lift border-0 shadow-lg dark:border dark:border-white/5">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  {t('month')}
                </label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="bg-gray-50 dark:bg-white/5 border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#1a1f1e]">
                    {monthNames.map((month, index) => (
                      <SelectItem key={index} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  {t('year')}
                </label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="bg-gray-50 dark:bg-white/5 border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#1a1f1e]">
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleExportCSV} className="gap-2 btn-primary">
              <Download className="h-4 w-4" />
              {t('exportCSV')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Output VAT (Sales) */}
        <Card className="stat-card card-hover-lift">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full stat-icon-primary flex items-center justify-center">
                <ArrowUpCircle className="h-4 w-4 sm:h-6 sm:w-6 text-[#0d9488] dark:text-[#2dd4bf]" />
              </div>
              <Badge className="status-badge status-badge-sent text-[10px] sm:text-xs">{totals.salesCount}</Badge>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">{t('outputVAT')}</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-0.5 sm:mt-1">{tc(totals.outputVAT)}</p>
            <p className="text-gray-400 dark:text-gray-500 text-[10px] sm:text-xs mt-1 sm:mt-2">{t('salesVATCollected')}</p>
          </CardContent>
        </Card>

        {/* Input VAT (Purchases) */}
        <Card className="stat-card card-hover-lift">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full stat-icon-amber flex items-center justify-center">
                <ArrowDownCircle className="h-4 w-4 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <Badge className="status-badge status-badge-overdue text-[10px] sm:text-xs">{totals.purchasesCount}</Badge>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">{t('inputVAT')}</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-0.5 sm:mt-1">{tc(totals.inputVAT)}</p>
            <p className="text-gray-400 dark:text-gray-500 text-[10px] sm:text-xs mt-1 sm:mt-2">{t('purchaseVATDeductible')}</p>
          </CardContent>
        </Card>

        {/* Net VAT */}
        <Card className="stat-card card-hover-lift">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className={`h-9 w-9 sm:h-12 sm:w-12 rounded-full flex items-center justify-center ${totals.netPayable >= 0 ? 'stat-icon-green' : 'stat-icon-purple'}`}>
                <Calculator className={`h-4 w-4 sm:h-6 sm:w-6 ${totals.netPayable >= 0 ? 'text-green-600 dark:text-green-400' : 'text-[#0d9488] dark:text-[#2dd4bf]'}`} />
              </div>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">
              {totals.netPayable >= 0 ? t('toPay') : t('toRefund')}
            </p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-0.5 sm:mt-1">{tc(Math.abs(totals.netPayable))}</p>
            <p className="text-gray-400 dark:text-gray-500 text-[10px] sm:text-xs mt-1 sm:mt-2">{t('netVATAmount')}</p>
          </CardContent>
        </Card>

        {/* Transactions Summary */}
        <Card className="stat-card card-hover-lift">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full stat-icon-blue flex items-center justify-center">
                <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6 text-[#7dabb5] dark:text-[#80c0cc]" />
              </div>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">{t('transaktioner')}</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-0.5 sm:mt-1">
              {totals.transactionCount}
            </p>
            <div className="flex gap-3 sm:gap-4 mt-1 sm:mt-2 text-[10px] sm:text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Receipt className="h-3 w-3 text-[#0d9488] dark:text-[#2dd4bf]" /> {tc(totals.totalSalesAmount)}
              </span>
              <span className="flex items-center gap-1">
                <ShoppingBag className="h-3 w-3 text-amber-600 dark:text-amber-400" /> {tc(totals.totalPurchasesAmount)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Output VAT Pie Chart */}
        <Card className="stat-card card-hover-lift">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-[#0d9488]" />
              {language === 'da' ? 'Udgående moms pr. sats' : 'Output VAT by Rate'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {outputPieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={outputPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {outputPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => tc(value)}
                      contentStyle={{
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                    <Legend 
                      formatter={(value) => <span className="text-xs">{value} {language === 'da' ? 'moms' : 'VAT'}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                {t('noDataForPeriod')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Input VAT Pie Chart */}
        <Card className="stat-card card-hover-lift">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-amber-500" />
              {language === 'da' ? 'Indgående moms pr. sats' : 'Input VAT by Rate'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inputPieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inputPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {inputPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => tc(value)}
                      contentStyle={{
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                    <Legend 
                      formatter={(value) => <span className="text-xs">{value} {language === 'da' ? 'moms' : 'VAT'}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                {language === 'da' ? 'Ingen køb i perioden' : 'No purchases in period'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* VAT Breakdown Tables */}
      <Card className="stat-card card-hover-lift">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calculator className="h-5 w-5 text-[#0d9488]" />
            {language === 'da' ? 'Moms pr. sats' : 'VAT per Rate'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(outputVATBreakdown.length > 0 || inputVATBreakdown.length > 0) ? (
            <div className="space-y-4">
              {/* Output VAT Table */}
              {outputVATBreakdown.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-[#0d9488] dark:text-[#2dd4bf] mb-2 flex items-center gap-1">
                    <ArrowUpCircle className="h-4 w-4" />
                    {language === 'da' ? 'Udgående moms (salg)' : 'Output VAT (Sales)'}
                  </h4>
                  <Table className="table-fixed">
                    <TableHeader>
                        <TableRow className="border-b border-gray-200 dark:border-gray-700">
                          <TableHead className="py-2 w-[40%]">{t('vatRate')}</TableHead>
                          <TableHead className="text-right py-2 w-[30%]">{t('count')}</TableHead>
                          <TableHead className="text-right py-2 w-[30%]">{t('vatAmount')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outputVATBreakdown.map((item) => (
                          <TableRow key={`out-${item.rate}`} className="border-b border-gray-100 dark:border-gray-800 table-row-teal-hover">
                            <TableCell className="py-2 w-[40%]">
                              <Badge className="status-badge status-badge-sent">
                                {item.rate}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right py-2 w-[30%]">{item.count}</TableCell>
                            <TableCell className="text-right py-2 w-[30%] font-medium text-[#0d9488] dark:text-[#2dd4bf]">
                              {tc(item.totalVAT)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Input VAT Table */}
                {inputVATBreakdown.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                      <ArrowDownCircle className="h-4 w-4" />
                      {language === 'da' ? 'Indgående moms (køb)' : 'Input VAT (Purchases)'}
                    </h4>
                    <Table className="table-fixed">
                      <TableHeader>
                        <TableRow className="border-b border-gray-200 dark:border-gray-700">
                          <TableHead className="py-2 w-[40%]">{t('vatRate')}</TableHead>
                          <TableHead className="text-right py-2 w-[30%]">{t('count')}</TableHead>
                          <TableHead className="text-right py-2 w-[30%]">{t('vatAmount')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inputVATBreakdown.map((item) => (
                          <TableRow key={`in-${item.rate}`} className="border-b border-gray-100 dark:border-gray-800 table-row-teal-hover">
                            <TableCell className="py-2 w-[40%]">
                              <Badge className="status-badge status-badge-overdue">
                                {item.rate}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right py-2 w-[30%]">{item.count}</TableCell>
                            <TableCell className="text-right py-2 w-[30%] font-medium text-amber-600 dark:text-amber-400">
                              {tc(item.totalVAT)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Totals */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('outputVAT')}:</span>
                    <span className="font-medium text-[#0d9488] dark:text-[#2dd4bf]">{tc(totals.outputVAT)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('inputVAT')}:</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">-{tc(totals.inputVAT)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 font-bold">
                    <span className="text-gray-900 dark:text-white">
                      {totals.netPayable >= 0 ? t('toPay') : t('toRefund')}:
                    </span>
                    <span className={totals.netPayable >= 0 ? 'text-green-600 dark:text-green-400' : 'text-[#0d9488] dark:text-[#2dd4bf]'}>
                      {tc(Math.abs(totals.netPayable))}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                {t('noTransactionsPeriod')}
              </div>
            )}
          </CardContent>
        </Card>

      {/* Info Box */}
      <Card className="info-box-primary">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <p><strong>{t('danishVATInfo')}</strong></p>
              <p><strong>{language === 'da' ? 'Udgående moms' : 'Output VAT'}</strong>: {t('outputVATInfo')}</p>
              <p><strong>{language === 'da' ? 'Indgående moms' : 'Input VAT'}</strong>: {t('inputVATInfo')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
