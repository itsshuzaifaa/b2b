import fs from 'fs';
import path from 'path';

function findFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        results = results.concat(findFiles(fullPath));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.mjs')) {
      results.push(fullPath);
    }
  }
  return results;
}

const allFiles = findFiles('./src');
const serverActionFiles = [];

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes("'use server'") || content.includes('"use server"')) {
    serverActionFiles.push(file);
  }
}

console.log('Server Action files found:', serverActionFiles);

for (const file of serverActionFiles) {
  console.log('\n=========================================');
  console.log('FILE:', file);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  // Find exported async functions
  const exportedFunctions = [];
  const exportRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exportedFunctions.push(match[1]);
  }

  // Also check const exports
  const exportConstRegex = /export\s+const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(/g;
  while ((match = exportConstRegex.exec(content)) !== null) {
    exportedFunctions.push(match[1]);
  }

  console.log('Exported functions:', exportedFunctions);

  for (const fn of exportedFunctions) {
    // Check what guard is used inside the function
    const fnIndex = content.indexOf(`function ${fn}`) !== -1 
      ? content.indexOf(`function ${fn}`) 
      : content.indexOf(`${fn} =`);
    const fnBody = content.slice(fnIndex, fnIndex + 2500);

    let guard = 'UNGUARDED / UNKNOWN';
    if (fnBody.includes('requireAdmin')) {
      guard = 'requireAdmin() [Admin Only]';
    } else if (fnBody.includes('requireApprovedUser')) {
      guard = 'requireApprovedUser() [Approved Members + Admin bypass]';
    } else if (fnBody.includes('requireUser')) {
      guard = 'requireUser() [Any Authenticated User]';
    } else if (fnBody.includes('verifyCronOrAdmin')) {
      guard = 'verifyCronOrAdmin() [CRON_SECRET Bearer / Admin]';
    } else if (fnBody.includes('PUBLIC READ-ONLY') || fnBody.includes('Public')) {
      guard = 'PUBLIC READ (Public sanitized columns only)';
    }

    console.log(` - ${fn}: ${guard}`);
  }
}
