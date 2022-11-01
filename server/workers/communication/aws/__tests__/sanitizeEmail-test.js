/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { sanitize } from '../sanitizeHTML';
import { emailSizeColor } from '../fixtures/email-size-color';

describe('sanitizeEmail', () => {
  it('should allow size and color attributes in emails', () => {
    const expected = sanitize(emailSizeColor);
    expect(expected).toMatchSnapshot();
  });
});
