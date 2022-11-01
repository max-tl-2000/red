/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { testCtx as ctx, createAProperty } from '../../testUtils/repoHelper';
import { importLifestyles } from '../inventory/lifestyle';
import { getLifestylesByPropertyId } from '../../dal/amenityRepo';
import '../../testUtils/setupTestGlobalContext';

describe('lifestyle import', () => {
  it('should import the lifestyle if the data is valid', async () => {
    const property = await createAProperty();
    const firstLifestyle = {
      name: 'Rent Controled',
      property: property.name,
      displayName: 'lifestyleDN1',
      order: 1,
      description: 'Lifestyle description',
      infographic: 'am-affordable-housing',
    };

    const secondLifestyle = {
      name: 'Family friendly',
      property: property.name,
      displayName: 'lifestyleDN2',
      order: 2,
      description: 'Lifestyle description',
      infographic: '',
    };

    const lifestyleRows = [
      {
        data: firstLifestyle,
        index: 1,
      },
      {
        data: secondLifestyle,
        index: 2,
      },
    ];

    await importLifestyles(ctx, lifestyleRows);

    const lifestyles = await getLifestylesByPropertyId(ctx, property.id);
    expect(lifestyles.length).to.equal(2);
    const secondLs = lifestyles.find(l => l.name === secondLifestyle.name);
    expect(secondLs.order).to.equal(2);
    expect(secondLs.infographicName).to.equal('');
  });
});
