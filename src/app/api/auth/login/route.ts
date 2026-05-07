import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword, needsRehash } from '@/lib/password';
import { createSession, getAuthContext } from '@/lib/session';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { auditAuth, requestMetadata } from '@/lib/audit';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: max 5 login attempts per minute per IP
    const clientIp = getClientIp(request);
    const { allowed } = rateLimit(`login:${clientIp}`, {
      maxRequests: 5,
      windowMs: 60 * 1000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in 1 minute.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      logger.warn(`[AUTH] Failed login attempt for unknown email: ${email.toLowerCase().trim()}, IP: ${getClientIp(request)}`);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      // Resolve the user's first company for audit context
      const userCompanyForAudit = await db.userCompany.findFirst({
        where: { userId: user.id },
        select: { companyId: true },
      });
      await auditAuth(user.id, 'LOGIN_FAILED', { ...requestMetadata(request), reason: 'wrong_password' }, userCompanyForAudit?.companyId ?? null);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // If password uses old hash, re-hash it with bcrypt
    if (needsRehash(user.password)) {
      const newHash = await hashPassword(password);
      await db.user.update({
        where: { id: user.id },
        data: { password: newHash },
      });
    }

    // SuperDev (AlphaAi) is ALWAYS auto-verified — never requires email verification
    if (user.isSuperDev && !user.emailVerified) {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      });
    }

    // Block login for non-SuperDev users who haven't verified their email
    if (!user.isSuperDev && !user.emailVerified) {
      return NextResponse.json(
        { error: 'Please verify your email before logging in', needsVerification: true, email: user.email },
        { status: 403 }
      );
    }

    // Create secure session (auto-sets activeCompanyId from user's first company)
    const token = await createSession(user.id, request);

    // Set session cookie
    const cookieStore = await cookies();
    const isHttps = request.headers.get('x-forwarded-proto') === 'https';
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    // Audit successful login
    // Resolve activeCompanyId from the session just created
    const sessionForAudit = await db.session.findUnique({
      where: { token },
      select: { activeCompanyId: true },
    });
    await auditAuth(user.id, 'LOGIN', requestMetadata(request), sessionForAudit?.activeCompanyId ?? null);

    // Resolve the active company context for the response
    const session = await db.session.findUnique({
      where: { token },
      select: { activeCompanyId: true },
    });

    let activeCompanyId: string | null = session?.activeCompanyId ?? null;
    let activeCompanyRole: string | null = null;
    let activeCompanyName: string | null = null;
    let userCompany: { role: string | null; company: { name: string | null; isDemo: boolean | null } } | null = null;

    if (activeCompanyId) {
      userCompany = await db.userCompany.findUnique({
        where: {
          userId_companyId: {
            userId: user.id,
            companyId: activeCompanyId,
          },
        },
        select: { role: true, company: { select: { name: true, isDemo: true } } },
      });
      activeCompanyRole = userCompany?.role ?? null;
      activeCompanyName = userCompany?.company.name ?? null;
    }

    // Fetch user's companies for the selector
    const companies = await db.userCompany.findMany({
      where: { userId: user.id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            isDemo: true,
            isActive: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    // Check if any App Owner exists in the system
    const existingAppOwner = await db.user.findFirst({
      where: { isSuperDev: true },
      select: { id: true },
    });
    const hasAppOwner = existingAppOwner !== null;

    // Append "- App-owner" to company name when user is SuperDev and company is AlphaAi
    const displayCompanyName = (user.isSuperDev && activeCompanyName === 'AlphaAi')
      ? 'AlphaAi - App-owner'
      : activeCompanyName;

    // SuperDev is always reported as verified to the client
    const effectiveEmailVerified = user.isSuperDev ? true : (user.emailVerified ?? false);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: effectiveEmailVerified,
        businessName: user.businessName,
        demoModeEnabled: user.demoModeEnabled ?? false,
        isSuperDev: user.isSuperDev,
        hasAppOwner,
        activeCompanyId,
        activeCompanyRole,
        isDemoCompany: userCompany?.company.isDemo ?? false,
        activeCompanyName: displayCompanyName,
        companies: companies.map(c => ({
          id: c.company.id,
          name: c.company.name === 'AlphaAi' && user.isSuperDev
            ? 'AlphaAi - App-owner'
            : c.company.name,
          role: c.role,
          isDemo: c.company.isDemo,
          isActive: c.company.isActive,
        })),
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
