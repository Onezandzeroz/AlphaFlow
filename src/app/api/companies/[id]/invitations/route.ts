import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/session';
import { requirePermission, Permission, blockOversightMutation, requireNotDemoCompany } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// GET /api/companies/[id]/invitations - List invitations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const forbidden = requirePermission(ctx, Permission.MEMBERS_VIEW);
    if (forbidden) return forbidden;

    const { id: companyId } = await params;

    const invitations = await db.invitation.findMany({
      where: { companyId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      invitations: invitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error) {
    logger.error('List invitations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/companies/[id]/invitations - Send invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const oversightBlocked = blockOversightMutation(ctx);
    if (oversightBlocked) return oversightBlocked;

    const demoBlocked = requireNotDemoCompany(ctx);
    if (demoBlocked) return demoBlocked;

    const forbidden = requirePermission(ctx, Permission.MEMBERS_INVITE);
    if (forbidden) return forbidden;

    const { id: companyId } = await params;
    const { email, role } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const inviteRole = role || 'VIEWER';

    if (!['ADMIN', 'ACCOUNTANT', 'VIEWER', 'AUDITOR'].includes(inviteRole)) {
      return NextResponse.json({ error: 'Invalid role. Can only invite as ADMIN, ACCOUNTANT, VIEWER, or AUDITOR.' }, { status: 400 });
    }

    // Check if user is already a member
    const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      const existingMember = await db.userCompany.findUnique({
        where: { userId_companyId: { userId: existingUser.id, companyId } },
      });
      if (existingMember) {
        return NextResponse.json({ error: 'User is already a member of this company' }, { status: 400 });
      }
    }

    // Check for existing pending invitation
    const existingInvite = await db.invitation.findFirst({
      where: { companyId, email: normalizedEmail, status: 'PENDING' },
    });
    if (existingInvite) {
      return NextResponse.json({ error: 'Invitation already sent to this email' }, { status: 400 });
    }

    // Create invitation
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const invitation = await db.invitation.create({
      data: {
        companyId,
        email: normalizedEmail,
        role: inviteRole as 'ADMIN' | 'ACCOUNTANT' | 'VIEWER' | 'AUDITOR',
        token,
        invitedBy: ctx.id,
        expiresAt,
      },
    });

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        token: invitation.token, // In production, send via email instead
      },
    }, { status: 201 });
  } catch (error) {
    logger.error('Create invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
