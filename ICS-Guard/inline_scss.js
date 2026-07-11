const fs = require('fs');

const mappings = [
    { jsx: 'frontend/src/layouts/MainLayout.jsx', scss: 'frontend/src/layouts/MainLayout.scss' },
    { jsx: 'frontend/src/layouts/AuthLayout.jsx', scss: 'frontend/src/layouts/AuthLayout.scss' },
    { jsx: 'frontend/src/pages/AttackerConsole.jsx', scss: 'frontend/src/pages/AttackerConsole.scss' },
    { jsx: 'frontend/src/pages/Login.jsx', scss: 'frontend/src/pages/AuthForms.scss' }
];

mappings.forEach(({ jsx, scss }) => {
    if (!fs.existsSync(jsx) || !fs.existsSync(scss)) {
        console.log(`Skipping ${jsx} or ${scss} (not found)`);
        return;
    }

    let jsxContent = fs.readFileSync(jsx, 'utf-8');
    const scssContent = fs.readFileSync(scss, 'utf-8');

    const searchString2 = `style.innerHTML = \``;
    
    if (jsxContent.includes(searchString2)) {
        const parts = jsxContent.split(searchString2);
        const secondPartSplit = parts[1].split('`;');
        
        if (secondPartSplit.length >= 2) {
            const newJsxContent = parts[0] + searchString2 + '\n' + scssContent + '\n    `;' + secondPartSplit.slice(1).join('`;');
            fs.writeFileSync(jsx, newJsxContent);
            console.log(`Updated ${jsx} with raw SCSS content.`);
            fs.unlinkSync(scss);
            console.log(`Deleted ${scss}`);
        } else {
            console.log(`Could not find closing backticks in ${jsx}`);
        }
    } else {
        console.log(`Could not find style block markers in ${jsx}`);
    }
});

console.log("Done!");
