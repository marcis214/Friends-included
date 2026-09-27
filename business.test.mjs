import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSubmission, calculate, commissionAmounts, completedTests, employees, splitValid } from '../api/_lib.mjs';

test('completed test figures reconcile to the homework totals', () => {
  const actual = calculate(completedTests);
  assert.equal(actual.projects.A.result, 2050);
  assert.equal(actual.projects.B.result, 2180);
  assert.equal(actual.company.result, 3930);
  assert.deepEqual(actual.commissionByPerson, [140, 175, 215]);
  assert.equal(actual.awaiting, 140);
});

test('commission pool rounds to cents and awards a difference to the highest share', () => {
  const result = commissionAmounts(33.33, [34, 33, 33]);
  assert.equal(result.pool, 3.33);
  assert.equal(result.amounts.reduce((a, n) => a + n, 0), 3.33);
  assert.deepEqual(result.amounts, [1.13, 1.1, 1.1]);
});

test('submission permissions and split validation are enforced in business logic', () => {
  assert.equal(splitValid([60, 30, 20]), false);
  assert.throws(() => assertSubmission({ reference: 'S99', type: 'sale', payload: { customer: 'X', project: 'A', description: 'Y', amount: 1, proposedSplit: [50, 30, 20] } }, employees.find(e => e.id === 'kevin')), /Only salespeople/);
  assert.throws(() => assertSubmission({ reference: 'E99', type: 'expense', payload: { description: 'X', category: 'Other', amount: 0, proposedAllocation: 'A' } }, employees.find(e => e.id === 'kevin')), /greater than zero/);
});
