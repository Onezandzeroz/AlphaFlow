'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Loader2,
  ArrowDownCircle,
  Info,
  Calendar,
  Clock,
  Sparkles,
  History,
  Receipt,
  TrendingDown,
  FileText,
  BookOpen,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/lib/use-translation';
import { toast } from 'sonner';

type TransactionType = 'SALE' | 'PURCHASE';

const CURRENCIES = ['DKK', 'EUR', 'USD', 'GBP', 'SEK', 'NOK'] as const;

interface ExpenseAccount {
  id: string;
  number: string;
  name: string;
  nameEn: string | null;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatPercent: number;
}

interface RecentDescription {
  description: string;
  type: string;
}

interface AddTransactionFormProps {
  onSuccess: () => void;
}

// Format number with Danish locale for display
function formatDanishNumber(num: number): string {
  return num.toLocaleString('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultLastWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function AddTransactionForm({ onSuccess }: AddTransactionFormProps) {
  const { t, language } = useTranslation();
  const isDa = language === 'da';

  // ─── Shared state ───
  const [type, setType] = useState<TransactionType>('SALE');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── PURCHASE state ───
  const [date, setDate] = useState(defaultToday());
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('DKK');
  const [exchangeRate, setExchangeRate] = useState('');
  const [includesVAT, setIncludesVAT] = useState(false);
  const [description, setDescription] = useState('');
  const [vatPercent, setVatPercent] = useState('25');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  // ─── INVOICE state ───
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCvr, setCustomerCvr] = useState('');
  const [issueDate, setIssueDate] = useState(defaultToday());
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, vatPercent: 25 },
  ]);

  // ─── Shared data ───
  const [expenseAccounts, setExpenseAccounts] = useState<ExpenseAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [recentDescriptions, setRecentDescriptions] = useState<RecentDescription[]>([]);
  const [descriptionsLoading, setDescriptionsLoading] = useState(false);
  const [showDescriptionSuggestions, setShowDescriptionSuggestions] = useState(false);

  // Fetch expense accounts (6000-9500) on mount
  useEffect(() => {
    async function fetchExpenseAccounts() {
      setAccountsLoading(true);
      try {
        const res = await fetch('/api/accounts?type=EXPENSE');
        if (res.ok) {
          const data = await res.json();
          const filtered = (data.accounts || []).filter(
            (acc: ExpenseAccount) => {
              const num = parseInt(acc.number, 10);
              return num >= 6000 && num <= 9500;
            }
          );
          setExpenseAccounts(filtered);
        }
      } catch { /* silent */ } finally {
        setAccountsLoading(false);
      }
    }
    fetchExpenseAccounts();
  }, []);

  // Fetch recent descriptions on mount
  useEffect(() => {
    async function fetchDescriptions() {
      setDescriptionsLoading(true);
      try {
        const res = await fetch('/api/transactions/recent-descriptions');
        if (res.ok) {
          const data = await res.json();
          setRecentDescriptions(data.descriptions || []);
        }
      } catch { /* silent */ } finally {
        setDescriptionsLoading(false);
      }
    }
    fetchDescriptions();
  }, []);

  // ─── Purchase calculations ───
  const parsedAmount = parseFloat(amount || '0');
  const parsedVatPercent = parseFloat(vatPercent || '0');
  const netAmount = includesVAT ? parsedAmount / (1 + parsedVatPercent / 100) : parsedAmount;
  const vatAmount = netAmount * parsedVatPercent / 100;
  const totalAmount = netAmount + vatAmount;

  // ─── Invoice calculations ───
  const invoiceTotals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const vatTotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.vatPercent) / 100, 0);
    return { subtotal, vatTotal, total: subtotal + vatTotal };
  }, [lineItems]);

  // ─── Type switching ───
  const handleTypeChange = useCallback((newType: TransactionType) => {
    setType(newType);
    setError('');
  }, []);

  // ─── Invoice line item handlers ───
  const addLineItem = useCallback(() => {
    setLineItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0, vatPercent: 25 }]);
  }, []);

  const removeLineItem = useCallback((index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== index));
  }, [lineItems.length]);

  const updateLineItem = useCallback((index: number, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }, []);

  // ─── Receipt handling ───
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError(isDa ? 'Filstørrelsen skal være under 10MB' : 'File size must be less than 10MB');
      return;
    }
    setReceiptFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = (event) => setReceiptPreview(event.target?.result as string);
    reader.readAsDataURL(file);
  }, [isDa]);

  const clearReceipt = useCallback(() => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleUseDescription = useCallback((desc: string) => {
    setDescription(desc);
    setShowDescriptionSuggestions(false);
    descriptionInputRef.current?.focus();
  }, []);

  // ─── Submit INVOICE ───
  const handleInvoiceSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!customerName.trim()) {
        setError(isDa ? 'Kundenavn er påkrævet' : 'Customer name is required');
        setIsLoading(false);
        return;
      }

      const validItems = lineItems.filter(item => item.description.trim() && item.unitPrice > 0);
      if (validItems.length === 0) {
        setError(isDa ? 'Mindst én varelinje med beskrivelse og pris er påkrævet' : 'At least one line item with description and price is required');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerAddress: customerAddress.trim() || null,
          customerEmail: customerEmail.trim() || null,
          customerPhone: customerPhone.trim() || null,
          customerCvr: customerCvr.trim() || null,
          issueDate,
          dueDate,
          lineItems: validItems,
          notes: invoiceNotes.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || (isDa ? 'Kunne ikke oprette faktura' : 'Failed to create invoice'));
      }

      const data = await response.json();

      toast.success(t('invoiceCreated'), {
        description: data.invoice.invoiceNumber,
      });

      // Reset invoice form
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerCvr('');
      setIssueDate(defaultToday());
      setDueDate(defaultDueDate());
      setInvoiceNotes('');
      setLineItems([{ description: '', quantity: 1, unitPrice: 0, vatPercent: 25 }]);

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isDa ? 'Der opstod en fejl' : 'An error occurred'));
    } finally {
      setIsLoading(false);
    }
  }, [customerName, customerEmail, customerPhone, customerAddress, customerCvr, issueDate, dueDate, lineItems, invoiceNotes, onSuccess, isDa, t]);

  // ─── Submit PURCHASE ───
  const handlePurchaseSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let receiptImagePath: string | null = null;
      if (receiptFile) {
        const formData = new FormData();
        formData.append('file', receiptFile);
        const uploadResponse = await fetch('/api/transactions/upload', { method: 'POST', body: formData });
        if (!uploadResponse.ok) throw new Error(isDa ? 'Kunne ikke uploade kvittering' : 'Failed to upload receipt');
        const uploadData = await uploadResponse.json();
        receiptImagePath = uploadData.path;
      }

      const amountToStore = includesVAT ? netAmount : parsedAmount;
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PURCHASE',
          date,
          amount: amountToStore,
          currency: currency !== 'DKK' ? currency : undefined,
          exchangeRate: currency !== 'DKK' && exchangeRate ? parseFloat(exchangeRate) : undefined,
          description,
          vatPercent: parseFloat(vatPercent),
          receiptImage: receiptImagePath,
          accountId: selectedAccountId || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || (isDa ? 'Kunne ikke oprette postering' : 'Failed to create transaction'));
      }

      // Reset purchase form
      setDate(defaultToday());
      setAmount('');
      setCurrency('DKK');
      setExchangeRate('');
      setIncludesVAT(true);
      setDescription('');
      setVatPercent('25');
      setSelectedAccountId('');
      clearReceipt();

      toast.success(t('transactionAdded') || (isDa ? 'Postering tilføjet' : 'Transaction added'), {
        description: isDa ? 'Din postering er blevet registreret' : 'Your transaction has been recorded',
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isDa ? 'Der opstod en fejl' : 'An error occurred'));
    } finally {
      setIsLoading(false);
    }
  }, [date, amount, currency, exchangeRate, includesVAT, netAmount, parsedAmount, description, vatPercent, receiptFile, selectedAccountId, clearReceipt, onSuccess, isDa, t]);

  const selectedAccount = expenseAccounts.find((a) => a.id === selectedAccountId);

  // ─── RENDER ───
  return (
    <form onSubmit={type === 'SALE' ? handleInvoiceSubmit : handlePurchaseSubmit} className="space-y-5">
      {error && (
        <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TYPE SELECTOR: Opret faktura / Køb
          ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <Label className="dark:text-gray-300 text-sm font-medium">{t('transactionType')}</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleTypeChange('SALE')}
            className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer ${
              type === 'SALE'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                : 'hover:bg-emerald-500/5 hover:border-emerald-500/50 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
            }`}
          >
            <FileText className="h-6 w-6" />
            <span className="font-semibold text-sm">{t('createInvoice')}</span>
            {type === 'SALE' && (
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center bg-emerald-500 text-white">
                <span className="text-[10px] font-bold">✓</span>
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('PURCHASE')}
            className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer ${
              type === 'PURCHASE'
                ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30'
                : 'hover:bg-amber-500/5 hover:border-amber-500/50 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
            }`}
          >
            <ArrowDownCircle className="h-6 w-6" />
            <span className="font-semibold text-sm">{t('purchase')}</span>
            {type === 'PURCHASE' && (
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center bg-amber-500 text-white">
                <span className="text-[10px] font-bold">✓</span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          INVOICE FORM (type === 'SALE')
          ═══════════════════════════════════════════════════════════════ */}
      {type === 'SALE' && (
        <div className="space-y-5">
          {/* ── Customer Information ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <User className="h-4 w-4" />
              {t('customerInfo')}
            </div>
            <Input
              placeholder={t('customerName') + ' *'}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              disabled={isLoading}
              className="dark:bg-white/5"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder={t('customerEmail')}
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                type="email"
                disabled={isLoading}
                className="dark:bg-white/5"
              />
              <Input
                placeholder={t('customerPhone')}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                type="tel"
                disabled={isLoading}
                className="dark:bg-white/5"
              />
            </div>
            <Input
              placeholder={t('customerAddress')}
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              disabled={isLoading}
              className="dark:bg-white/5"
            />
            <Input
              placeholder={t('customerCvr')}
              value={customerCvr}
              onChange={(e) => setCustomerCvr(e.target.value)}
              disabled={isLoading}
              className="dark:bg-white/5"
            />
          </div>

          {/* ── Invoice Dates ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="dark:text-gray-300 text-xs font-medium">{t('invoiceDate')}</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
                disabled={isLoading}
                className="dark:bg-white/5"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="dark:text-gray-300 text-xs font-medium">{t('dueDate')}</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                disabled={isLoading}
                className="dark:bg-white/5"
              />
            </div>
          </div>

          {/* ── Quick date buttons for issue date ── */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIssueDate(defaultToday())}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                issueDate === defaultToday()
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-gray-200 dark:border-white/10 text-gray-500 hover:border-gray-300 dark:hover:border-white/20'
              }`}
            >
              <Calendar className="h-3 w-3" />
              {t('today')}
            </button>
            <button
              type="button"
              onClick={() => setDueDate(defaultDueDate())}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                dueDate === defaultDueDate()
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-gray-200 dark:border-white/10 text-gray-500 hover:border-gray-300 dark:hover:border-white/20'
              }`}
            >
              <Clock className="h-3 w-3" />
              {isDa ? '30 dage' : '30 days'}
            </button>
          </div>

          {/* ── Line Items ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <FileText className="h-4 w-4" />
                {t('lineItems')}
              </div>
              <button
                type="button"
                onClick={addLineItem}
                className="flex items-center gap-1 text-xs text-[#0d9488] dark:text-[#2dd4bf] hover:underline cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                {t('addItem')}
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lineItems.map((item, index) => (
                <div key={index} className="rounded-lg border border-gray-200 dark:border-white/10 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Input
                      placeholder={t('itemDescription') + ' *'}
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      disabled={isLoading}
                      className="dark:bg-white/5 text-sm flex-1"
                    />
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('quantity')}</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="1"
                        value={item.quantity || ''}
                        onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        disabled={isLoading}
                        className="dark:bg-white/5 text-sm h-9 tabular-nums"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('unitPrice')} (DKK)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={item.unitPrice || ''}
                        onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        disabled={isLoading}
                        className="dark:bg-white/5 text-sm h-9 tabular-nums"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Moms %</Label>
                      <Select
                        value={String(item.vatPercent)}
                        onValueChange={(val) => updateLineItem(index, 'vatPercent', parseFloat(val))}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="dark:bg-white/5 text-sm h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-[#1a1f1e]">
                          <SelectItem value="25">25%</SelectItem>
                          <SelectItem value="12">12%</SelectItem>
                          <SelectItem value="0">0%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {item.description && item.unitPrice > 0 && (
                    <div className="flex justify-end text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {formatDanishNumber(item.quantity * item.unitPrice)} DKK
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Invoice Totals ── */}
          {invoiceTotals.subtotal > 0 && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{t('subtotal')}</span>
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">{formatDanishNumber(invoiceTotals.subtotal)} DKK</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{t('vatTotalLabel')}</span>
                <span className="font-medium text-[#0d9488] dark:text-[#2dd4bf] tabular-nums">{formatDanishNumber(invoiceTotals.vatTotal)} DKK</span>
              </div>
              <div className="h-px bg-emerald-200 dark:bg-emerald-500/20" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{t('grandTotal')}</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{formatDanishNumber(invoiceTotals.total)} DKK</span>
              </div>
            </div>
          )}

          {/* ── Invoice Notes ── */}
          <div className="space-y-1.5">
            <Label className="dark:text-gray-300 text-xs font-medium">{t('invoiceNotes')}</Label>
            <Textarea
              placeholder={isDa ? 'Tak for din ordre...' : 'Thank you for your order...'}
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              rows={2}
              disabled={isLoading}
              className="dark:bg-white/5 text-sm"
            />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PURCHASE FORM (type === 'PURCHASE')
          ═══════════════════════════════════════════════════════════════ */}
      {type === 'PURCHASE' && (
        <div className="space-y-5">
          {/* Purchase hint */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <TrendingDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-300">{t('purchaseDescription')}</span>
          </div>

          {/* Expense Account Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <Label className="dark:text-gray-300 text-sm font-medium">{t('expenseAccount')}</Label>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">(6000–9500)</span>
            </div>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={isLoading || accountsLoading}>
              <SelectTrigger className="dark:bg-white/5">
                <SelectValue placeholder={accountsLoading
                  ? (isDa ? 'Indlæser konti...' : 'Loading accounts...')
                  : t('selectExpenseAccount')
                } />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1a1f1e] max-h-64">
                {expenseAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400 mr-2">{acc.number}</span>
                    {isDa ? acc.name : (acc.nameEn || acc.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccount && (
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Info className="h-3 w-3 shrink-0" />
                {isDa ? `Valgt: ${selectedAccount.number} ${selectedAccount.name}` : `Selected: ${selectedAccount.number} ${selectedAccount.nameEn || selectedAccount.name}`}
              </p>
            )}
          </div>

          {/* Receipt Upload */}
          <div className="space-y-2">
            <Label className="dark:text-gray-300 text-sm font-medium">{t('receipt')} ({isDa ? 'Valgfrit' : 'Optional'})</Label>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" disabled={isLoading} />
            {receiptPreview ? (
              <div className="relative">
                <img src={receiptPreview} alt="Receipt preview" className="w-full h-32 object-cover rounded-lg border" />
                <Button type="button" variant="destructive" size="sm" className="absolute top-2 right-2" onClick={clearReceipt}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full h-20 border-dashed border-2 hover:border-[#0d9488] hover:bg-[#0d9488]/5 transition-colors dark:border-white/20 dark:hover:border-[#0d9488]"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <Receipt className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{t('takePictureOfReceipt')}</span>
                </div>
              </Button>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="dark:text-gray-300 text-sm font-medium">{t('date')}</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDate(defaultToday())} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${date === defaultToday() ? 'bg-[#0d9488]/10 border-[#0d9488] text-[#0d9488] dark:text-[#2dd4bf]' : 'border-gray-200 dark:border-white/10 text-gray-600'}`}>
                <Calendar className="h-3 w-3" /> {t('today')}
              </button>
              <button type="button" onClick={() => setDate(defaultYesterday())} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${date === defaultYesterday() ? 'bg-[#0d9488]/10 border-[#0d9488] text-[#0d9488] dark:text-[#2dd4bf]' : 'border-gray-200 dark:border-white/10 text-gray-600'}`}>
                <Clock className="h-3 w-3" /> {t('yesterday')}
              </button>
            </div>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required disabled={isLoading} className="dark:bg-white/5" />
          </div>

          {/* Amount */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="dark:text-gray-300 text-sm font-medium">{t('amount')}</Label>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">{t('amountIncludesVAT')}</Label>
                <Switch checked={includesVAT} onCheckedChange={setIncludesVAT} disabled={isLoading} />
              </div>
            </div>
            <div className="relative">
              <Input type="number" step="0.01" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} required disabled={isLoading} className="h-14 text-2xl font-bold text-right pr-16 dark:bg-white/5 tabular-nums" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2"><span className="text-sm font-semibold text-gray-500 dark:text-gray-400">DKK</span></div>
            </div>
            {includesVAT && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><Info className="h-3 w-3" />{t('grossToNetInfo')}</p>
            )}
            {amount && parsedAmount > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-2.5 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{t('netAmountShort')}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{formatDanishNumber(netAmount)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-2.5 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{t('vatShort')}</p>
                  <p className="text-sm font-bold text-[#0d9488] dark:text-[#2dd4bf] tabular-nums">{formatDanishNumber(vatAmount)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-2.5 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{t('grossShort')}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{formatDanishNumber(totalAmount)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Currency */}
          <div className="space-y-2">
            <Label className="dark:text-gray-300 text-sm font-medium">{t('currency')}</Label>
            <Select value={currency} onValueChange={(val) => { setCurrency(val); if (val === 'DKK') setExchangeRate(''); }}>
              <SelectTrigger className="dark:bg-white/5"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1a1f1e]">{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {currency !== 'DKK' && (
            <div className="space-y-2">
              <Label className="dark:text-gray-300 text-sm font-medium">{t('exchangeRate')} ({currency} → DKK)</Label>
              <Input type="number" step="0.0001" min="0" placeholder="0.0000" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} disabled={isLoading} className="dark:bg-white/5" />
            </div>
          )}

          {/* VAT */}
          <div className="space-y-2">
            <Label className="dark:text-gray-300 text-sm font-medium">{isDa ? 'Moms procent' : 'VAT Percentage'}</Label>
            <Input type="number" step="0.1" min="0" max="100" value={vatPercent} onChange={(e) => setVatPercent(e.target.value)} disabled={isLoading} className="dark:bg-white/5" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="dark:text-gray-300 text-sm font-medium">{t('description')}</Label>
              {recentDescriptions.length > 0 && (
                <button type="button" onClick={() => setShowDescriptionSuggestions(!showDescriptionSuggestions)} className="flex items-center gap-1 text-xs text-[#0d9488] dark:text-[#2dd4bf] hover:underline cursor-pointer">
                  <History className="h-3 w-3" /> {t('recentDescriptions')}
                </button>
              )}
            </div>
            {showDescriptionSuggestions && recentDescriptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {recentDescriptions.map((item) => (
                  <button key={item.description} type="button" onClick={() => handleUseDescription(item.description)} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-[#0d9488]/10 hover:text-[#0d9488] transition-colors cursor-pointer max-w-[200px] truncate">
                    <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0">{isDa ? 'Køb' : 'Purchase'}</Badge>
                    <span className="truncate">{item.description}</span>
                  </button>
                ))}
              </div>
            )}
            <Textarea
              ref={descriptionInputRef}
              placeholder={isDa ? 'Hvad blev købt?' : 'What was purchased?'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              disabled={isLoading}
              rows={2}
              className="dark:bg-white/5"
            />
          </div>
        </div>
      )}

      {/* ─── Submit Button ─── */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" className="flex-1 btn-gradient text-white" disabled={isLoading}>
          {isLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('processing')}</>
          ) : type === 'SALE' ? (
            t('createInvoice')
          ) : (
            t('save')
          )}
        </Button>
      </div>
    </form>
  );
}
