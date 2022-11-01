/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { applicantDetailsModel } from '../applicant-details-model';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { enhance } from '../../../../common/helpers/contactInfoUtils';

describe('applicantDetailsModel', () => {
  const currentPersonId = '69350055-5256-4924-a25d-40d1b5b2407e';
  const partyMembers = [
    {
      id: '9dea3508-8ddf-4dff-8f26-9363e169df1a',
      memberType: DALTypes.MemberType.GUARANTOR,
      personId: 'afd41ccc-937a-44ca-9e76-69affc937236',
      guaranteedBy: null,
      fullName: 'Ron Weasley',
      preferredName: 'Ron',
      contactInfo: {
        phones: [],
        emails: [{ value: 'ron@wesley.com' }],
      },
    },
    {
      id: '83486fd5-98c4-4416-95a8-ced847610b4d',
      partyId: '2d90dbb9-6369-463f-adcb-cba8f209e437',
      memberType: DALTypes.MemberType.RESIDENT,
      personId: currentPersonId,
      guaranteedBy: '9dea3508-8ddf-4dff-8f26-9363e169df1a',
      endDate: null,
      fullName: 'Harry Potter',
      preferredName: 'Harry',
      contactInfo: {
        phones: [],
        emails: [{ value: 'harry@potter.com' }],
      },
    },
  ];

  it('should display invitedToApply with preferredName', () => {
    const model = applicantDetailsModel.create({ apiClient: {} });
    model.prefill({ partyMembers, personId: currentPersonId });
    expect(model.invitedToApply).toBe('Ron (GUARANTOR_FOR)'); // TODO need to figure out how to get real value of t function
  });

  it('should display invitedToApply with phone number when preferredName, fullName and emails are missing', () => {
    const partyMembersOnlyPhone = [
      ...partyMembers,
      {
        id: '83486fd5-98c4-4416-95a8-ced847610b4e',
        partyId: '2d90dbb9-6369-463f-adcb-cba8f209e437',
        memberType: DALTypes.MemberType.RESIDENT,
        personId: 'afd41ccc-937a-44ca-9e76-69affc937237',
        endDate: null,
        contactInfo: enhance([{ type: 'phone', value: '+51943356215', id: newId() }]),
      },
    ];
    const model = applicantDetailsModel.create({ apiClient: {} });
    model.prefill({ partyMembers: partyMembersOnlyPhone, personId: currentPersonId });
    expect(model.invitedToApply).toBe('Ron (GUARANTOR_FOR), +51 943 356 215'); // TODO need to figure out how to get real value of t function
  });

  it('should display invitedToApply with email when preferredName, fullName are missing', () => {
    const partyMembersOnlyPhone = [
      ...partyMembers,
      {
        id: '83486fd5-98c4-4416-95a8-ced847610b4f',
        partyId: '2d90dbb9-6369-463f-adcb-cba8f209e437',
        memberType: DALTypes.MemberType.RESIDENT,
        personId: 'afd41ccc-937a-44ca-9e76-69affc937237',
        endDate: null,
        contactInfo: enhance([
          { type: 'phone', value: '+51943356215', id: newId() },
          { type: 'email', value: 'test@reva.tech', id: newId() },
        ]),
      },
    ];
    const model = applicantDetailsModel.create({ apiClient: {} });
    model.prefill({ partyMembers: partyMembersOnlyPhone, personId: currentPersonId });
    expect(model.invitedToApply).toBe('Ron (GUARANTOR_FOR), test@reva.tech'); // TODO need to figure out how to get real value of t function
  });

  it('should not require middle name', async () => {
    const model = applicantDetailsModel.create({ apiClient: {} });
    await model.validate();

    const {
      middleName: { errorMessage },
    } = model.fields;
    expect(errorMessage).toBe('');
  });

  describe('when haveInternationalAdress is not checked', () => {
    it('should not require international address if haveInternationalAdress is not checked', async () => {
      const model = applicantDetailsModel.create({ apiClient: {} });
      model.updateField('haveInternationalAddress', false);
      await model.validate();

      expect(model.valid).toEqual(false);

      expect(model.summary.includes('ADDRESS_LINE_REQUIRED')).toEqual(false);
    });

    it('should require local address if haveInternationalAdress is not checked', async () => {
      const model = applicantDetailsModel.create({ apiClient: {} });
      model.updateField('haveInternationalAddress', false);
      await model.validate();

      expect(model.valid).toEqual(false);

      expect(model.summary.includes('ADDRESS_LINE_1_REQUIRED')).toEqual(true);
      expect(model.summary.includes('CITY_REQUIRED')).toEqual(true);
      expect(model.summary.includes('STATE_REQUIRED')).toEqual(true);
      expect(model.summary.includes('ZIP_REQUIRED')).toEqual(true);
    });

    it('should consider `requiredAreFilled` as true even if international address is not provided', async () => {
      const model = applicantDetailsModel.create({
        apiClient: {},
        getPersonByEmail: jest.fn(null),
      });
      model.updateFrom({
        firstName: 'Scooby',
        lastName: 'Doo',
        middleName: 'S',
        dateOfBirth: '07/07/1979',
        email: 'scooby@doo.com',
        phone: '2025550199',
        socSecNumber: '555-55-5555',
        grossIncome: '12131',
        grossIncomeFrequency: 'YEARLY',
        haveInternationalAddress: false,
        addressLine1: 'Some address',
        addressLine2: '',
        city: 'San Jose',
        state: 'CA',
        zip: '951323',
      });

      expect(model.requiredAreFilled).toEqual(true);

      await model.validate();
      expect(model.valid).toEqual(true);
    });

    it('should not fail if `socSecNumber` is filled partially and no _initialData is found found - CPM-9593', async () => {
      const model = applicantDetailsModel.create({
        apiClient: {},
        getPersonByEmail: jest.fn(null),
      });
      model.updateFrom({
        firstName: 'Scooby',
        lastName: 'Doo',
        middleName: 'S',
        dateOfBirth: '07/07/1979',
        email: 'scooby@doo.com',
        phone: '2025550199',
        socSecNumber: '555-55', // the error happened only if the socSecNumber was filled partially
        grossIncome: '12131',
        grossIncomeFrequency: 'YEARLY',
        haveInternationalAddress: false,
        addressLine1: 'Some address',
        addressLine2: '',
        city: 'San Jose',
        state: 'CA',
        zip: '951323',
      });

      expect(model.requiredAreFilled).toEqual(true);

      await model.validate();

      expect(model.summary).toEqual(['SSN_INVALID']);
      expect(model.valid).toEqual(false); // it is false because socSecNumber is not valid
    });
  });

  describe('when haveInternationalAdress is checked', () => {
    it('should require international address if haveInternationalAdress is not checked', async () => {
      const model = applicantDetailsModel.create({
        apiClient: {},
        getPersonByEmail: jest.fn(null),
      });
      model.updateField('haveInternationalAddress', true);
      await model.validate();

      expect(model.valid).toEqual(false);

      expect(model.summary.includes('ADDRESS_LINE_REQUIRED')).toEqual(true);
    });

    it('should not require local address if haveInternationalAdress is not checked', async () => {
      const model = applicantDetailsModel.create({
        apiClient: {},
        getPersonByEmail: jest.fn(null),
      });
      model.updateField('haveInternationalAddress', true);
      await model.validate();

      expect(model.valid).toEqual(false);

      expect(model.summary.includes('ADDRESS_LINE_1_REQUIRED')).toEqual(false);
      expect(model.summary.includes('CITY_REQUIRED')).toEqual(false);
      expect(model.summary.includes('STATE_REQUIRED')).toEqual(false);
      expect(model.summary.includes('ZIP_REQUIRED')).toEqual(false);
    });
  });

  it('should consider `requiredAreFilled` as true even if local address is not provided', async () => {
    const model = applicantDetailsModel.create({
      apiClient: {},
      getPersonByEmail: jest.fn(null),
    });
    model.updateFrom({
      firstName: 'Scooby',
      lastName: 'Doo',
      middleName: 'S',
      dateOfBirth: '07/07/1979',
      email: 'scooby@doo.com',
      phone: '2025550199',
      socSecNumber: '555-55-5555',
      grossIncome: '12131',
      grossIncomeFrequency: 'YEARLY',
      haveInternationalAddress: true,
      addressLine: 'Some address here',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      zip: '',
    });

    expect(model.requiredAreFilled).toEqual(true);

    await model.validate();

    expect(model.valid).toEqual(true);
  });

  describe('when finishing an application', () => {
    it('should call the completePersonApplication', async () => {
      const application = { completePersonApplication: jest.fn(() => {}), apiClient: {} };
      const model = applicantDetailsModel.create(application);
      model.complete();

      expect(application.completePersonApplication).toHaveBeenCalled();
    });
  });
});
