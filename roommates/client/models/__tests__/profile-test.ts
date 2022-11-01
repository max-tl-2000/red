/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import ProfileModel from '../profile';

describe('profile-test', () => {
  it('should allow setting a date in a ISO format YYYY-MM-DDTHH:mm:ss.SSSZ', async () => {
    const model = new ProfileModel();
    const f = model.create({ initialState: undefined });

    const field = f.fields.moveInDateFrom;

    field.setValue('2022-05-19T07:00:00.000Z');

    await field.validate();

    expect(field.valid).toEqual(true);

    const field2 = f.fields.moveInDateTo;

    field.setValue('2022-05-28T07:00:00.000Z');

    await field2.validate();

    expect(field2.valid).toEqual(true);
  });
});
