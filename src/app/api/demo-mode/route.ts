import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, SESSION_COOKIE_NAME } from '@/lib/session';
import { blockOversightMutation } from '@/lib/rbac';
import { seedDemoCompany } from '@/lib/seed-demo-company';
import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';

// ─── GET: Check demo mode status ──────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isDemoCompany = ctx.isDemoCompany;

    return NextResponse.json({
      demoModeEnabled: isDemoCompany,
      isDemoCompany,
      demoCompanyName: isDemoCompany ? ctx.activeCompanyName : null,
    });
  } catch (error) {
    logger.error('[Demo Mode GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── POST: Enter / Exit demo mode ─────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const oversightBlocked = blockOversightMutation(ctx);
    if (oversightBlocked) return oversightBlocked;

    const body = await request.json();
    const { action } = body as { action: 'enter' | 'exit' };

    if (action !== 'enter' && action !== 'exit') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "enter" or "exit".' },
        { status: 400 }
      );
    }

    // ── Get current session token for updating activeCompanyId ──
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (action === 'enter') {
      // ── Enter demo mode ──────────────────────────────────────

      // If already in the demo company, return success
      if (ctx.isDemoCompany) {
        return NextResponse.json({
          message: 'Demo mode enabled',
          demoModeEnabled: true,
          isDemoCompany: true,
          activeCompanyId: ctx.activeCompanyId,
          activeCompanyName: ctx.activeCompanyName,
        });
      }

      // Find the shared demo company
      let demoCompany = await db.company.findFirst({
        where: {
          isDemo: true,
          isActive: true,
          cvrNumber: '29876543',
        },
      });

      let demoCompanyId: string;

      if (!demoCompany) {
        // Inherit AppOwner widget defaults for the demo company
        const appOwnerCompany = await db.company.findUnique({
          where: { name: 'AlphaAi' },
          select: { dashboardWidgets: true },
        });
        const inheritedWidgets = appOwnerCompany?.dashboardWidgets ?? null;

        // Create the shared demo company
        demoCompany = await db.company.create({
          data: {
            name: 'Nordisk Erhverv ApS',
            address: 'Vesterbrogade 42, 3. sal',
            phone: '+45 33 12 34 56',
            email: 'info@nordiskerhverv.dk',
            cvrNumber: '29876543',
            companyType: 'ApS',
            invoicePrefix: 'NE',
            invoiceTerms: 'Netto 30 dage',
            nextInvoiceSequence: 21,
            currentYear: 2024,
            bankName: 'Nordea',
            bankAccount: '1234 567890',
            bankRegistration: '2190',
            bankIban: 'DK9520001234567890',
            bankStreet: 'Strøget 10',
            bankCity: 'København K',
            bankCountry: 'Danmark',
            isDemo: true,
            isActive: true,
            dashboardWidgets: inheritedWidgets,
          },
        });

        demoCompanyId = demoCompany.id;

        // We need a system user ID for seeding — use the current user
        const systemUserId = ctx.id;

        // Seed the demo company data
        await seedDemoCompany(demoCompanyId, systemUserId);

        logger.info('[Demo Mode] Created and seeded demo company:', demoCompanyId);
      } else {
        demoCompanyId = demoCompany.id;
      }

      // Ensure the user has a UserCompany membership for the demo company
      const existingMembership = await db.userCompany.findUnique({
        where: {
          userId_companyId: { userId: ctx.id, companyId: demoCompanyId },
        },
      });

      if (!existingMembership) {
        await db.userCompany.create({
          data: {
            userId: ctx.id,
            companyId: demoCompanyId,
            role: 'VIEWER', // Read-only role — writes are blocked by isDemoCompany guard
          },
        });
      }

      // Save the user's current (original) company ID in userPrefs
      const user = await db.user.findUnique({
        where: { id: ctx.id },
        select: { userPrefs: true },
      });

      const currentPrefs = user?.userPrefs
        ? JSON.parse(user.userPrefs)
        : {};

      // Only save the original company ID if we're not already in demo
      if (ctx.activeCompanyId && !currentPrefs.originalCompanyId) {
        currentPrefs.originalCompanyId = ctx.activeCompanyId;
        await db.user.update({
          where: { id: ctx.id },
          data: { userPrefs: JSON.stringify(currentPrefs) },
        });
      }

      // Update session's activeCompanyId to the demo company
      if (token) {
        await db.session.update({
          where: { token },
          data: { activeCompanyId: demoCompanyId },
        });
      }

      // Set demoModeEnabled on the User model
      await db.user.update({
        where: { id: ctx.id },
        data: { demoModeEnabled: true },
      });

      return NextResponse.json({
        message: 'Demo mode enabled',
        demoModeEnabled: true,
        isDemoCompany: true,
        activeCompanyId: demoCompanyId,
        activeCompanyName: demoCompany.name,
      });
    }

    // ── Exit demo mode ──────────────────────────────────────────

    // If not in the demo company, just clear the flag
    if (!ctx.isDemoCompany) {
      await db.user.update({
        where: { id: ctx.id },
        data: { demoModeEnabled: false },
      });

      return NextResponse.json({
        message: 'Demo mode exited',
        demoModeEnabled: false,
        isDemoCompany: false,
        activeCompanyId: ctx.activeCompanyId,
        activeCompanyName: ctx.activeCompanyName,
      });
    }

    // Read the user's original company ID from userPrefs
    const user = await db.user.findUnique({
      where: { id: ctx.id },
      select: { userPrefs: true },
    });

    const prefs = user?.userPrefs ? JSON.parse(user.userPrefs) : {};
    let originalCompanyId: string | null = prefs.originalCompanyId ?? null;

    // If no original company ID, find the user's first non-demo company
    if (!originalCompanyId) {
      const firstNonDemoCompany = await db.userCompany.findFirst({
        where: {
          userId: ctx.id,
          company: { isDemo: false, isActive: true },
        },
        orderBy: { joinedAt: 'asc' },
        select: { companyId: true },
      });
      originalCompanyId = firstNonDemoCompany?.companyId ?? null;
    }

    // Validate the original company still exists and is active
    if (originalCompanyId) {
      const originalCompany = await db.company.findUnique({
        where: { id: originalCompanyId },
        select: { id: true, name: true, isActive: true },
      });

      if (!originalCompany || !originalCompany.isActive) {
        // Original company is gone, find another non-demo company
        const fallback = await db.userCompany.findFirst({
          where: {
            userId: ctx.id,
            company: { isDemo: false, isActive: true },
          },
          orderBy: { joinedAt: 'asc' },
          select: { companyId: true },
        });
        originalCompanyId = fallback?.companyId ?? null;
      }
    }

    // Update session's activeCompanyId back to the original company
    if (token && originalCompanyId) {
      await db.session.update({
        where: { token },
        data: { activeCompanyId: originalCompanyId },
      });
    }

    // Set demoModeEnabled = false
    await db.user.update({
      where: { id: ctx.id },
      data: { demoModeEnabled: false },
    });

    // Clear the originalCompanyId from userPrefs
    if (prefs.originalCompanyId) {
      delete prefs.originalCompanyId;
      await db.user.update({
        where: { id: ctx.id },
        data: { userPrefs: JSON.stringify(prefs) },
      });
    }

    // Get the active company name for the response
    let activeCompanyName: string | null = null;
    if (originalCompanyId) {
      const company = await db.company.findUnique({
        where: { id: originalCompanyId },
        select: { name: true },
      });
      activeCompanyName = company?.name ?? null;
    }

    return NextResponse.json({
      message: 'Demo mode exited',
      demoModeEnabled: false,
      isDemoCompany: false,
      activeCompanyId: originalCompanyId,
      activeCompanyName,
    });
  } catch (error) {
    logger.error('[Demo Mode POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
