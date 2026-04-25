import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/session';
import { auditCreate, auditUpdate, auditCancel, auditDeleteAttempt, requestMetadata } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { TransactionType } from '@prisma/client';
import { requirePermission, tenantFilter, companyScope, Permission, blockOversightMutation, requireNotDemoCompany } from '@/lib/rbac';
import { ensureInitialBackup } from '@/lib/backup-scheduler';

// GET - Fetch all non-cancelled transactions for the logged-in user
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    
    const transactions = await db.transaction.findMany({
      where: { ...tenantFilter(ctx), cancelled: false },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    logger.error('Get transactions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new transaction
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const oversightBlocked = blockOversightMutation(ctx);
    if (oversightBlocked) return oversightBlocked;

    const demoBlocked = requireNotDemoCompany(ctx);
    if (demoBlocked) return demoBlocked;

    const body = await request.json();
    const { type, date, amount, description, vatPercent, receiptImage, accountId } = body;

    if (!date || !amount || !description) {
      return NextResponse.json(
        { error: 'Date, amount, and description are required' },
        { status: 400 }
      );
    }

    // Validate transaction type
    const validTypes = Object.values(TransactionType);
    const txType = type && validTypes.includes(type) ? type : 'SALE';

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      return NextResponse.json(
        { error: 'Amount must be a valid number' },
        { status: 400 }
      );
    }

    // Validate accountId if provided — must belong to the same company
    if (accountId) {
      const account = await db.account.findFirst({
        where: { id: accountId, companyId: ctx.activeCompanyId! },
      });
      if (!account) {
        return NextResponse.json(
          { error: 'Invalid account' },
          { status: 400 }
        );
      }
    }

    
    const transaction = await db.transaction.create({
      data: {
        type: txType,
        date: new Date(date),
        amount: parsedAmount,
        description,
        vatPercent: vatPercent ?? 25.0,
        receiptImage,
        accountId: accountId || null,
        userId: ctx.id,
        companyId: ctx.activeCompanyId!,
        isDemo: ctx.isDemoCompany,
      },
    });

    // Audit log
    await auditCreate(
      ctx.id,
      'Transaction',
      transaction.id,
      { type: txType, date, amount: parsedAmount, description, vatPercent, receiptImage, accountId },
      requestMetadata(request)
    );

    // Trigger initial backup on first tenant data input
    ensureInitialBackup(ctx.activeCompanyId!, ctx.id);

    return NextResponse.json({ transaction });
  } catch (error) {
    logger.error('Create transaction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update a transaction (e.g., attach receipt) — with audit trail
export async function PUT(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const oversightBlocked = blockOversightMutation(ctx);
    if (oversightBlocked) return oversightBlocked;

    const demoBlocked = requireNotDemoCompany(ctx);
    if (demoBlocked) return demoBlocked;

    const body = await request.json();
    const { id, receiptImage } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    
    const existing = await db.transaction.findFirst({
      where: { id, ...tenantFilter(ctx) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Update only allowed fields
    const updateData: Record<string, unknown> = {};
    if (receiptImage !== undefined) {
      updateData.receiptImage = receiptImage;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const transaction = await db.transaction.update({
      where: { id },
      data: updateData,
    });

    // Audit log with old/new values
    await auditUpdate(
      ctx.id,
      'Transaction',
      id,
      { receiptImage: existing.receiptImage },
      { receiptImage },
      requestMetadata(request)
    );

    return NextResponse.json({ transaction });
  } catch (error) {
    logger.error('Update transaction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Soft-delete (cancel) a transaction — NOT a hard delete
// Per bogføringsloven, transactions must be preserved (cancelled, not deleted)
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const oversightBlocked = blockOversightMutation(ctx);
    if (oversightBlocked) return oversightBlocked;

    const demoBlocked = requireNotDemoCompany(ctx);
    if (demoBlocked) return demoBlocked;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const reason = searchParams.get('reason') || 'User requested cancellation';

    if (!id) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    
    const transaction = await db.transaction.findFirst({
      where: { id, ...tenantFilter(ctx), cancelled: false },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found or already cancelled' },
        { status: 404 }
      );
    }

    // Soft-delete: mark as cancelled instead of deleting
    await db.transaction.update({
      where: { id },
      data: {
        cancelled: true,
        cancelReason: reason,
      },
    });

    // Audit log
    await auditCancel(
      ctx.id,
      'Transaction',
      id,
      reason,
      requestMetadata(request)
    );

    return NextResponse.json({ success: true, message: 'Transaction cancelled (soft-delete)' });
  } catch (error) {
    logger.error('Cancel transaction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
