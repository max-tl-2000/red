/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getConcessionValues, getLeaseDataToPublish } from '../leaseFormHelper';
import { buildFormValuesFromPublishedQuote } from '../../containers/LeaseForm/LeaseForm';

describe('client/helpers/leaseFormHelper', () => {
  const buildConcession = () => ({
    relativeAdjustment: 0,
    absoluteAdjustment: 0,
    variableAdjustment: 0,
    recurring: false,
  });

  const term = { adjustedMarketRent: 1000 };

  describe('a fixed concession and no base rent set', () => {
    it('should compute the correct values', () => {
      const concession = buildConcession();
      const result = getConcessionValues(concession, term, undefined, 0);

      expect(result.isRecurringAndSet).toBe(false);
      expect(result.relativeAdjustment).toBe(0);
      expect(result.relativeAmount).toBe(0);
    });
  });

  describe('a fixed concession with 20% relative adjustment, no base rent set, term with 1000 rent,  ', () => {
    it('sets a relative amount of 200', () => {
      const concession = buildConcession();
      concession.relativeAdjustment = -20;
      const result = getConcessionValues(concession, term, undefined, 0);

      expect(result.isRecurringAndSet).toBe(false);
      expect(result.relativeAmount).toBe(200);
    });
  });

  describe('a fixed concession with 20% relative adjustment, base rent updated to 800', () => {
    it('sets a relative amount of 160', () => {
      const concession = buildConcession();
      concession.relativeAdjustment = -20;
      const baseRentValue = 800;
      const result = getConcessionValues(concession, term, baseRentValue, 0);

      expect(result.isRecurringAndSet).toBe(false);
      expect(result.relativeAmount).toBe(160);
    });
  });

  describe('a recurring variable concession with amountVariableAdjustment set', () => {
    it('will be marked as recurring', () => {
      const concession = buildConcession();
      concession.recurring = true;
      const amountVariableAdjustment = 25;
      const result = getConcessionValues(concession, term, undefined, amountVariableAdjustment);

      expect(result.isRecurringAndSet).toBe(true);
    });
  });
});

describe('client/containers/LeaseForm', () => {
  describe('submit lease form data', () => {
    it('should get publish lease data properly from lease form', () => {
      const leaseFormValues = {
        BASE_RENT: 1085,
        LEASE_END_DATE: '2019-10-02T05:00:00.000Z',
        LEASE_START_DATE: '2019-07-03T05:00:00.000Z',
        MOVE_IN_DATE: '2019-07-03T05:00:00.000Z',
        RENTERS_INSURANCE_FACTS: 'buyInsuranceFlag',
        'additional_3b4e9183-2fbb-4308-aa07-79b1986d1a5a--48b7d497-7fb3-495b-be01-dbb3d7ad53fe_amount': 85.0,
        'additional_3b4e9183-2fbb-4308-aa07-79b1986d1a5a--48b7d497-7fb3-495b-be01-dbb3d7ad53fe_checkbox': false,
        'additional_3b4e9183-2fbb-4308-aa07-79b1986d1a5a--48b7d497-7fb3-495b-be01-dbb3d7ad53fe_dropdown': 1,
        'additional_3b4e9183-2fbb-4308-aa07-79b1986d1a5a--48b7d497-7fb3-495b-be01-dbb3d7ad53fe_inventories': undefined,
        'additional_798eb3aa-3002-4b93-985a-609b435792f9_amount': 30,
        'additional_798eb3aa-3002-4b93-985a-609b435792f9_checkbox': false,
        'additional_798eb3aa-3002-4b93-985a-609b435792f9_dropdown': 1,
        'additional_e24b313e-ecdb-4654-9711-6c967ff37e61_amount': 0,
        'additional_e24b313e-ecdb-4654-9711-6c967ff37e61_checkbox': false,
        'additional_e24b313e-ecdb-4654-9711-6c967ff37e61_dropdown': 1,
        'concession_449ceaef-b2bb-4a13-a823-c6fc8bd67e05_amount': undefined,
        'concession_449ceaef-b2bb-4a13-a823-c6fc8bd67e05_checkbox': false,
        'concession_449ceaef-b2bb-4a13-a823-c6fc8bd67e05_toggle_amount': false,
        'concession_19106dc6-7e2b-4857-ad52-8c861636b1ed_amount': 651,
        'concession_19106dc6-7e2b-4857-ad52-8c861636b1ed_checkbox': true,
        'concession_19106dc6-7e2b-4857-ad52-8c861636b1ed_relativeAmount': 217,
        'concession_19106dc6-7e2b-4857-ad52-8c861636b1ed_toggle_amount': false,
        'onetime_57acd01d-a8d1-41d9-bcf0-d45aff6459bf--798eb3aa-3002-4b93-985a-609b435792f9>>1_amount': 75.0,
        'onetime_57acd01d-a8d1-41d9-bcf0-d45aff6459bf--798eb3aa-3002-4b93-985a-609b435792f9>>1_checkbox': false,
        'onetime_57acd01d-a8d1-41d9-bcf0-d45aff6459bf--798eb3aa-3002-4b93-985a-609b435792f9>>1_dropdown': 1,
        'onetime_429da650-b516-4e26-87cb-c273c7b09e4e_amount': 100,
        'onetime_429da650-b516-4e26-87cb-c273c7b09e4e_checkbox': true,
        'onetime_429da650-b516-4e26-87cb-c273c7b09e4e_dropdown': 1,
        'onetime_a75eb1cf-38cc-4baf-843d-5573e4cfd38a_amount': 50,
        'onetime_a75eb1cf-38cc-4baf-843d-5573e4cfd38a_checkbox': true,
        'onetime_a75eb1cf-38cc-4baf-843d-5573e4cfd38a_dropdown': 1,
        'onetime_b24b80b6-ac82-462f-9b8f-8dbc5e44b976_amount': 400,
        'onetime_b24b80b6-ac82-462f-9b8f-8dbc5e44b976_checkbox': true,
        'onetime_b24b80b6-ac82-462f-9b8f-8dbc5e44b976_dropdown': 1,
        'onetime_f52ce7a5-14ce-4eaf-b27e-10e6d08269b7--798eb3aa-3002-4b93-985a-609b435792f9>>1_amount': 200,
        'onetime_f52ce7a5-14ce-4eaf-b27e-10e6d08269b7--798eb3aa-3002-4b93-985a-609b435792f9>>1_checkbox': false,
        'onetime_f52ce7a5-14ce-4eaf-b27e-10e6d08269b7--798eb3aa-3002-4b93-985a-609b435792f9>>1_dropdown': 1,
      };

      const publishedLeaseExpected = {
        leaseStartDate: '2019-07-03T05:00:00.000Z',
        leaseEndDate: '2019-10-02T05:00:00.000Z',
        moveInDate: '2019-07-03T05:00:00.000Z',
        unitRent: 1085,
        rentersInsuranceFacts: 'buyInsuranceFlag',
        sfsuAddendumIncluded: undefined,
        concessions: {
          '19106dc6-7e2b-4857-ad52-8c861636b1ed': {
            amount: 651,
            relativeAmount: 217,
          },
        },
        additionalCharges: {},
        oneTimeCharges: {
          '429da650-b516-4e26-87cb-c273c7b09e4e': {
            amount: 100,
            quantity: 1,
          },
          'a75eb1cf-38cc-4baf-843d-5573e4cfd38a': {
            amount: 50,
            quantity: 1,
          },
          'b24b80b6-ac82-462f-9b8f-8dbc5e44b976': {
            amount: 400,
            quantity: 1,
          },
        },
      };
      const publishedLease = getLeaseDataToPublish(leaseFormValues);

      expect(publishedLease).toEqual(publishedLeaseExpected);
    });
  });

  describe('initial data to lease form', () => {
    it('should create initial data for lease form', () => {
      const additionalData = {
        publishedTerm: {
          id: 'fea4b613-9c2e-4c8f-9efa-8fd8a325a9a2',
          leaseStartDate: '2019-07-02T20:46:44.801Z',
          adjustedMarketRent: 1085,
          termLength: 3,
          period: 'month',
          additionalAndOneTimeCharges: {
            oneTimeCharges: [
              { id: 'a75eb1cf-38cc-4baf-843d-5573e4cfd38a' },
              { id: '429da650-b516-4e26-87cb-c273c7b09e4e' },
              { id: 'b24b80b6-ac82-462f-9b8f-8dbc5e44b976' },
            ],
          },
          concessions: [{ id: '19106dc6-7e2b-4857-ad52-8c861636b1ed' }, { id: '449ceaef-b2bb-4a13-a823-c6fc8bd67e05' }],
        },
        additionalAndOneTimeCharges: [
          {
            name: 'month',
            fees: [
              {
                id: '3b4e9183-2fbb-4308-aa07-79b1986d1a5a--48b7d497-7fb3-495b-be01-dbb3d7ad53fe',
                amount: 85,
                hasInventoryPool: false,
                maxRent: '85.00',
                minRent: '85.00',
                quantity: 1,
                quoteSectionName: 'parking',
                concessions: [],
              },
              {
                id: '798eb3aa-3002-4b93-985a-609b435792f9',
                name: 'PetRent',
                amount: 30,
                quantity: 1,
                quoteSectionName: 'pet',
                concessions: [],
              },
              {
                id: 'e24b313e-ecdb-4654-9711-6c967ff37e61',
                name: 'serviceAnimalRent',
                amount: 0,
                quantity: 1,
                quoteSectionName: 'pet',
                concessions: [],
              },
              {
                id: 'a75eb1cf-38cc-4baf-843d-5573e4cfd38a',
                name: 'AdminFee',
                amount: 50,
                quantity: 1,
                quoteSectionName: 'deposit',
                concessions: [],
              },
              {
                id: '429da650-b516-4e26-87cb-c273c7b09e4e',
                name: 'holdDeposit',
                amount: 100,
                quantity: 1,
                quoteSectionName: 'deposit',
                concessions: [],
              },
              {
                id: '57acd01d-a8d1-41d9-bcf0-d45aff6459bf--798eb3aa-3002-4b93-985a-609b435792f9>>1',
                name: 'PetDeposit',
                amount: '75.00',
                quantity: 1,
                quoteSectionName: 'deposit',
              },
              {
                id: 'f52ce7a5-14ce-4eaf-b27e-10e6d08269b7--798eb3aa-3002-4b93-985a-609b435792f9>>1',
                name: 'PetFee',
                amount: 200,
                quantity: 1,
                quoteSectionName: 'deposit',
                concessions: [],
              },
              {
                id: 'b24b80b6-ac82-462f-9b8f-8dbc5e44b976',
                name: 'UnitDeposit',
                amount: '400.00',
                quantity: 1,
                quoteSectionName: 'deposit',
              },
            ],
          },
        ],
        selections: {
          selectedAdditionalAndOneTimeCharges: {
            fees: [
              {
                id: '3b4e9183-2fbb-4308-aa07-79b1986d1a5a--48b7d497-7fb3-495b-be01-dbb3d7ad53fe',
                quantity: 1,
                amount: '85.00',
                selectedConcessions: [],
              },
              {
                id: 'a75eb1cf-38cc-4baf-843d-5573e4cfd38a',
                quantity: 1,
                amount: 50,
                selectedConcessions: [],
              },
              {
                id: '429da650-b516-4e26-87cb-c273c7b09e4e',
                quantity: 1,
                amount: 100,
                selectedConcessions: [],
              },
              {
                id: 'b24b80b6-ac82-462f-9b8f-8dbc5e44b976',
                quantity: 1,
                amount: '400.00',
              },
            ],
          },
        },
        concessions: [
          {
            id: '19106dc6-7e2b-4857-ad52-8c861636b1ed',
            relativeAdjustment: '-20.00',
            variableAdjustment: false,
            absoluteAdjustment: '0.00',
          },
          {
            id: '449ceaef-b2bb-4a13-a823-c6fc8bd67e05',
            relativeAdjustment: '-5.20',
            variableAdjustment: true,
            absoluteAdjustment: '0.00',
          },
        ],
      };
      const model = {
        additionalConditions: { quoteId: 'd02f1050-d493-44a4-b7e4-47aa2a0207c2' },
        timezone: 'America/Chicago',
      };
      const baseRentValue = 1085;

      const initialFormValues = buildFormValuesFromPublishedQuote(additionalData, model, baseRentValue);

      delete initialFormValues.LEASE_START_DATE;
      delete initialFormValues.ORIGINAL_LEASE_START_DATE;
      delete initialFormValues.MOVE_IN_DATE;
      delete initialFormValues.LEASE_END_DATE;
      delete initialFormValues.ORIGINAL_LEASE_END_DATE;
      delete initialFormValues.SELECTED_OCCUPANTS;
      delete initialFormValues.SELECTED_PARTY_REPRESENTATIVE;

      const expectedLeaseFormValues = {
        BASE_RENT: 1085,
        RENTERS_INSURANCE_FACTS: 'buyInsuranceFlag',
        'concession_19106dc6-7e2b-4857-ad52-8c861636b1ed_checkbox': false,
        'concession_19106dc6-7e2b-4857-ad52-8c861636b1ed_toggle_amount': false,
        'concession_19106dc6-7e2b-4857-ad52-8c861636b1ed_amount': 217,
        'concession_19106dc6-7e2b-4857-ad52-8c861636b1ed_relativeAmount': 217,
        'concession_449ceaef-b2bb-4a13-a823-c6fc8bd67e05_checkbox': false,
        'concession_449ceaef-b2bb-4a13-a823-c6fc8bd67e05_toggle_amount': false,
        'concession_449ceaef-b2bb-4a13-a823-c6fc8bd67e05_amount': 0,
        'concession_449ceaef-b2bb-4a13-a823-c6fc8bd67e05_amountVariableAdjustment': undefined,
        'onetime_a75eb1cf-38cc-4baf-843d-5573e4cfd38a_checkbox': true,
        'onetime_a75eb1cf-38cc-4baf-843d-5573e4cfd38a_amount': 50,
        'onetime_a75eb1cf-38cc-4baf-843d-5573e4cfd38a_dropdown': 1,
        'onetime_429da650-b516-4e26-87cb-c273c7b09e4e_checkbox': true,
        'onetime_429da650-b516-4e26-87cb-c273c7b09e4e_amount': 100,
        'onetime_429da650-b516-4e26-87cb-c273c7b09e4e_dropdown': 1,
        'onetime_57acd01d-a8d1-41d9-bcf0-d45aff6459bf--798eb3aa-3002-4b93-985a-609b435792f9>>1_checkbox': false,
        'onetime_57acd01d-a8d1-41d9-bcf0-d45aff6459bf--798eb3aa-3002-4b93-985a-609b435792f9>>1_amount': 75.0,
        'onetime_57acd01d-a8d1-41d9-bcf0-d45aff6459bf--798eb3aa-3002-4b93-985a-609b435792f9>>1_dropdown': 1,
        'onetime_f52ce7a5-14ce-4eaf-b27e-10e6d08269b7--798eb3aa-3002-4b93-985a-609b435792f9>>1_checkbox': false,
        'onetime_f52ce7a5-14ce-4eaf-b27e-10e6d08269b7--798eb3aa-3002-4b93-985a-609b435792f9>>1_amount': 200,
        'onetime_f52ce7a5-14ce-4eaf-b27e-10e6d08269b7--798eb3aa-3002-4b93-985a-609b435792f9>>1_dropdown': 1,
        'onetime_b24b80b6-ac82-462f-9b8f-8dbc5e44b976_checkbox': true,
        'onetime_b24b80b6-ac82-462f-9b8f-8dbc5e44b976_amount': 400,
        'onetime_b24b80b6-ac82-462f-9b8f-8dbc5e44b976_dropdown': 1,
      };

      expect(initialFormValues).toEqual(expectedLeaseFormValues);
    });
  });
});
