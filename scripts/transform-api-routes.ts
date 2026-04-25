/**
 * Transform script: Convert all API routes from single-tenant (getAuthUser + userId)
 * to multi-tenant (getAuthContext + tenantFilter + requirePermission).
 * 
 * Run: bun scripts/transform-api-routes.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const API_DIR = path.resolve(__dirname, '..', 'src', 'app', 'api');

// Files that should NOT be transformed (handled separately or special cases)
const SKIP_FILES = new Set([
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/register/route.ts',
  'src/app/api/auth/me/route.ts',
  'src/app/api/company/route.ts',  // Will be rewritten separately
]);

// Permission mapping for different route paths
function getPermissionsForFile(filePath: string): { read: string; write: string } {
  if (filePath.includes('bank-connections') || filePath.includes('bank-reconciliation')) {
    return { read: 'Permission.BANK_CONNECT', write: 'Permission.BANK_CONNECT' };
  }
  if (filePath.includes('backup')) {
    return { read: 'Permission.BACKUP_CREATE', write: 'Permission.BACKUP_RESTORE' };
  }
  if (filePath.includes('year-end')) {
    return { read: 'Permission.REPORTS_VIEW', write: 'Permission.YEAR_END_CLOSE' };
  }
  if (filePath.includes('export-saft')) {
    return { read: 'Permission.REPORTS_VIEW', write: 'Permission.REPORTS_SAFT' };
  }
  if (filePath.includes('fiscal-period')) {
    return { read: 'Permission.DATA_READ', write: 'Permission.PERIOD_CLOSE' };
  }
  if (filePath.includes('report') || filePath.includes('profit-loss') || filePath.includes('ledger') ||
      filePath.includes('cash-flow') || filePath.includes('aging') || filePath.includes('financial-health') ||
      filePath.includes('budget-vs-actual') || filePath.includes('vat-register')) {
    return { read: 'Permission.REPORTS_VIEW', write: 'Permission.REPORTS_EXPORT' };
  }
  if (filePath.includes('invoice')) {
    return { read: 'Permission.DATA_READ', write: 'Permission.DATA_CREATE' };
  }
  if (filePath.includes('ai-categorize')) {
    return { read: 'Permission.DATA_READ', write: 'Permission.DATA_EDIT' };
  }
  return { read: 'Permission.DATA_READ', write: 'Permission.DATA_CREATE' };
}

function findRouteFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(fullPath));
    } else if (entry.name === 'route.ts') {
      files.push(fullPath);
    }
  }
  return files;
}

function transformFile(filePath: string): boolean {
  const relPath = path.relative(path.resolve(__dirname, '..'), filePath);
  
  if (SKIP_FILES.has(relPath.replace(/\\/g, '/'))) {
    console.log(`  SKIP: ${relPath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  
  if (!content.includes('getAuthUser')) {
    console.log(`  SKIP (no getAuthUser): ${relPath}`);
    return false;
  }

  const perms = getPermissionsForFile(filePath);
  const isUserLevel = filePath.includes('user/preferences') || filePath.includes('auth/logout') || filePath.includes('auth/delete');

  // 1. Replace import of getAuthUser with getAuthContext
  content = content.replace(
    /import\s*\{\s*getAuthUser\s*\}\s*from\s*'@\/lib\/session'\s*;?/g,
    `import { getAuthContext } from '@/lib/session';`
  );

  // 2. Add RBAC imports if not already present
  if (!content.includes('@/lib/rbac')) {
    // Find the last import line and add after it
    const lastImportIndex = content.lastIndexOf("import ");
    const endOfLastImport = content.indexOf('\n', lastImportIndex);
    content = content.slice(0, endOfLastImport + 1) +
      `import { requirePermission, tenantFilter, companyScope, Permission } from '@/lib/rbac';\n` +
      content.slice(endOfLastImport + 1);
  }

  // 3. Replace getAuthUser calls with getAuthContext
  content = content.replace(
    /const user = await getAuthUser\((request)?\);/g,
    `const ctx = await getAuthContext($1);`
  );

  // 4. Replace user null checks
  content = content.replace(
    /if \(!user\) return NextResponse\.json\(\s*\{\s*error:\s*'Unauthorized'\s*\},\s*\{\s*status:\s*401\s*\}\s*\);?/g,
    `if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });`
  );
  // Also handle single-line version
  content = content.replace(
    /if \(!user\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);/g,
    `if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });`
  );

  // 5. Add permission check after auth check (for non-user-level routes)
  if (!isUserLevel && !content.includes('requirePermission')) {
    // Find the line after the null check and add permission check
    const authCheckPattern = /if \(!ctx\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);\n/;
    const match = content.match(authCheckPattern);
    if (match) {
      const insertPoint = content.indexOf(match[0]) + match[0].length;
      // Check what HTTP methods exist
      const hasGet = content.includes('export async function GET');
      const hasPost = content.includes('export async function POST');
      const hasPut = content.includes('export async function PUT');
      const hasDelete = content.includes('export async function DELETE');
      
      // We'll add a simple permission check after the auth check
      // Individual methods will need their own checks
    }
  }

  // 6. Replace userId: user.id with tenantFilter(ctx) for query where clauses
  // Pattern: where: { userId: user.id, ...otherFilters }
  content = content.replace(
    /userId:\s*user\.id/g,
    `...tenantFilter(ctx)`
  );

  // 7. Replace user.id references that remain (for audit logs, etc.)
  content = content.replace(
    /user\.id/g,
    `ctx.id`
  );
  content = content.replace(
    /user\.email/g,
    `ctx.email`
  );
  content = content.replace(
    /user\.businessName/g,
    `ctx.businessName`
  );

  // 8. Replace getDemoFilter patterns
  content = content.replace(
    /import\s*\{\s*getDemoFilter\s*\}\s*from\s*'@\/lib\/demo-filter'\s*;?\n?/g,
    ''
  );
  content = content.replace(
    /const\s+demoFilter\s*=\s*await\s+getDemoFilter\([^)]*\)\s*;?/g,
    '// demo filter now included in tenantFilter'
  );
  content = content.replace(
    /,\s*\.\.\.demoFilter/g,
    ''  // Remove spread of demoFilter (now included in tenantFilter)
  );

  // 9. Fix companyId for create operations - add companyId to data objects
  // Look for patterns like: db.xxx.create({ data: { ...userId: ctx.id } })
  // We need to add companyId: ctx.activeCompanyId! 
  // This is tricky to do with regex, so we'll add a helper comment

  // 10. For create mutations, replace userId: ctx.id (from step 8) with companyId
  // Actually, we need BOTH userId AND companyId in creates for now
  // Let's just make sure companyId is added
  
  // Find create data blocks and add companyId
  content = content.replace(
    /data:\s*\{\s*\n(\s*)userId:\s*ctx\.id,/g,
    `data: {\n$1userId: ctx.id,\n$1companyId: ctx.activeCompanyId!,`
  );

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  DONE: ${relPath}`);
  return true;
}

// Main
console.log('Transforming API routes to multi-tenant...\n');
const routeFiles = findRouteFiles(API_DIR);
console.log(`Found ${routeFiles.length} route files\n`);

let transformed = 0;
for (const file of routeFiles) {
  if (transformFile(file)) transformed++;
}

console.log(`\nTransformed ${transformed} of ${routeFiles.length} files`);
console.log('\nNOTE: Manual review needed for:');
console.log('  - Adding permission checks to each HTTP method');
console.log('  - Verifying companyId is set on all create operations');
console.log('  - Checking audit log calls use ctx.id correctly');
