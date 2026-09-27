import { calculate, completedTests, getEmployees, getTransactions, configured, reply } from './_lib.mjs';
export default async function handler(req, res) {
  if (req.method !== 'GET') return reply(res, 405, { error: 'Method not allowed' });
  try { const transactions = await getTransactions(); return reply(res, 200, { mode: configured() ? 'live' : 'demo', employees: await getEmployees(), transactions, financials: calculate(transactions) }); }
  catch (error) { return reply(res, 500, { error: error.message }); }
}
