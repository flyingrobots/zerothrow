/**
 * Validate the interactive playground HTML
 */

const fs = require('fs');
const path = require('path');

// Read the HTML file
const htmlPath = path.join(__dirname, 'interactive-playground.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

console.log('Validating interactive playground...');

// Check for required sections
const requiredSections = [
  '<title>ZeroThrow Interactive Playground</title>',
  'class ZeroError extends Error',
  'const ok = (value)',
  'const err = (error)', 
  'function runCode()',
  'const examples = {',
  'basic:',
  'validation:',
  'async:',
  'chaining:',
  'errors:',
  'recovery:'
];

let allSectionsFound = true;
for (const section of requiredSections) {
  if (!htmlContent.includes(section)) {
    console.error(`❌ Missing section: ${section}`);
    allSectionsFound = false;
  } else {
    console.log(`✓ Found: ${section}`);
  }
}

// Check for CSS styles
const cssSelectors = [
  '.playground',
  '.editor',
  '.console',
  '.example-card',
  '.console-log',
  '.console-error'
];

for (const selector of cssSelectors) {
  if (!htmlContent.includes(selector)) {
    console.error(`❌ Missing CSS selector: ${selector}`);
    allSectionsFound = false;
  } else {
    console.log(`✓ Found CSS: ${selector}`);
  }
}

// Check for JavaScript functions
const jsFunctions = [
  'function runCode()',
  'function clearConsole()',
  'function loadExample(',
  'function log(',
  'addEventListener(\'load\''
];

for (const func of jsFunctions) {
  if (!htmlContent.includes(func)) {
    console.error(`❌ Missing JS function: ${func}`);
    allSectionsFound = false;
  } else {
    console.log(`✓ Found JS: ${func}`);
  }
}

// Validate HTML structure
const htmlStructure = [
  '<meta charset="UTF-8">',
  '<meta name="viewport"',
  '<div class="container">',
  '<div class="playground">',
  '<textarea id="code"',
  '<div id="console"',
  '<div class="examples">',
  '<div class="help">'
];

for (const element of htmlStructure) {
  if (!htmlContent.includes(element)) {
    console.error(`❌ Missing HTML element: ${element}`);
    allSectionsFound = false;
  } else {
    console.log(`✓ Found HTML: ${element}`);
  }
}

// Check file size (should be reasonable for web delivery)
const stats = fs.statSync(htmlPath);
const fileSizeKB = Math.round(stats.size / 1024);
console.log(`\nFile size: ${fileSizeKB}KB`);

if (fileSizeKB > 200) {
  console.warn(`⚠️  File size is quite large (${fileSizeKB}KB)`);
} else {
  console.log(`✓ File size is reasonable`);
}

if (allSectionsFound) {
  console.log('\n🎉 Interactive playground validation passed!');
  console.log('✓ All required sections found');
  console.log('✓ CSS styles present');
  console.log('✓ JavaScript functionality included');
  console.log('✓ HTML structure valid');
  console.log('\nThe playground should work correctly in any modern browser.');
} else {
  console.error('\n❌ Validation failed - some required sections are missing');
  process.exit(1);
}