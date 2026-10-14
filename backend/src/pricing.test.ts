import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costWei } from './pricing.js';
test('rounds only once to paise and uses bigint',()=> { assert.equal(costWei(1,1),10n**16n); assert.equal(costWei(1000,1000),20n*10n**16n); assert.equal(costWei(0,0),0n); });
test('rejects missing or invalid usage',()=>assert.throws(()=>costWei(NaN,1)));
