import fs from 'fs';
import path from 'path';

function searchDir(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.next' && f !== '.git') searchDir(full);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.mjs')) {
      const code = fs.readFileSync(full, 'utf8');
      if (code.includes('contact_email')) {
        const lines = code.split('\n');
        lines.forEach((line, i) => {
          if (line.includes('contact_email') && (line.includes('.eq') || line.includes('.ilike') || line.includes('.or') || line.includes('where') || line.includes('select'))) {
            console.log(`${full}:${i + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

console.log('Searching src/ for contact_email database lookups...');
searchDir('src');
console.log('Done searching.');
