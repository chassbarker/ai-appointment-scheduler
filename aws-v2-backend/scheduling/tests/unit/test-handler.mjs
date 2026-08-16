import { expect } from 'chai';
import { lambdaHandler } from '../../app.mjs';

describe('Scheduling function', function () {
  it('returns an empty appointments list successfully', async function () {
    const result = await lambdaHandler();

    expect(result).to.be.an('object');
    expect(result.statusCode).to.equal(200);
    expect(result.headers).to.deep.equal({
      'Content-Type': 'application/json'
    });
    expect(result.body).to.be.a('string');

    const response = JSON.parse(result.body);

    expect(response).to.deep.equal({
      message: 'Appointments retrieved successfully',
      appointments: []
    });
  });
});
