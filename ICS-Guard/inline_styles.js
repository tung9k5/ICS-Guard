const fs = require('fs');
const path = require('path');
const sass = require('sass');

const dirs = [
  path.join(__dirname, 'frontend/src/layouts'),
  path.join(__dirname, 'frontend/src/pages')
];

let processedCount = 0;

for (const dir of dirs) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.jsx')) {
      const jsxPath = path.join(dir, file);
      let content = fs.readFileSync(jsxPath, 'utf8');
      
      const scssRegex = /import\s+['"](?:\.\/)?([^'"]+\.scss)['"];?/g;
      let match;
      let hasChanges = false;
      
      while ((match = scssRegex.exec(content)) !== null) {
        const importStatement = match[0];
        const scssFilename = match[1];
        const scssPath = path.join(dir, scssFilename);
        
        if (fs.existsSync(scssPath)) {
          console.log(`Processing ${scssFilename} in ${file}...`);
          try {
            // Compile SCSS to CSS
            const result = sass.compile(scssPath, { style: 'compressed' });
            let css = result.css;
            
            // Escape backticks and ${}
            css = css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
            
            const componentId = file.replace('.jsx', '');
            const injectionCode = `
// Inject styles directly
if (typeof document !== 'undefined') {
  const styleId = 'style-${componentId}';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = \`${css}\`;
    document.head.appendChild(style);
  }
}
`;
            // Replace the import statement with the injection code
            content = content.replace(importStatement, injectionCode);
            hasChanges = true;
            
            // Delete the SCSS file
            fs.unlinkSync(scssPath);
            console.log(`Deleted ${scssFilename}`);
          } catch (e) {
            console.error(`Error processing ${scssFilename}: ${e.message}`);
          }
        }
      }
      
      if (hasChanges) {
        fs.writeFileSync(jsxPath, content, 'utf8');
        console.log(`Updated ${file}`);
        processedCount++;
      }
    }
  }
}

console.log(`Done. Updated ${processedCount} files.`);
