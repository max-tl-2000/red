/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import { testCtx as ctx, createAProperty, createAConcession } from '../../testUtils/repoHelper';
import { saveConcession } from '../concessionRepo';
import '../../testUtils/setupTestGlobalContext';

describe('dal/concessionRepo', () => {
  let property;
  let concession;

  beforeEach(async () => {
    property = await createAProperty({});
    concession = await createAConcession({
      id: getUUID(),
      name: '2 weeks free',
      propertyId: property.id,
    });
  });

  describe('When saving a concession that already exists', () => {
    it('should update the matching criterias', async () => {
      const matchingCriteria = {
        amenities: [`${getUUID()}`],
        minLeaseLength: 12,
      };

      expect(concession.matchingCriteria).to.eql(null);

      concession.matchingCriteria = matchingCriteria;
      const result = await saveConcession(ctx, concession);

      expect(JSON.parse(result.matchingCriteria)).to.eql(matchingCriteria);
    });
  });
});
