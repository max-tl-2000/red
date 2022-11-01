/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { tenant } from '../../../../server/testUtils/setupTestGlobalContext';
import { createAProperty, testCtx } from '../../../../server/testUtils/repoHelper';
import { getFadvCredentials, getFadvProperty } from '../base-fadv-helper';
import { updateTenant } from '../../../../server/services/tenantService';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('Fadv helper', () => {
  it('should generate a request with data from property', async () => {
    const property = await createAProperty({
      screening: {
        propertyName: 'fadvId',
      },
      lease: {
        propertyName: 'fadvId',
      },
    });

    const expectedResult = {
      identification: {
        propertyName: 'fadvId',
      },
      marketingName: property.name,
    };

    const result = await getFadvProperty(testCtx, property.id);
    expect(result).to.eql(expectedResult);
  });

  it('should throw an error if the property does not have the fadv propertyName setting', async () => {
    const property = await createAProperty({});
    const result = getFadvProperty(testCtx, property.id);
    return expect(result).to.be.rejectedWith(Error, 'ID_VALUE_FOR_PROPERTY_NOT_PRESENT');
  });

  it('should return the correct credentials for a given tenant', async () => {
    const credentials = {
      originatorId: '26694',
      marketingSource: '',
      userName: 'Reuser1',
      password: 'Winter2016',
    };

    const screeningSettings = {
      screening: {
        originatorId: credentials.originatorId,
        username: credentials.userName,
        password: credentials.password,
      },
    };

    await updateTenant(tenant.id, { settings: screeningSettings });

    const result = await getFadvCredentials(testCtx);

    expect(result).to.eql(credentials);
  });
});
