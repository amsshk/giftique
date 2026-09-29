import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const dir = mkdtempSync(join(tmpdir(), 'giftique-finance-test-'));
const sources = {
  client: 'lib/proxc/client.ts', operations: 'lib/proxc/management-operations.ts',
  catalog: 'lib/management-catalog.ts', finance: 'lib/proxc/finance.ts', auth: 'lib/proxc/management-auth.ts',
  invoiceFiles: 'app/api/proxc-management/invoice-files/route.ts', business: 'app/api/proxc-management/business/route.ts', reports: 'app/api/proxc-management/reports/route.ts',
};
const replacements = { './client': 'client', './management-operations': 'operations', '../management-catalog': 'catalog', '@/lib/proxc/management-auth': 'auth', '@/lib/proxc/client': 'client', '@/lib/proxc/finance': 'finance', '@/lib/proxc/management-operations': 'operations' };
for (const [key, source] of Object.entries(sources)) {
 let code = ts.transpileModule(readFileSync(resolve(source), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
 code = code.replace(/from "([^"]+)"/g, (whole, module) => replacements[module] ? `from "./${replacements[module]}.mjs"` : ['next/server', '@supabase/supabase-js', 'zod'].includes(module) ? `from "${pathToFileURL(require.resolve(module))}"` : whole);
 writeFileSync(join(dir, key + '.mjs'), code);
}
const finance = await import(pathToFileURL(join(dir, 'finance.mjs')));
const business = await import(pathToFileURL(join(dir, 'business.mjs')));
const invoiceFiles = await import(pathToFileURL(join(dir, 'invoiceFiles.mjs')));
const reports = await import(pathToFileURL(join(dir, 'reports.mjs')));
after(() => rmSync(dir, { recursive: true, force: true }));
process.env.PROXC_URL = 'https://proxc.test'; process.env.PROXC_API_KEY = 'local'; process.env.PROXC_API_SECRET = 'local';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://auth.test'; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'local';
function mock(role = 'owner', responder = () => ({ message: {} })) {
 const calls = [];
 globalThis.fetch = async (url, init = {}) => {
  const target = new URL(url); const body = init.body ? JSON.parse(init.body) : null;
  if (target.hostname === 'auth.test') return Response.json({ id: 'verified-user-id', app_metadata: { role }, aud: 'authenticated', email: 'synthetic@example.invalid' });
  calls.push({ target, body, method: init.method }); return Response.json(await responder({ target, body }));
 };
 return calls;
}
const request = (path, body, signed = true) => new Request('http://localhost' + path, { method: body ? 'POST' : 'GET', headers: { ...(signed ? { Authorization: 'Bearer verified-by-provider' } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
test('invalid report names and impossible dates are rejected before ERPNext access', async () => {
 const calls = mock();
 for (const args of [['__proto__','2026-01-01','2026-09-26'],['profit_loss','2026-02-30','2026-09-26'],['profit_loss','2026-09-27','2026-09-26']]) await assert.rejects(finance.runAccountingReport(...args), { status: 400 });
 assert.equal(calls.length, 0);
});
test('reports force Giftique and disable saved filter substitution', async () => {
 const calls = mock('owner', () => ({ message: { columns: [{ fieldname: 'account', label: '<b>Account</b>', fieldtype: 'Data' }], result: [{ account: '<a href="/desk">Sales</a>' }], report_summary: [] } }));
 const result = await finance.runAccountingReport('profit_loss','2026-01-01','2026-09-26');
 assert.equal(calls[0].body.filters.company,'Giftique'); assert.equal(calls[0].body.are_default_filters,0); assert.equal(calls[0].body.ignore_prepared_report,1); assert.equal(result.rows[0].account,'Sales'); assert.equal(result.columns[0].label,'Account');
});
test('anonymous and staff users cannot read owner business data or reports', async () => {
 const calls = mock('staff');
 assert.equal((await business.GET(request('/?action=capabilities',undefined,false))).status,401);
 assert.equal((await business.GET(request('/?action=capabilities'))).status,403);
 assert.equal((await reports.GET(request('/?report=profit_loss&from=2026-01-01&to=2026-09-26'))).status,403);
 assert.equal(calls.length,0);
});
test('staff cannot mutate business data', async () => {
 const calls = mock('staff'); const response = await business.POST(request('/',{action:'upload_logo',content:'fake'})); assert.equal(response.status,403); assert.equal(calls.length,0);
});
test('owner mutations use verified identity and reject arbitrary methods or actor spoofing', async () => {
 const calls=mock();
 const body={action:'save_record',kind:'employees',data:{first_name:'Synthetic'},request_id:'e22dac36-2c40-4eb8-89e8-8bfb569419c7'};
 assert.equal((await business.POST(request('/',{...body,actor:'Administrator'}))).status,400);
 assert.equal((await business.POST(request('/',{action:'frappe.client.delete',name:'x'}))).status,400);
 assert.equal((await business.POST(request('/',body))).status,200);
 assert.equal(calls.length,1);assert.equal(calls[0].body.actor,'verified-user-id');assert.match(calls[0].target.pathname,/giftique_business.save_record$/);
});
test('reports route preserves expected response envelope',async()=>{
 mock('owner',()=>({message:{columns:[],result:[],report_summary:[]}}));
 const response=await reports.GET(request('/?report=profit_loss&from=2026-01-01&to=2026-09-26'));
 assert.equal(response.status,200); assert.equal((await response.json()).report.company,'Giftique');
});


test('invoice files require owner access before storage is reached', async () => {
 for (const role of ['staff','client']) {
  const calls=mock(role);
  assert.equal((await invoiceFiles.GET(request('/?action=list_files'))).status,403);
  assert.equal((await invoiceFiles.POST(request('/',{action:'upload',filename:'invoice.pdf',content:'JVBERi0='}))).status,403);
  assert.equal(calls.length,0);
 }
 assert.equal((await invoiceFiles.GET(request('/?action=download&name=private',undefined,false))).status,401);
});
test('invoice upload validates file types, size, and actor before calling PROXC', async () => {
 const calls=mock();
 for (const body of [
  {action:'upload',filename:'invoice.html',content:'abcd'},
  {action:'upload',filename:'invoice.pdf',content:'%%%invalid'},
  {action:'upload',filename:'invoice.pdf',content:'abcd',actor:'Administrator'},
  {action:'link',name:'FILE',kind:'employees',invoice:'OTHER',expected_modified:'today'},
 ]) assert.equal((await invoiceFiles.POST(request('/',body))).status,400);
 assert.equal((await invoiceFiles.POST(request('/',{action:'upload',filename:'invoice.pdf',content:'A'.repeat(6700001)}))).status,413);
 assert.equal(calls.length,0);
 assert.equal((await invoiceFiles.POST(request('/',{action:'upload',filename:'invoice.pdf',content:'JVBERi0='}))).status,200);
 assert.equal(calls[0].body.actor,'verified-user-id');
 assert.match(calls[0].target.pathname,/giftique_invoice_files.upload$/);
});
test('invoice download is private, forced attachment, and strips unsafe filename characters', async () => {
 mock('owner',()=>({message:{filename:'invoice"\r\n.pdf',content:Buffer.from('%PDF-synthetic').toString('base64')}}));
 const response=await invoiceFiles.GET(request('/?action=download&name=FILE'));
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal(response.headers.get('content-disposition'),'attachment; filename="invoice___.pdf"');
 assert.equal(await response.text(),'%PDF-synthetic');
});
test('invoice file errors never expose ERPNext tracebacks', async () => {
 mock('owner',()=>{throw new Error('PROXC API 403: '+JSON.stringify({exc_type:'PermissionError',exception:'private details'}));});
 const response=await invoiceFiles.GET(request('/?action=download&name=OTHER'));
 assert.equal(response.status,403);assert.doesNotMatch(await response.text(),/private details/);
});
