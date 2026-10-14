import fs from 'node:fs';
import path from 'node:path';
import ts from '../frontend/node_modules/typescript/lib/typescript.js';
const root = path.resolve(import.meta.dirname, '../frontend');
const banned = /\b(wallet|tokens?|gas|transactions?|address|MON|crypto|blockchain|seed|chain)\b/i;
const failures: string[] = [];
function inspect(file: string) {
 const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 function check(text: string, node: ts.Node) { if (banned.test(text)) failures.push(`${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${text.trim()}`); }
 function visit(node: ts.Node) {
  if (ts.isJsxText(node)) check(node.text, node);
  if (ts.isJsxAttribute(node) && ['title', 'placeholder', 'aria-label', 'alt'].includes(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) check(node.initializer.text, node);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
   const parent = node.parent; const text = ts.isTemplateExpression(node) ? node.head.text + node.templateSpans.map(s => s.literal.text).join(' ') : node.text;
   // Exclude imports, technical protocol fields and identifiers; inspect prose literals and JSX expressions.
   if ((/[\s₹…]/.test(text) && !/^https?:|^application\/|^Bearer |^POST$|^GET$/.test(text) && !ts.isImportDeclaration(parent) && !ts.isRegularExpressionLiteral(node)) || ts.isJsxExpression(parent)) check(text, node);
  }
  ts.forEachChild(node, visit);
 }
 visit(source);
}
function walk(dir: string) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, item.name); if (item.isDirectory()) walk(file); else if (/\.[tj]sx?$/.test(item.name)) inspect(file); } }
walk(path.join(root, 'app')); walk(path.join(root, 'components'));
if (failures.length) { console.error('Consumer copy contains forbidden terms:\n' + failures.join('\n')); process.exit(1); }
console.log('Consumer copy check passed.');
