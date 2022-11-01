/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import { updateProperty, getPropertyById, saveProperty, getPropertiesByQuotePricingSetting } from '../../dal/propertyRepo';
import { saveBusinessEntity } from '../../dal/businessEntityRepo';
import { testCtx as ctx, createAProperty, createAnAddress } from '../../testUtils/repoHelper';
import { DALTypes } from '../../../common/enums/DALTypes';
import '../../testUtils/setupTestGlobalContext';

describe('execute propertyRepo functions with setting column', () => {
  const data = {
    a: {
      b: 'bar',
      c: 'foo',
    },
  };
  it('saving a property', async () => {
    const address = await createAnAddress({});
    const businessEntity = await saveBusinessEntity(ctx, {
      name: `The Starks ${newId()}`,
      type: DALTypes.BusinessEntityType.OWNER,
      addressId: address.id,
    });
    const property = {
      name: `Winterfell ${newId()}`,
      propertyLegalName: `Brandon Stark ${newId()}`,
      displayName: `test${newId()}`,
      owner: businessEntity.id,
      addressId: address.id,
      settings: data,
    };
    const result = await saveProperty(ctx, property, true);
    expect(result.settings.a.b).to.equal('bar');
  });

  it('updated a property', async () => {
    const property = await createAProperty();
    expect(property.settings.screening.propertyName).to.equal('132660');
    const result = await updateProperty(ctx, { id: property.id }, { settings: data });
    expect(result[0].settings.a.c).to.equal('foo');
  });

  it('get a property', async () => {
    const property = await createAProperty();
    const result = await getPropertyById(ctx, property.id);
    expect(result.settings).to.deep.equal(property.settings);
    expect(property.settings.screening.propertyName).to.equal('132660');
  });

  it('get properties using quote pricing setting', async () => {
    const RMS_PRICING_SETTING = { integration: { import: { unitPricing: true } } };
    const REVA_PRICING_SETTING = { integration: { import: { unitPricing: false } } };

    await Promise.all([
      await createAProperty({}), // empty integration.pricing is reva
      await createAProperty(RMS_PRICING_SETTING),
      await createAProperty(REVA_PRICING_SETTING),
      await createAProperty(RMS_PRICING_SETTING),
      await createAProperty(REVA_PRICING_SETTING),
      await createAProperty(REVA_PRICING_SETTING),
    ]);

    // QuotePricingSetting.REVA default
    const revaPricingProperties = await getPropertiesByQuotePricingSetting(ctx);
    expect(revaPricingProperties).to.not.be.undefined;
    expect(revaPricingProperties.length).to.equal(4);

    const rmsPricingProperties = await getPropertiesByQuotePricingSetting(ctx, true);
    expect(rmsPricingProperties).to.not.be.undefined;
    expect(rmsPricingProperties.length).to.equal(2);

    const results = await getPropertiesByQuotePricingSetting(ctx, false);
    expect(results).to.not.be.undefined;
    expect(results.length).to.equal(4);
  });
});
