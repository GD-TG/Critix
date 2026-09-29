import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCheckedScenario } from '../src/scenarioApplication.ts';

test('scenario conflict or network failure leaves the draft intact', async () => {
  let draft = 'original';
  await assert.rejects(applyCheckedScenario(async () => { throw new Error('409'); }, () => true, value => { draft = value; }));
  assert.equal(draft, 'original');
});

test('late scenario response cannot replace a newer draft', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let current = true;
  let draft = 'original';
  const operation = applyCheckedScenario(() => pending, () => current, value => { draft = value; });
  draft = 'new edit'; current = false;
  release('old scenario');
  await operation;
  assert.equal(draft, 'new edit');
});

test('successful current scenario is accepted only after calculation', async () => {
  let draft = 'original';
  await applyCheckedScenario(async () => { assert.equal(draft, 'original'); return 'calculated'; }, () => true, value => { draft = value; });
  assert.equal(draft, 'calculated');
});
