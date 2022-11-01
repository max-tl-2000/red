/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import * as sinon from 'sinon';
import { DALTypes } from '../../../common/enums/DALTypes';

const { mock } = require('test-helpers/mocker').default(jest);

describe('services/communication', () => {
  const ctx = { tenantId: getUUID() };

  let communication;

  beforeEach(async () => {
    mock('../../dal/communicationRepo', () => ({
      getContactEventsByPartyAndFilter: sinon.stub().returns([{}]),
    }));

    communication = require('../communication'); // eslint-disable-line global-require
  });

  describe('When the party has a contact event created', () => {
    it('should not create a new contact event', async () => {
      const partyInfo = {
        metadata: { creationType: DALTypes.PartyCreationTypes.USER },
      };
      const result = await communication.addPartyContactEvent(ctx, partyInfo);
      expect(result).to.equal(undefined);
    });
  });

  describe('When the party creation type is different than user', () => {
    beforeEach(async () => {
      mock('../../dal/communicationRepo', () => ({
        getContactEventsByPartyAndFilter: sinon.stub().returns([]),
      }));

      communication = require('../communication'); // eslint-disable-line global-require
    });

    it('should not create a new contact event', async () => {
      const partyInfo = {
        metadata: { creationType: DALTypes.PartyCreationTypes.SYSTEM },
      };
      const result = await communication.addPartyContactEvent(ctx, partyInfo);
      expect(result).to.equal(undefined);
    });
  });
});
