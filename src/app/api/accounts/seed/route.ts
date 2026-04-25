import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/session';
import { blockOversightMutation, requireNotDemoCompany } from '@/lib/rbac';
import { seedChartOfAccounts } from '@/lib/seed-chart-of-accounts';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const oversightBlocked = blockOversightMutation(ctx);
    if (oversightBlocked) return oversightBlocked;

    const demoBlocked = requireNotDemoCompany(ctx);
    if (demoBlocked) return demoBlocked;

    if (!ctx.activeCompanyId) {
      return NextResponse.json({ error: 'No active company' }, { status: 400 });
    }

    // Seed the standard Danish chart of accounts for the current demo mode
    const count = await seedChartOfAccounts(ctx.id, ctx.activeCompanyId, ctx.isDemoCompany);

    return NextResponse.json({ seeded: true, count });
  } catch (error) {
    logger.error('[Seed Chart of Accounts] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
