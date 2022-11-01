/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from '../../../../common/test-helpers';
import { addAlias } from '../addAlias';

describe('addAlias', () => {
  it('should add the provided string as an alias to the email', () => {
    const result = addAlias('some@reva.tech', 'alias');
    expect(result).to.equal('some+alias@reva.tech');
  });

  it('should add the provided string as an alias to the email that already contains an alias', () => {
    const result = addAlias('qatest+sendinvite@reva.tech', 'alias');
    expect(result).to.equal('qatest+sendinvite_alias@reva.tech');
  });

  it('should add the alias to an identifier that is not an email', async () => {
    const result = addAlias('qatest+', 'alias');
    expect(result).to.equal('qatest+alias');
  });
});
