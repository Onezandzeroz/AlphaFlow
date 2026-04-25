import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/session';
import { logger } from '@/lib/logger';
import { requirePermission, tenantFilter, companyScope, Permission } from '@/lib/rbac';

// VAT code rate mapping
const VAT_RATES: Record<string, number> = {
  S25: 25,
  S12: 12,
  S0: 0,
  SEU: 0,
  K25: 25,
  K12: 12,
  K0: 0,
  KEU: 0,
  KUF: 0,
  NONE: 0,
};

// Output VAT codes (salgsmoms)
const OUTPUT_CODES = ['S25', 'S12', 'S0', 'SEU'];
// Input VAT codes (købsmoms)
const INPUT_CODES = ['K25', 'K12', 'K0', 'KEU', 'KUF'];

interface VATCodeSummary {
  code: string;
  rate: number;
  debitTotal: number;
  creditTotal: number;
  netAmount: number;
}

// GET - VAT Register (Momsopgørelse)
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    if (!fromStr || !toStr) {
      return NextResponse.json(
        { error: 'Missing required query parameters: from and to (dates in YYYY-MM-DD format)' },
        { status: 400 }
      );
    }

    const fromDate = new Date(fromStr);
    const toDate = new Date(toStr);
    toDate.setHours(23, 59, 59, 999);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: 'from date must be before to date' },
        { status: 400 }
      );
    }

    
    // Fetch all POSTED, non-cancelled journal entries with lines and accounts
    const entries = await db.journalEntry.findMany({
      where: {
        ...tenantFilter(ctx),
        status: 'POSTED',
        cancelled: false,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Group lines by VAT code
    const vatCodeMap = new Map<string, { debitTotal: number; creditTotal: number }>();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const code = line.vatCode || 'NONE';
        const existing = vatCodeMap.get(code) || { debitTotal: 0, creditTotal: 0 };
        existing.debitTotal += line.debit || 0;
        existing.creditTotal += line.credit || 0;
        vatCodeMap.set(code, existing);
      }
    }

    // Helper to round to 2 decimals
    const r = (n: number) => Math.round(n * 100) / 100;

    // Build output VAT summary
    const outputVAT: VATCodeSummary[] = [];
    let totalOutputVAT = 0;

    for (const code of OUTPUT_CODES) {
      const data = vatCodeMap.get(code);
      if (data && (data.debitTotal > 0 || data.creditTotal > 0)) {
        const netAmount = r(data.creditTotal - data.debitTotal);
        totalOutputVAT += netAmount;
        outputVAT.push({
          code,
          rate: VAT_RATES[code],
          debitTotal: r(data.debitTotal),
          creditTotal: r(data.creditTotal),
          netAmount,
        });
      }
    }

    // Build input VAT summary
    const inputVAT: VATCodeSummary[] = [];
    let totalInputVAT = 0;

    for (const code of INPUT_CODES) {
      const data = vatCodeMap.get(code);
      if (data && (data.debitTotal > 0 || data.creditTotal > 0)) {
        // For input VAT, the natural balance is typically debit (VAT you can deduct)
        const netAmount = r(data.debitTotal - data.creditTotal);
        totalInputVAT += netAmount;
        inputVAT.push({
          code,
          rate: VAT_RATES[code],
          debitTotal: r(data.debitTotal),
          creditTotal: r(data.creditTotal),
          netAmount,
        });
      }
    }

    totalOutputVAT = r(totalOutputVAT);
    totalInputVAT = r(totalInputVAT);
    const netVATPayable = r(totalOutputVAT - totalInputVAT);

    return NextResponse.json({
      period: {
        from: fromStr,
        to: toStr,
      },
      outputVAT,
      inputVAT,
      totalOutputVAT,
      totalInputVAT,
      netVATPayable,
      entries,
    });
  } catch (error) {
    logger.error('VAT register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
