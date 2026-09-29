const $ = (selector) => document.querySelector(selector);
const views = [...document.querySelectorAll('.view')];
const role = $('#role');
let state = { mode: 'loading', employees: [], transactions: [], financials: null, testing: null, links: {} };
let selected = localStorage.getItem('friends-role') || 'svetlana';

const euro = (value) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
const employee = () => state.employees.find((item) => item.id === selected);
const isManager = () => employee()?.role === 'manager';
const notice = (text, bad = false) => { const node = $('#notice'); node.textContent = text; node.className = bad ? 'notice-bad' : 'notice-good'; };
const projectName = (project) => project === 'A' ? 'Respectable Relatives' : 'Drunk University Friends';
const link = (url, label) => url ? `<a class="access-link" href="${url}" target="_blank" rel="noreferrer">${label}</a>` : '<span class="access-pending">Not configured yet</span>';

async function load() {
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) throw new Error('Could not load records');
    state = await response.json();
    $('#mode').textContent = state.mode === 'live' ? 'Live records' : 'Demo preview';
    role.innerHTML = state.employees.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
    role.value = selected;
    render();
  } catch (error) { notice(error.message, true); }
}

function render() {
  renderDashboard();
  renderEntry();
  renderDecisions();
  renderRecords();
  renderSetup();
  renderTesting();
  $('#queue').textContent = state.transactions.filter((item) => item.status === 'pending' || item.status === 'awaiting_allocation').length;
}

function lines(items) { return `<ul class="metric-list">${items.map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`).join('')}</ul>`; }

function renderDashboard() {
  const f = state.financials, t = state.testing;
  if (!f) return;
  const missing = t?.missingReferences || [];
  $('#dashboard').innerHTML = `
    <div class="cards"><article class="card"><h3>Respectable Relatives</h3><div class="amount">${euro(f.projects.A.result)}</div><p class="sub">Project A result</p></article><article class="card"><h3>Drunk University Friends</h3><div class="amount">${euro(f.projects.B.result)}</div><p class="sub">Project B result</p></article><article class="card"><h3>Company result</h3><div class="amount">${euro(f.company.result)}</div><p class="sub">All approved sales less all expenses</p></article></div>
    <div class="summary"><article class="panel"><h2>Project A</h2>${lines([['Approved income', euro(f.projects.A.income)], ['Commission expense', euro(f.projects.A.commissions)], ['Allocated expenses', euro(f.projects.A.expenses)], ['Result', euro(f.projects.A.result)]])}</article><article class="panel"><h2>Project B</h2>${lines([['Approved income', euro(f.projects.B.income)], ['Commission expense', euro(f.projects.B.commissions)], ['Allocated expenses', euro(f.projects.B.expenses)], ['Result', euro(f.projects.B.result)]])}</article><article class="panel"><h2>Company view</h2>${lines([['Company overhead', euro(f.overhead)], ['Awaiting allocation', euro(f.awaiting)], ['Richard commission', euro(f.commissionByPerson[0])], ['Anastasia commission', euro(f.commissionByPerson[1])], ['Jean-Claude commission', euro(f.commissionByPerson[2])], ['Company result', euro(f.company.result)]])}</article></div>
    <section class="test-summary"><article class="panel"><p class="section-kicker">COURSEWORK FIXTURE</p><h2>Test 1 + Test 2 check</h2><p>${missing.length ? `${missing.length} required records still need loading: ${missing.join(', ')}.` : 'All required records are loaded, including S05 (pending) and E07 (awaiting allocation).'}</p>${lines([['Expected Project A result', euro(t?.expected?.projects.A.result)], ['Actual fixture Project A result', euro(t?.actual?.projects.A.result)], ['Expected Project B result', euro(t?.expected?.projects.B.result)], ['Actual fixture Project B result', euro(t?.actual?.projects.B.result)], ['Expected commissions', euro((t?.expected?.commissionByPerson || []).reduce((sum, value) => sum + value, 0))], ['Actual commissions', euro((t?.actual?.commissionByPerson || []).reduce((sum, value) => sum + value, 0))]])}</article><article class="panel"><p class="section-kicker">SEPARATE CONTROL</p><h2>Original control totals</h2><p>Reference-only figures. They are not loaded into the ledger and are not combined with the coursework fixture.</p>${lines([['Two approved practice sales', euro(t?.originalControlTotals.income)], ['10% commission', euro(t?.originalControlTotals.commissions)], ['Displayed company result', euro(t?.originalControlTotals.result)]])}</article></section>`;
}

function renderEntry() {
  let html = '<p class="empty">Choose a salesperson to enter a sale or Kevin to enter an expense.</p>';
  if (employee()?.role === 'salesperson') html = $('#sale-form').innerHTML;
  if (employee()?.role === 'expense_reporter') html = $('#expense-form').innerHTML;
  $('#entry').innerHTML = html;
  const form = $('#entry form');
  if (form) form.addEventListener('submit', submitTransaction);
}

async function submitTransaction(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget), type = event.currentTarget.dataset.type;
  const payload = type === 'sale'
    ? { customer: form.get('customer'), project: form.get('project').startsWith('A') ? 'A' : 'B', description: form.get('description'), amount: Number(form.get('amount')), proposedSplit: ['r', 'a', 'j'].map((name) => Number(form.get(name))) }
    : { description: form.get('description'), category: form.get('category'), amount: Number(form.get('amount')), proposedAllocation: form.get('allocation') };
  await post('/api/transactions', { reference: form.get('reference').trim(), type, submittedBy: selected, payload });
}

function decisionCard(transaction) {
  if (transaction.type === 'sale') {
    const split = transaction.payload.proposedSplit;
    return `<article class="panel decision"><div><h3>${transaction.reference} · ${projectName(transaction.payload.project)} · ${euro(transaction.payload.amount)}</h3><p>${transaction.payload.customer} — ${transaction.payload.description}</p><p>Proposed split: ${split.join(' / ')}%</p></div><div class="actions"><label>Richard<input value="${split[0]}" type="number" data-split="0"></label><label>Anastasia<input value="${split[1]}" type="number" data-split="1"></label><label>Jean-Claude<input value="${split[2]}" type="number" data-split="2"></label><button data-approve="${transaction.reference}">Approve sale</button></div></article>`;
  }
  return `<article class="panel decision"><div><h3>${transaction.reference} · ${euro(transaction.payload.amount)}</h3><p>${transaction.payload.description} — ${transaction.payload.category}</p><p>Proposed allocation: ${transaction.payload.proposedAllocation}</p></div><div class="actions"><label>Final allocation<select data-allocation><option ${transaction.payload.proposedAllocation === 'A' ? 'selected' : ''} value="A">Project A</option><option ${transaction.payload.proposedAllocation === 'B' ? 'selected' : ''} value="B">Project B</option><option ${transaction.payload.proposedAllocation === 'Company overhead' ? 'selected' : ''}>Company overhead</option></select></label><button data-approve="${transaction.reference}">Confirm allocation</button></div></article>`;
}

function renderDecisions() {
  if (!isManager()) { $('#decisions').innerHTML = '<p class="empty">Only Svetlana can make manager decisions.</p>'; return; }
  const queue = state.transactions.filter((item) => item.status === 'pending' || item.status === 'awaiting_allocation');
  $('#decisions').innerHTML = queue.length ? queue.map(decisionCard).join('') : '<p class="empty">No sales or allocations are waiting for a decision.</p>';
  document.querySelectorAll('[data-approve]').forEach((button) => button.addEventListener('click', async () => {
    const transaction = state.transactions.find((item) => item.reference === button.dataset.approve), panel = button.closest('.decision');
    if (transaction.type === 'sale') await post('/api/approve', { actorId: selected, reference: transaction.reference, approvedSplit: [...panel.querySelectorAll('[data-split]')].map((input) => Number(input.value)) });
    else await post('/api/approve', { actorId: selected, reference: transaction.reference, finalAllocation: panel.querySelector('[data-allocation]').value });
  }));
}

function renderRecords() {
  const visible = state.transactions.filter((transaction) => isManager() || transaction.submittedBy === selected);
  $('#records').innerHTML = `<div class="records">${visible.map((transaction) => {
    const detail = transaction.type === 'sale' ? `${transaction.payload.customer} · Project ${transaction.payload.project} · ${transaction.payload.description}` : `${transaction.payload.category} · proposed ${transaction.payload.proposedAllocation} · ${transaction.payload.description}`;
    const fixture = transaction.payload.courseworkFixture ? '<span class="fixture-tag">Coursework fixture</span>' : transaction.payload.practiceRecord ? '<span class="practice-tag">Practice record</span>' : '';
    const sheet = transaction.sheetSyncStatus === 'failed' ? `<button class="retry" data-retry="sheet" data-ref="${transaction.reference}">Retry Sheets</button>` : '';
    const notification = transaction.notificationStatus === 'failed' ? `<button class="retry" data-retry="notification" data-ref="${transaction.reference}">Retry notification</button>` : '';
    return `<article class="record"><strong class="ref">${transaction.reference}</strong><div><strong>${euro(transaction.payload.amount)}</strong> ${fixture}<p>${detail}</p><p>Submitted by ${state.employees.find((item) => item.id === transaction.submittedBy)?.name || transaction.submittedBy} · Sheets: ${transaction.sheetSyncStatus || 'pending'} · Notification: ${transaction.notificationStatus || 'not required'}</p>${sheet}${notification}</div><span class="status ${transaction.status}">${transaction.status.replace('_', ' ')}</span></article>`;
  }).join('') || '<p class="empty">No records for this role.</p>'}</div>`;
  document.querySelectorAll('[data-retry]').forEach((button) => button.addEventListener('click', () => post('/api/retry', { reference: button.dataset.ref, target: button.dataset.retry })));
}

function renderSetup() {
  if (!isManager()) { $('#setup').innerHTML = '<p class="empty">Only Svetlana can link a Telegram account or load coursework tests.</p>'; return; }
  const missing = state.testing?.missingReferences || [];
  $('#setup').innerHTML = `<div class="manager-grid"><article class="panel"><h2>Manager test controls</h2><p>Load the required Test 1 + Test 2 sales and expenses once. Existing references are never replaced or duplicated.</p><p class="setup-note">S05 stays pending and E07 stays awaiting allocation for the required final test. If an old practice record uses a required reference, it is safely moved to a labelled P-number and the original record is restored.</p><button id="load-tests">${missing.length ? `Load or repair ${missing.length} coursework records` : 'Check or repair coursework records'}</button></article><article class="panel"><h2>Fictional employee link</h2><p class="setup-note">Link a Telegram user and chat ID to one fictional employee. No token or credential is displayed here.</p><form class="form compact-form" id="link-form"><div class="form-grid"><label>Employee<select name="employeeId">${state.employees.filter((item) => item.id !== 'svetlana').map((item) => `<option value="${item.id}">${item.name}</option>`).join('')}</select></label><label>Telegram user ID<input name="telegramUserId" required></label><label>Telegram chat ID<input name="telegramChatId" required></label></div><button>Save link</button></form></article></div>`;
  $('#load-tests').addEventListener('click', () => post('/api/seed-tests', { actorId: selected }));
  $('#link-form').addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); post('/api/manager-setup', { actorId: selected, employeeId: form.get('employeeId'), telegramUserId: form.get('telegramUserId'), telegramChatId: form.get('telegramChatId') }); });
}

function renderTesting() {
  const links = state.links || {};
  $('#testing').innerHTML = `<div class="guide-grid"><article class="panel"><p class="section-kicker">REVIEWER ACCESS</p><h2>Working links</h2><p>${link(links.github, 'Open GitHub source')}</p><p>${link(links.googleSheet, 'Open Google Sheets ledger')}</p><p>${link(links.telegram, 'Open Telegram bot')}</p><p class="setup-note">The Sheets link must be shared as Viewer. The bot link is intentionally public, but bot tokens and service-account credentials remain server-only.</p></article><article class="panel"><p class="section-kicker">SHORT TEST PLAN</p><h2>How to check this submission</h2><ol class="guide-list"><li>Choose Svetlana, open <strong>Manager setup</strong>, and check or repair the coursework fixture. It keeps S05 pending and E07 awaiting allocation.</li><li>Use <strong>Records</strong> to confirm S01–S05 and E01–E07 are present. Coursework and labelled practice records are separate.</li><li>For manager testing, create a separate labelled reviewer sale or expense; do not approve S05 or allocate E07.</li><li>Use the Telegram link, send <code>/start</code>, link a fictional employee on this page, then submit <code>/sale S92855 | Reviewer Test | A | Sale from Telegram | 100 | 50 | 30 | 20</code>. The command works with or without spaces around <code>|</code>.</li></ol></article></div>`;
}

async function post(url, body) {
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'That action could not be completed.');
    notice(data.confirmation || 'Saved successfully.');
    await load();
  } catch (error) { notice(error.message, true); }
}

role.addEventListener('change', () => { selected = role.value; localStorage.setItem('friends-role', selected); render(); });
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === tab)); views.forEach((view) => view.classList.toggle('active', view.id === tab.dataset.view)); }));
$('#seed').addEventListener('click', () => document.querySelector('[data-view="testing"]').click());
load();
