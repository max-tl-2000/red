/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';

import { createAnAsset, createAUser } from '../../../testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import '../../../testUtils/setupTestGlobalContext';

describe('API/validateAssets', () => {
  const makeValidateRequest = async () => request(app).get('/validateAssets').set(getAuthHeader()).send();

  describe('when no assets were imported', () => {
    it('should return status 200 and isValid true', async () => {
      const result = await makeValidateRequest();
      expect(result.status).to.equal(200);
      expect(result.body.isValid).to.be.true;
    });
  });

  describe('when assets for missing entities were imported', () => {
    it('should return status 200 and validation errors should be reported', async () => {
      await createAnAsset({
        type: DALTypes.AssetType.AVATAR,
        externalUniqueId: 'missing-user',
      });
      await createAnAsset({
        type: DALTypes.AssetType.AMENITY,
        propertyName: 'cove',
        name: 'missing-amenity',
      });
      const result = await makeValidateRequest();
      expect(result.status).to.equal(200);
      expect(result.body.isValid).to.be.false;
    });
  });

  describe('when only assets for existing entities were imported', () => {
    it('should return status 200 and no validation errors', async () => {
      const user = await createAUser();
      await createAnAsset({
        type: DALTypes.AssetType.AVATAR,
        externalUniqueId: user.externalUniqueId,
      });

      const result = await makeValidateRequest();
      expect(result.status).to.equal(200);
      expect(result.body.isValid).to.be.true;
      expect(result.body.results.every(r => !r.validationErrors.length)).to.be.true;
    });
  });
});
