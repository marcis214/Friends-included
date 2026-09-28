import crypto from 'node:crypto';

export const employees = [
  { id: 'svetlana', name: 'Svetlana de Monte Carlo', role: 'manager' },
  { id: 'richard', name: 'Richard “Call Me Dick” Darling', role: 'salesperson' },
  { id: 'anastasia', name: 'Anastasia Ferrari', role: 'salesperson' },
  { id: 'jeanclaude', name: 'Jean-Claude Bērziņš', role: 'salesperson' },
  { id: 'kevin', name: 'Kevin von Whatever', role: 'expense_reporter' }
];

const e = (reference, type, submittedBy, payload, status, decision = null) => ({
  reference, type, submittedBy, payload, status, decision,
  submittedAt: '2026-09-27T09:00:00.000Z', source: 'website', sheetSyncStatus: 'synced', notificationStatus: 'sent'
});

export const completedTests = [
  e('S01', 'sale', 'richard', { customer: 'Olivia Rose', project: 'A', description: 'One proud uncle and an emotional grandmother', amount: 1000, proposedSplit: [50,30,20] }, 'approved', { approvedSplit: [50,30,20] }),
  e('S02', 'sale', 'anastasia', { customer: 'Daniel King', project: 'B', description: 'University friends, dancing, and the stripping performance', amount: 2000, proposedSplit: [0,50,50] }, 'approved', { approvedSplit: [20,40,40] }),
  e('S03', 'sale', 'jeanclaude', { customer: 'Emma Stonebridge', project: 'A', description: 'Premium relatives including an uncle presented as a surgeon', amount: 1500, proposedSplit: [40,40,20] }, 'approved', { approvedSplit: [20,30,50] }),
  e('S04', 'sale', 'richard', { customer: 'Lucas Green', project: 'B', description: 'Small group of loud university friends', amount: 800, proposedSplit: [25,25,50] }, 'approved', { approvedSplit: [25,25,50] }),
  e('S05', 'sale', 'richard', { customer: 'Mia Brooks', project: 'B', description: 'Extra guests and an embarrassing speech', amount: 600, proposedSplit: [100,0,0] }, 'pending'),
  e('E01', 'expense', 'kevin', { description: 'Rented suit and fake pearl necklace for the relatives', category: 'Materials', amount: 120, proposedAllocation: 'A' }, 'allocated', { finalAllocation: 'A' }),
  e('E02', 'expense', 'kevin', { description: 'Taxi for the grandmother', category: 'Travel', amount: 80, proposedAllocation: 'B' }, 'allocated', { finalAllocation: 'A' }),
  e('E03', 'expense', 'kevin', { description: 'Monthly company website subscription', category: 'Other', amount: 100, proposedAllocation: 'Company overhead' }, 'overhead', { finalAllocation: 'Company overhead' }),
  e('E04', 'expense', 'kevin', { description: 'Replacement costumes after an enthusiastic dance performance', category: 'Materials', amount: 250, proposedAllocation: 'B' }, 'allocated', { finalAllocation: 'B' }),
  e('E05', 'expense', 'kevin', { description: 'Minibus for university friends', category: 'Travel', amount: 90, proposedAllocation: 'A' }, 'allocated', { finalAllocation: 'B' }),
  e('E06', 'expense', 'kevin', { description: 'Company telephone subscription', category: 'Other', amount: 60, proposedAllocation: 'Company overhead' }, 'overhead', { finalAllocation: 'Company overhead' }),
  e('E07', 'expense', 'kevin', { description: 'Emergency replacement clothing', category: 'Materials', amount: 140, proposedAllocation: 'A' }, 'awaiting_allocation')
];

// These totals are a fixed reference check from the original control example.
// They are deliberately not inserted into the live ledger or combined with the
// coursework fixture data.
export const originalControlTotals = { income: 1500, commissions: 150, result: 1350 };
export const courseworkFixtureReferences = completedTests.map((transaction) => transaction.reference);

export const cents = (n) => Math.round(Number(n) * 100) / 100;
export const money = (n) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents(n));
export const splitValid = (split) => Array.isArray(split) && split.length === 3 && split.every((n) => Number.isFinite(Number(n)) && Number(n) >= 0 && Number(n) <= 100) && cents(split.reduce((a, n) => a + Number(n), 0)) === 100;

export function commissionAmounts(amount, split) {
  if (!splitValid(split)) throw new Error('Commission shares must be between 0% and 100% and total 100%.');
  const poolCents = Math.round(Number(amount) * 10);
  const values = split.map((share) => Math.round(poolCents * Number(share) / 100));
  let difference = poolCents - values.reduce((sum, n) => sum + n, 0);
  const largest = Math.max(...split.map(Number));
  const recipient = split.map(Number).findIndex((value) => value === largest);
  values[recipient] += difference;
  return { pool: poolCents / 100, amounts: values.map((n) => n / 100) };
}

export function assertSubmission(transaction, actor) {
  if (!transaction.reference?.match(/^[A-Za-z]\d{2,}$/)) throw new Error('Use a unique reference such as S01 or E01.');
  if (!Number.isFinite(Number(transaction.payload?.amount)) || Number(transaction.payload.amount) <= 0) throw new Error('Amount must be greater than zero.');
  if (transaction.type === 'sale') {
    if (actor.role !== 'salesperson') throw new Error('Only salespeople can submit sales.');
    if (!transaction.payload.customer || !['A','B'].includes(transaction.payload.project) || !transaction.payload.description) throw new Error('Customer, project, and description are required.');
    if (!splitValid(transaction.payload.proposedSplit)) throw new Error('Commission shares must total 100%.');
  } else {
    if (actor.role !== 'expense_reporter') throw new Error('Only Kevin can submit expenses.');
    if (!transaction.payload.description || !['Materials','Travel','Other'].includes(transaction.payload.category) || !['A','B','Company overhead'].includes(transaction.payload.proposedAllocation)) throw new Error('Description, category, and proposed allocation are required.');
  }
}

export function calculate(transactions) {
  const projects = { A: { income: 0, commissions: 0, expenses: 0 }, B: { income: 0, commissions: 0, expenses: 0 } };
  const commissionByPerson = [0, 0, 0];
  let overhead = 0, awaiting = 0, totalExpenses = 0;
  for (const tx of transactions) {
    const p = tx.payload;
    if (tx.type === 'sale' && tx.status === 'approved') {
      const c = commissionAmounts(p.amount, tx.decision.approvedSplit);
      projects[p.project].income += Number(p.amount);
      projects[p.project].commissions += c.pool;
      c.amounts.forEach((amount, i) => commissionByPerson[i] += amount);
    }
    if (tx.type === 'expense') {
      totalExpenses += Number(p.amount);
      const allocation = tx.decision?.finalAllocation;
      if (tx.status === 'allocated') projects[allocation].expenses += Number(p.amount);
      if (tx.status === 'overhead') overhead += Number(p.amount);
      if (tx.status === 'awaiting_allocation') awaiting += Number(p.amount);
    }
  }
  const projectResult = (project) => cents(projects[project].income - projects[project].commissions - projects[project].expenses);
  const income = cents(projects.A.income + projects.B.income);
  const commissions = cents(projects.A.commissions + projects.B.commissions);
  return { projects: { A: { ...projects.A, result: projectResult('A') }, B: { ...projects.B, result: projectResult('B') } }, overhead: cents(overhead), awaiting: cents(awaiting), commissionByPerson: commissionByPerson.map(cents), company: { income, commissions, expenses: cents(totalExpenses), result: cents(income - commissions - totalExpenses) } };
}

export const reply = (res, status, body) => res.status(status).json(body);
export async function parse(req) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
export function configured() { return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); }
export async function supabase(path, options = {}) {
  // Supabase's current sb_secret keys are API keys, not bearer JWTs. Sending
  // them only in the apikey header also keeps legacy service_role keys working.
  const apiKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: apiKey, 'Content-Type': 'application/json', Prefer: options.prefer || 'return=representation', ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Supabase: ${await response.text()}`);
  const text = await response.text(); return text ? JSON.parse(text) : null;
}
export async function getEmployees() { return configured() ? supabase('employees?select=*&order=id') : employees; }
export async function getTransactions() {
  if (!configured()) return completedTests;
  const rows = await supabase('transactions?select=*&order=submitted_at.asc');
  return rows.map((r) => ({ reference: r.reference, type: r.type, submittedBy: r.submitted_by, submittedAt: r.submitted_at, source: r.source, telegramChatId: r.telegram_chat_id, status: r.status, payload: r.payload, decision: r.decision, sheetSyncStatus: r.sheet_sync_status, sheetSyncError: r.sheet_sync_error, notificationStatus: r.notification_status, notificationError: r.notification_error }));
}
export async function insertTransaction(tx) {
  if (!configured()) throw new Error('Connect Supabase before adding persistent transactions.');
  const rows = await supabase('transactions', { method: 'POST', body: JSON.stringify({ reference: tx.reference, type: tx.type, submitted_by: tx.submittedBy, submitted_at: tx.submittedAt, source: tx.source, telegram_chat_id: tx.telegramChatId || null, status: tx.status, payload: tx.payload, decision: tx.decision || null, sheet_sync_status: 'pending', notification_status: 'not_required' }) });
  return rows[0];
}
export async function updateTransaction(reference, update) {
  const rows = await supabase(`transactions?reference=eq.${encodeURIComponent(reference)}`, { method: 'PATCH', body: JSON.stringify({ ...update, updated_at: new Date().toISOString() }) });
  return rows?.[0];
}
function googleCredentials() {
  const raw = String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').trim();
  let json;
  try { json = raw.startsWith('{') ? JSON.parse(raw) : null; } catch { json = null; }
  const privateKey = String(json?.private_key || raw)
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '\n');
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error('Google private key is incomplete. Paste either the complete private_key value or the complete service-account JSON file.');
  }
  return { email: String(json?.client_email || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim(), privateKey };
}
export async function googleToken() {
  const credentials = googleCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({ iss: credentials.email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })).toString('base64url');
  const signer = crypto.createSign('RSA-SHA256'); signer.update(`${header}.${claim}`);
  const signature = signer.sign(credentials.privateKey).toString('base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${signature}` }) });
  if (!response.ok) throw new Error(`Google auth: ${await response.text()}`); return (await response.json()).access_token;
}
export async function syncSheet(tx) {
  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) return { status: 'not_configured' };
  const token = await googleToken(), tab = tx.type === 'sale' ? 'Sales' : 'Expenses';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const row = tx.type === 'sale'
    ? [tx.reference, tx.submittedAt, tx.submittedBy, tx.payload.customer, tx.payload.project, tx.payload.description, tx.payload.amount, tx.payload.proposedSplit.join('/'), tx.decision?.approvedSplit?.join('/') || '', ...(tx.decision?.approvedSplit ? commissionAmounts(tx.payload.amount, tx.decision.approvedSplit).amounts : [0,0,0]), tx.status]
    : [tx.reference, tx.submittedAt, tx.submittedBy, tx.payload.description, tx.payload.category, tx.payload.amount, tx.payload.proposedAllocation, tx.decision?.finalAllocation || '', tx.status];
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(tab + '!A:A')}`;
  const existing = await fetch(base, { headers }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); });
  const index = (existing.values || []).findIndex((r) => r[0] === tx.reference);
  const range = index >= 0 ? `${tab}!A${index + 1}` : `${tab}!A:A`;
  const url = index >= 0 ? `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED` : `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, { method: index >= 0 ? 'PUT' : 'POST', headers, body: JSON.stringify({ values: [row] }) });
  if (!response.ok) throw new Error(`Sheets: ${await response.text()}`); return { status: 'synced' };
}
export async function notify(chatId, text) {
  if (!chatId) return { status: 'no_recipient' };
  if (!process.env.TELEGRAM_BOT_TOKEN) return { status: 'not_configured' };
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }) });
  if (!response.ok) throw new Error(`Telegram: ${await response.text()}`); return { status: 'sent' };
}
