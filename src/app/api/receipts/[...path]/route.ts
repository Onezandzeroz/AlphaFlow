import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/session';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { requirePermission, tenantFilter, companyScope, Permission } from '@/lib/rbac';

// GET /api/receipts/[...path] - Serve receipt images with authentication
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Verify authentication
    const ctx = await getAuthContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = ctx.id;

    const resolvedParams = await params;
    const filePathFromUrl = resolvedParams.path.join('/');

    if (!filePathFromUrl) {
      return NextResponse.json({ error: 'No file path provided' }, { status: 400 });
    }

    // Build the absolute file path
    // The URL path will be like: receipts/{userId}/{filename}
    // The actual file is at: uploads/receipts/{userId}/{filename}
    const absolutePath = path.join(process.cwd(), 'uploads', filePathFromUrl);

    // Security: ensure the path is within the uploads directory (prevent directory traversal)
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const resolvedPath = path.resolve(absolutePath);
    if (!resolvedPath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 403 });
    }

    // Security: ensure the user can only access their own files
    const expectedPrefix = path.join(uploadsDir, 'receipts', userId);
    if (!resolvedPath.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check file exists
    if (!existsSync(absolutePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Read file
    const fileBuffer = await readFile(absolutePath);
    const fileStat = await stat(absolutePath);

    // Determine content type from file extension
    const ext = path.extname(absolutePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Return image with cache headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStat.size.toString(),
        'Cache-Control': 'private, max-age=86400',
        'ETag': `"${fileStat.size}-${fileStat.mtimeMs}"`,
      },
    });
  } catch (error) {
    logger.error('Serve receipt error:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
