import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/session';
import { logger } from '@/lib/logger';
import { requirePermission, tenantFilter, companyScope, Permission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    // Determine date range
    let fromDate: Date;
    let toDate: Date;

    if (month) {
      fromDate = new Date(`${month}-01`);
      toDate = new Date(fromDate);
      toDate.setMonth(toDate.getMonth() + 1);
      toDate.setDate(0);
      toDate.setHours(23, 59, 59, 999);
    } else {
      // Default to current month
      const now = new Date();
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Fetch transactions for the line-level CSV data
    const [transactions, invoices] = await Promise.all([
      db.transaction.findMany({
        where: {
          ...tenantFilter(ctx),
          date: { gte: fromDate, lte: toDate },
          cancelled: false,
        },
        orderBy: { date: 'asc' },
      }),
      db.invoice.findMany({
        where: { ...tenantFilter(ctx), status: { not: 'CANCELLED' }, cancelled: false },
        orderBy: { issueDate: 'asc' },
      }),
    ]);

    const invoiceIdsWithTransactions = new Set(
      transactions.filter((t) => t.invoiceId).map((t) => t.invoiceId)
    );

    interface Entry {
      date: Date;
      type: string;
      amount: number;
      description: string;
      vatPercent: number;
      source: string;
    }

    const allEntries: Entry[] = [];

    for (const tx of transactions) {
      allEntries.push({
        date: tx.date, type: tx.type, amount: tx.amount,
        description: tx.description, vatPercent: tx.vatPercent, source: 'transaction',
      });
    }

    for (const invoice of invoices) {
      if (invoice.status === 'CANCELLED') continue;
      if (invoiceIdsWithTransactions.has(invoice.id)) continue;

      if (invoice.issueDate < fromDate || invoice.issueDate > toDate) continue;

      try {
        const lineItems = JSON.parse(invoice.lineItems) as Array<{
          description: string; quantity: number; unitPrice: number; vatPercent: number;
        }>;

        for (const item of lineItems) {
          if (!item.description?.trim() || item.unitPrice <= 0) continue;
          const lineTotal = item.quantity * item.unitPrice;
          allEntries.push({
            date: invoice.issueDate, type: 'SALE', amount: lineTotal,
            description: `${invoice.invoiceNumber} - ${item.description}`,
            vatPercent: item.vatPercent, source: 'invoice',
          });
        }
      } catch {
        logger.warn(`Could not parse lineItems for invoice ${invoice.id}`);
      }
    }

    allEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Per-line VAT display: for individual line items, amount * vatPercent / 100
    // is correct (amount is the NET amount for that line).
    const vatAmount = (amount: number, vatPercent: number) => (amount * vatPercent) / 100;

    // Fetch VAT register data for authoritative summary totals
    // (single source of truth — double-entry journal)
    let registerOutputVAT = 0;
    let registerInputVAT = 0;

    try {
      const vatEntries = await db.journalEntry.findMany({
        where: {
          ...tenantFilter(ctx),
          status: 'POSTED',
          cancelled: false,
          date: { gte: fromDate, lte: toDate },
        },
        include: { lines: true },
      });

      const OUTPUT_CODES = ['S25', 'S12', 'S0', 'SEU'];
      const INPUT_CODES = ['K25', 'K12', 'K0', 'KEU', 'KUF'];

      for (const entry of vatEntries) {
        for (const line of entry.lines) {
          const code = line.vatCode || 'NONE';
          if (OUTPUT_CODES.includes(code)) {
            registerOutputVAT += (line.credit || 0) - (line.debit || 0);
          } else if (INPUT_CODES.includes(code)) {
            registerInputVAT += (line.debit || 0) - (line.credit || 0);
          }
        }
      }

      registerOutputVAT = Math.round(registerOutputVAT * 100) / 100;
      registerInputVAT = Math.round(registerInputVAT * 100) / 100;
    } catch {
      // If VAT register fetch fails, fall back to 0
    }

    const headers = ['Date', 'Type', 'Description', 'Net Amount (DKK)', 'VAT %', 'VAT Amount (DKK)', 'Gross Amount (DKK)', 'Source'];

    const rows = allEntries.map((e) => [
      e.date.toISOString().split('T')[0],
      e.type === 'PURCHASE' ? 'Purchase' : 'Sale',
      `"${e.description.replace(/"/g, '""')}"`,
      e.amount.toFixed(2), e.vatPercent.toFixed(1),
      vatAmount(e.amount, e.vatPercent).toFixed(2),
      (e.amount + vatAmount(e.amount, e.vatPercent)).toFixed(2),
      e.source,
    ]);

    const totalNet = allEntries.reduce((sum, e) => sum + e.amount, 0);
    const registerNetVAT = Math.round((registerOutputVAT - registerInputVAT) * 100) / 100;

    rows.push([]);
    rows.push(['', 'TOTALS', '', '', '', '', '', '']);
    rows.push(['', 'Total Net Amount', totalNet.toFixed(2), '', '', '', '', '']);
    rows.push(['', 'Output VAT (Sales)', registerOutputVAT.toFixed(2), '', '', '', '', '(from journal entries)']);
    rows.push(['', 'Input VAT (Purchases)', registerInputVAT.toFixed(2), '', '', '', '', '(from journal entries)']);
    rows.push(['', 'Net VAT (to pay/refund)', registerNetVAT.toFixed(2), '', '', '', '', '']);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const bom = '\uFEFF';

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="transactions-${month || 'all'}.csv"`,
      },
    });
  } catch (error) {
    logger.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export transactions' }, { status: 500 });
  }
}
