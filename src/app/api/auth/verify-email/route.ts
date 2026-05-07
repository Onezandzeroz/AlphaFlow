import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// POST /api/auth/verify-email — Verify email with token (public)
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Verification token is required' }, { status: 400 });
    }

    // Find user by token
    const user = await db.user.findUnique({
      where: { emailVerificationToken: token },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 400 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: 'Email is already verified' });
    }

    // Mark as verified and clear token
    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
      },
    });

    logger.info(`Email verified for user ${user.id} (${user.email})`);

    return NextResponse.json({ message: 'Email verified successfully' });
  } catch (error) {
    logger.error('Verify email error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
