import fs from 'fs';
import path from 'path';

function findRouteFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findRouteFiles(fullPath));
    } else if (file === 'route.ts' || file === 'route.js') {
      results.push(fullPath);
    }
  }
  return results;
}

function stripComments(code) {
  // Remove single-line comments //...
  let stripped = code.replace(/\/\/[^\n\r]*/g, '');
  // Remove multi-line comments /* ... */
  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, '');
  return stripped;
}

const apiDir = path.resolve('src/app/api');
const routeFiles = findRouteFiles(apiDir);

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

const INTENTIONALLY_PUBLIC = new Set([
  'POST /api/contact',
  'POST /api/auth/register',
  'POST /api/auth/send-verification',
  'POST /api/auth/verify-code',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password',
  'GET /api/auth/check-username',
  'POST /api/auth/lookup-username',
  'GET /api/products',
  'GET /api/auth/me',
  'GET /api/billing/activate-tier',
  'POST /api/billing/activate-tier',
]);

const report = [];

for (const filePath of routeFiles) {
  const rawContent = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(path.resolve('.'), filePath).replace(/\\/g, '/');
  const apiRoute = '/' + path.relative(path.resolve('src/app'), path.dirname(filePath)).replace(/\\/g, '/');

  for (const method of METHODS) {
    // Check if method is exported
    // 1. export async function METHOD
    // 2. export function METHOD
    // 3. export const METHOD = ...
    const fnRegex = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b\\s*\\(([^)]*)\\)\\s*\\{`);
    const constRegex = new RegExp(`export\\s+const\\s+${method}\\b\\s*=\\s*([^;\\n]+)`);

    const fnMatch = rawContent.match(fnRegex);
    const constMatch = rawContent.match(constRegex);

    if (fnMatch) {
      const startIndex = fnMatch.index + fnMatch[0].length - 1;
      // Extract balanced braces for this specific function body
      let openBraces = 0;
      let bodyEnd = startIndex;
      let inString = null;

      for (let i = startIndex; i < rawContent.length; i++) {
        const char = rawContent[i];
        if (char === '{' && !inString) openBraces++;
        else if (char === '}' && !inString) {
          openBraces--;
          if (openBraces === 0) {
            bodyEnd = i + 1;
            break;
          }
        }
      }

      const rawBody = rawContent.slice(startIndex, bodyEnd);
      const cleanBody = stripComments(rawBody);

      // Check if function delegates to another function in the same file
      let fullCodeToCheck = cleanBody;
      const delegateMatch = cleanBody.match(/return\s+([a-zA-Z0-9_]+)\s*\(/);
      if (delegateMatch && delegateMatch[1]) {
        const fnName = delegateMatch[1];
        const localFnRegex = new RegExp(`(?:async\\s+)?function\\s+${fnName}\\b[\\s\\S]*?\\{`);
        const localFnMatch = rawContent.match(localFnRegex);
        if (localFnMatch) {
          fullCodeToCheck += '\n' + stripComments(rawContent.slice(localFnMatch.index));
        }
      }

      // Check if this route has multi-action dispatching (e.g. /api/inquiries POST)
      const actionMatches = [...fullCodeToCheck.matchAll(/if\s*\(\s*action\s*===\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g)];
      if (actionMatches.length > 0) {
        const topPreamble = fullCodeToCheck.slice(0, actionMatches[0].index);
        let parentGuard = 'none';
        if (topPreamble.includes('requireAdmin')) parentGuard = 'requireAdmin';
        else if (topPreamble.includes('requireApprovedUser')) parentGuard = 'requireApprovedUser';
        else if (topPreamble.includes('requireUser')) parentGuard = 'requireUser';
        else if (topPreamble.includes('verifyCronOrAdmin') || topPreamble.includes('CRON_SECRET')) parentGuard = 'cron secret';

        const routeKey = `${method} ${apiRoute}`;
        const parentIsIntentional = INTENTIONALLY_PUBLIC.has(routeKey);

        for (let idx = 0; idx < actionMatches.length; idx++) {
          const m = actionMatches[idx];
          const actName = m[1];
          const start = m.index;
          const nextStart = actionMatches[idx + 1] ? actionMatches[idx + 1].index : fullCodeToCheck.length;
          const actionSubBody = fullCodeToCheck.slice(start, nextStart);

          let actGuard = parentGuard;
          if (actionSubBody.includes('requireAdmin')) actGuard = 'requireAdmin';
          else if (actionSubBody.includes('requireApprovedUser')) actGuard = 'requireApprovedUser';
          else if (actionSubBody.includes('requireUser')) actGuard = 'requireUser';
          else if (actionSubBody.includes('verifyCronOrAdmin') || actionSubBody.includes('CRON_SECRET')) actGuard = 'cron secret';

          const isPublic = actGuard === 'none';
          const isIntentional = parentIsIntentional;
          const flagged = isPublic && !isIntentional;

          report.push({
            method: `${method} [action=${actName}]`,
            route: apiRoute,
            file: relativePath,
            guard: actGuard,
            rateLimited: fullCodeToCheck.includes('enforceRateLimit'),
            isPublic,
            isIntentional,
            flagged,
            actionName: actName,
          });
        }
        continue;
      }

      if (apiRoute === '/api/inquiries' && method === 'GET') {
        const isAdminBranch = fullCodeToCheck.includes("role === 'admin'") && fullCodeToCheck.includes('requireAdmin');
        const isDefaultBranch = fullCodeToCheck.includes('requireApprovedUser');
        report.push({
          method: `${method} [?role=admin]`,
          route: apiRoute,
          file: relativePath,
          guard: isAdminBranch ? 'requireAdmin' : 'none',
          rateLimited: false,
          isPublic: false,
          isIntentional: false,
          flagged: false,
        });
        report.push({
          method: `${method} [default]`,
          route: apiRoute,
          file: relativePath,
          guard: isDefaultBranch ? 'requireApprovedUser' : 'none',
          rateLimited: false,
          isPublic: false,
          isIntentional: false,
          flagged: false,
        });
        continue;
      }

      let guard = 'none';
      if (fullCodeToCheck.includes('requireAdmin')) {
        guard = 'requireAdmin';
      } else if (fullCodeToCheck.includes('requireApprovedUser')) {
        guard = 'requireApprovedUser';
      } else if (fullCodeToCheck.includes('requireUser')) {
        guard = 'requireUser';
      } else if (fullCodeToCheck.includes('verifyCronOrAdmin') || fullCodeToCheck.includes('CRON_SECRET')) {
        guard = 'cron secret';
      } else if (fullCodeToCheck.includes('FEATURE_DISABLED')) {
        guard = 'disabled (403)';
      }

      const hasRateLimit = fullCodeToCheck.includes('enforceRateLimit');
      const routeKey = `${method} ${apiRoute}`;
      const isPublic = guard === 'none';
      const isIntentional = INTENTIONALLY_PUBLIC.has(routeKey);
      const flagged = isPublic && !isIntentional;

      report.push({
        method,
        route: apiRoute,
        file: relativePath,
        guard,
        rateLimited: hasRateLimit,
        isPublic,
        isIntentional,
        flagged,
      });
    } else if (constMatch) {
      const aliasTarget = constMatch[1].trim();
      let guard = 'none';
      if (aliasTarget.includes('POST')) {
        guard = 'requireApprovedUser (delegates to POST)';
      }

      report.push({
        method,
        route: apiRoute,
        file: relativePath,
        guard,
        rateLimited: false,
        isPublic: false,
        isIntentional: false,
        flagged: false,
      });
    }
  }
}

console.log('========================================================================================================================');
console.log('                                 API ROUTE SECURITY AUDIT: HANDLER-BY-HANDLER SCAN                                      ');
console.log('========================================================================================================================\n');

let flaggedCount = 0;

for (const item of report) {
  let statusBadge = `[${item.guard.toUpperCase()}]`;
  if (item.flagged) {
    statusBadge = `[FLAGGED: UNGUARDED NON-PUBLIC]`;
    flaggedCount++;
  } else if (item.isPublic && item.isIntentional) {
    statusBadge = `[INTENTIONALLY PUBLIC]`;
  }

  const rateLimitBadge = item.rateLimited ? `(Rate Limited)` : '';
  console.log(`${item.method.padEnd(36)} ${item.route.padEnd(32)} ${statusBadge.padEnd(32)} ${rateLimitBadge}`);
  console.log(`        File: ${item.file}`);
}

console.log('\n========================================================================================================================');
console.log(`TOTAL HANDLERS / ACTIONS: ${report.length} | FLAGGED UNGUARDED: ${flaggedCount}`);
console.log('========================================================================================================================\n');

if (flaggedCount > 0) {
  console.log('FLAGGED ROUTES (Requiring review/guards):');
  report.filter(r => r.flagged).forEach(r => {
    console.log(` - ${r.method} ${r.route} (${r.file})`);
  });
} else {
  console.log('ALL ROUTE HANDLERS & ACTIONS ARE STRICTLY GUARDED OR INTENTIONALLY PUBLIC.');
}
