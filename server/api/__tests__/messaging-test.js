/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ServiceError } from '../../common/errors';
import { computeSmsThreadId } from '../actions/communication/messaging';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('when handling a computeSmsThreadId request it should throw an error when "personIds" from body', () => {
  const expectRejection = personIds => expect(computeSmsThreadId({ body: { personIds } })).to.be.rejectedWith(ServiceError);

  it('is missing', () => expectRejection(undefined));

  it('is not an array', () => expectRejection('1'));

  it('is an empty array', () => expectRejection([]));

  it('is not an array of UUIDs', () => expectRejection(['1']));
});
