/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { mount } from 'enzyme';
import newId from 'uuid/v4';
import { ApplicationDetails } from '../application-details';
import { applicantDetailsModel } from '../../../models/applicant-details-model';
import { enhance } from '../../../../../common/helpers/contactInfoUtils';

describe('ApplicationDetails', () => {
  const partyMembers = [
    {
      personId: 1,
      contactInfo: enhance([
        { type: 'email', value: 'email@value.com', id: newId() },
        { type: 'email', value: 'email2@value.com', id: newId() },
      ]),
    },
  ];
  const personId = 1;
  const applicant = applicantDetailsModel.create({ apiClient: {} });
  const email = 'email@value.com';
  applicant.prefill({ partyMembers, personId });

  it('should render an application details page with email prefilled', () => {
    const tree = mount(<ApplicationDetails model={applicant} />);
    const emailItem = tree.find('input#email').nodes[0];
    expect(emailItem.value).toBe(email);
  });
});
