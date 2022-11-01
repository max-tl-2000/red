/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { ScreeningVersion } from '../../../../common/enums/screeningReportTypes';
const { mockModules } = require('../../../../common/test-helpers/mocker').default(jest);

describe('applicant', () => {
  let getApplicant;
  const partyId = newId();
  const inventoryId = newId();
  const tenantId = newId();
  const partyMembersInfo = { partyId };
  const propertyInfo = { propertyName: 'Property Name', propertyPolicies: {} };
  const personId = newId();
  const applicationObjectId = newId();
  const leasingAgent = {
    id: newId(),
  };
  const tenant = {
    settings: {
      communications: {
        contactUsLink: 'testLink.com',
      },
    },
    partySettings: {
      traditional: {
        residentOrPartyLevelGuarantor: DALTypes.GuarantorLevel.PARTY,
      },
    },
  };

  const getInventoryInfo = () => ({ inventoryId });
  const email = 'common_email@test.com';

  const defaultMocks = () => ({
    getPersonApplication: jest.fn(() => ({ id: applicationObjectId })),
    validateApplicant: jest.fn(() => {}),
    getPersonApplicationByFilter: jest.fn(() => ({ id: personId })),
    getPersonApplicationsByFilter: jest.fn(() => [{}]),
    createPersonApplication: jest.fn(() => {}),
    loadPartyMembers: jest.fn(() => ({ partyId })),
    loadPartyById: jest.fn(() => ({ partyId, userId: leasingAgent.id, leaseType: 'traditional' })),
    getInventoryForQuote: jest.fn(() => getInventoryInfo()),
    getCommonUserByPersonIds: jest.fn(() => [{ tenantId, personId }]),
    getPropertyInfo: jest.fn(() => ({
      propertyName: 'Property Name',
      propertyPolicies: {},
    })),
    getLeasingAgentInformationForApplication: jest.fn(() => leasingAgent),
    getTenant: jest.fn(() => tenant),
    getPersonById: jest.fn(() => ({ id: personId })),
    getCommonUser: jest.fn(() => ({ email })),
    approvedQuotePromotionsExist: jest.fn(() => false),
    loadPartyMembersApplicantInfo: jest.fn(() => ({ partyId })),
  });

  const setupMocks = mocks => {
    jest.resetModules();
    mockModules({
      '../../services/person-application': {
        getPersonApplication: mocks.getPersonApplication,
        getPersonApplicationByFilter: mocks.getPersonApplicationByFilter,
        getPersonApplicationsByFilter: mocks.getPersonApplicationsByFilter,
        createPersonApplication: mocks.createPersonApplication,
        validateApplicant: mocks.validateApplicant,
      },
      '../../../../server/services/party': {
        loadPartyMembersApplicantInfo: mocks.loadPartyMembersApplicantInfo,
        loadPartyMembers: mocks.loadPartyMembers,
        loadPartyById: mocks.loadPartyById,
      },
      '../../../../server/services/inventories': {
        getInventoryForQuote: mocks.getInventoryForQuote,
      },
      '../../../../server/dal/usersRepo': {
        getLeasingAgentInformationForApplication: mocks.getLeasingAgentInformationForApplication,
      },
      '../helpers/properties': {
        getPropertyInfo: mocks.getPropertyInfo,
      },
      '../../../../server/services/tenantService': {
        getTenant: mocks.getTenant,
      },
      '../../../../server/services/person': {
        getPersonById: mocks.getPersonById,
      },
      '../../../../auth/server/services/common-user': {
        getCommonUser: mocks.getCommonUser,
        getCommonUserByPersonIds: mocks.getCommonUserByPersonIds,
      },
      '../../../../server/services/quotePromotions': {
        approvedQuotePromotionsExist: mocks.approvedQuotePromotionsExist,
      },
    });
    const applicant = require('../actions/applicant'); // eslint-disable-line global-require
    getApplicant = applicant.getApplicant;
  };

  describe('getApplicant', () => {
    let req;

    let mocks;

    beforeEach(() => {
      req = {
        authUser: {
          partyId,
          tenantId,
          quoteId: newId(),
          personId: newId(),
          personName: 'Harry Potter',
          tenantDomain: 'tenant.local.env.reva.tech',
          commonUserId: newId(),
          screeningVersion: ScreeningVersion.V1,
        },
        query: {},
      };
    });

    it('should return authUser information when there is no paid application', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      const result = await getApplicant(req);
      const { impersonatorUserId, propertyId, ...rest } = result;
      expect(mocks.getPersonApplication.mock.calls.length).toEqual(1);
      expect(mocks.getPersonApplicationByFilter.mock.calls.length).toEqual(1);
      expect(mocks.createPersonApplication.mock.calls.length).toEqual(0);
      expect(mocks.loadPartyMembersApplicantInfo.mock.calls.length).toEqual(1);
      expect(mocks.getInventoryForQuote.mock.calls.length).toEqual(1);
      expect(mocks.validateApplicant.mock.calls.length).toEqual(1);
      expect(impersonatorUserId).not.toBeDefined();
      expect(propertyId).not.toBeDefined();

      delete req.authUser.commonUserId;
      delete req.authUser.screeningVersion;
      expect({ ...rest }).toEqual({
        ...req.authUser,
        partyMembersInfo,
        applicationObject: {
          applicationData: {},
          id: applicationObjectId,
        },
        propertyInfo,
        leasingAgent,
        contactUsLink: tenant.settings.communications.contactUsLink,
        commonUserEmail: email,
        hasMultipleApplications: undefined,
        partyType: 'traditional',
        residentOrPartyLevelGuarantor: DALTypes.GuarantorLevel.PARTY,
        isPromotionApproved: false,
        redirectToApplicationList: false,
      });
    });
  });
});
