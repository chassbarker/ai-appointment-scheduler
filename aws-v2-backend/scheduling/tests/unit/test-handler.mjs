import test from 'node:test';
import assert from 'node:assert/strict';
import { lambdaHandler } from '../../app.mjs';

test('returns an empty appointments list successfully', async () => {
  const result = await lambdaHandler();

  assert.equal(typeof result, 'object');
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.headers, {
    'Content-Type': 'application/json'
  });
  assert.equal(typeof result.body, 'string');

  const response = JSON.parse(result.body);

  assert.deepEqual(response, {
    message: 'Appointments retrieved successfully',
    appointments: []
  });
});
