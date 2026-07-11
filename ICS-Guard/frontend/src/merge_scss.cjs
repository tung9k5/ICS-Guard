const fs = require('fs');
const path = require('path');

const srcDir = 'd:\\Deadline\\ICS-Guard\\ICS-Guard\\frontend\\src';

function processAudit() {
    const pageScss = path.join(srcDir, 'pages', 'AuditManagement', 'AuditManagement.scss');
    let content = fs.readFileSync(pageScss, 'utf8');
    
    // Fix td
    content = content.replace(/td\s*\{\s*color:\s*var\(--slate-900\);\s*\/\/[^\n]*\s*overflow-wrap:\s*break-word;\s*\}/g, 
    `td {
      color: var(--slate-900);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }`);

    const logScss = path.join(srcDir, 'sections', 'AuditManagement', 'AuditLogsList.scss');
    const blockScss = path.join(srcDir, 'sections', 'AuditManagement', 'BlockedIpsList.scss');
    
    if (fs.existsSync(logScss)) content += '\n' + fs.readFileSync(logScss, 'utf8');
    if (fs.existsSync(blockScss)) content += '\n' + fs.readFileSync(blockScss, 'utf8');
    
    fs.writeFileSync(pageScss, content);
    
    if (fs.existsSync(logScss)) fs.unlinkSync(logScss);
    if (fs.existsSync(blockScss)) fs.unlinkSync(blockScss);
}

function processAttack() {
    const pageScss = path.join(srcDir, 'pages', 'AttackSimulator', 'AttackSimulator.scss');
    let content = fs.readFileSync(pageScss, 'utf8');
    
    // Fix td
    content = content.replace(/td\s*\{\s*color:\s*var\(--slate-900\);[\s\S]*?max-width:\s*0;\s*\}/g, 
    `td {
      color: var(--slate-900);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }`);

    const devScss = path.join(srcDir, 'sections', 'AttackSimulator', 'AttackDevicesList.scss');
    const modScss = path.join(srcDir, 'sections', 'AttackSimulator', 'AttackModal.scss');
    
    if (fs.existsSync(devScss)) content += '\n' + fs.readFileSync(devScss, 'utf8');
    if (fs.existsSync(modScss)) content += '\n' + fs.readFileSync(modScss, 'utf8');
    
    fs.writeFileSync(pageScss, content);
    
    if (fs.existsSync(devScss)) fs.unlinkSync(devScss);
    if (fs.existsSync(modScss)) fs.unlinkSync(modScss);
}

processAudit();
processAttack();
console.log('Done merging SCSS');
