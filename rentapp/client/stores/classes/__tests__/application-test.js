/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Application } from '../application';

describe('applicantionStore', () => {
  const currentPersonId = '69350055-5256-4924-a25d-40d1b5b2407e';
  const INTERNAL_SERVER_ERROR = 'Internal Server error';

  const apiClientMock = (error = false) => {
    if (error) {
      return {
        post: jest.fn(() => {
          throw new Error(INTERNAL_SERVER_ERROR);
        }),
        on: jest.fn(),
      };
    }

    return {
      post: jest.fn(() => ({
        personId: currentPersonId,
        applicationData: {},
      })),
      on: jest.fn(),
    };
  };

  const socketClientMock = {
    on: jest.fn(),
  };

  const personApplicationData = {
    personId: currentPersonId,
    applicationData: {
      email: 'qatest+paul@reva.tech',
      lastName: 'Morgan',
      city: 'Lima',
      addressLine1: 'Av. simpre viva',
      addressLine2: '123',
      state: 'Peru',
      zip: 'Lima 41',
      firstName: 'Paul',
      guarantors: [],
      middleName: 'test',
      addressLine: '',
      dateOfBirth: '1987-10-12',
      grossIncome: '1000',
      socSecNumber: '122025',
      invitedToApply: '',
      otherApplicants: [],
      grossIncomeFrequency: 'YEARLY',
      haveInternationalAddress: false,
    },
  };

  it('should submit person application', async () => {
    const applicationStore = new Application({
      apiClient: apiClientMock(),
      socketClient: socketClientMock,
    });
    await applicationStore.submitPersonApplication({
      data: personApplicationData,
    });

    expect(applicationStore.personApplication.personId).toBe(currentPersonId);
  });

  it('should throw a 500 error when submit person application', async () => {
    const applicationStore = new Application({
      apiClient: apiClientMock(true),
      socketClient: socketClientMock,
    });
    await applicationStore.submitPersonApplication({
      data: personApplicationData,
    });

    expect(applicationStore.personApplicationError).toBe(INTERNAL_SERVER_ERROR);
  });
});
