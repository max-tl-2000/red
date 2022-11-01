/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import request from 'supertest';
import newId from 'uuid/v4';
import app from '../../../../server/api/api';
import { createJWTToken } from '../../../../common/server/jwt-helpers';
import { setupTestQuote, createQuotePrerequisites, pricingSetting } from '../../../../server/testUtils/quoteApiHelper';
import { tenant } from '../../../../server/testUtils/setupTestGlobalContext';
import { createAPersonApplication, createAPartyApplication } from '../../test-utils/repo-helper.js';
import { createAPartyMember, createAParty } from '../../../../server/testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';

describe('API/applicant', () => {
  const applicantKeys = [
    'quoteId',
    'personId',
    'personName',
    'tenantId',
    'partyId',
    'propertyId',
    'partyMembersInfo',
    'applicationObject',
    'propertyInfo',
    'redirectToApplicationList',
    'leasingAgent',
    'contactUsLink',
    'partyType',
    'isPromotionApproved',
  ];

  const getAuthHeader = keys => {
    const token = createJWTToken(keys);
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const getApplicant = header => request(app).get('/applicant').set(header);

  const createAuthorizationToken = async personId => {
    const settings = {
      ...pricingSetting,
      application: {
        urlPropPolicy: 'http://www.parkmerced.com/privacy-policy-parkmerced',
      },
      ...((personId && { personId }) || {}),
    };
    const quoteData = await createQuotePrerequisites(settings);
    const { publishedQuote, partyId, user, property, partyMember } = await setupTestQuote(quoteData);
    const personApplication = await createAPersonApplication({ firstName: 'Name' }, partyMember.personId, partyId);

    delete personApplication.created_at;
    delete personApplication.updated_at;
    const keys = {
      tenantId: tenant.id,
      quoteId: publishedQuote.id,
      personId: personApplication.personId,
      personName: 'Name',
      partyId,
      propertyId: property.id,
      partyMembersInfo: [],
      applicationObject: personApplication,
      fees: [],
      propertyInfo: {
        propertyName: property.displayName,
        propertyId: property.id,
        propertyPolicies: [
          {
            policyUrl: property.settings.application.urlPropPolicy,
            propertyName: property.displayName,
            id: property.id,
          },
        ],
      },
      leasingAgent: user,
    };
    return { keys, authHeader: getAuthHeader(keys) };
  };

  context('GET', () => {
    it('should return keys from given token', async () => {
      const { keys, authHeader } = await createAuthorizationToken();

      await getApplicant(authHeader)
        .expect(200)
        .expect(res => {
          delete res.body.applicationObject.created_at;
          delete res.body.applicationObject.updated_at;
          expect(res.body).to.have.all.keys(applicantKeys);
          expect(res.body.quoteId).to.eq(keys.quoteId);
          expect(res.body.personId).to.eq(keys.personId);
          expect(res.body.personName).to.eq(keys.personName);
        });
    });

    describe('when the same person exists in another party', () => {
      const assertApplicantionForExistingPerson = (res, { personId, partyId, personApplicationId, partyApplicationId }) => {
        expect(res.body.personId).to.eq(personId);
        expect(res.body.partyId).to.not.eq(partyId);
        expect(res.body.applicationObject.personId).to.eq(personId);
        expect(res.body.applicationObject.partyId).to.not.eq(partyId);
        expect(res.body.applicationObject.id).to.not.eq(personApplicationId);
        expect(res.body.applicationObject.partyApplicationId).to.not.eq(partyApplicationId);
      };

      it('should return the right person associated to the party', async () => {
        const party = await createAParty({
          state: DALTypes.PartyStateType.PROSPECT,
        });
        const member = await createAPartyMember(party.id, {
          memberType: DALTypes.MemberType.RESIDENT,
          memberState: DALTypes.PartyStateType.APPLICANT,
          fullname: 'TEST',
        });
        const baseData = { personId: member.personId, partyId: member.partyId };
        const partyApplication = await createAPartyApplication(baseData.partyId, newId(), {});
        const personApplication = await createAPersonApplication({ firstName: 'Name' }, baseData.personId, partyApplication.partyId, partyApplication.id);

        baseData.partyApplicationId = partyApplication.id;
        baseData.personApplicationId = personApplication.id;

        const { authHeader } = await createAuthorizationToken(baseData.personId);
        // Create the application for the same person in a different party
        await getApplicant(authHeader)
          .expect(200)
          .expect(res => assertApplicantionForExistingPerson(res, baseData));

        // Reload the application
        await getApplicant(authHeader)
          .query({ isReload: true })
          .expect(200)
          .expect(res => assertApplicantionForExistingPerson(res, baseData));
      });
    });
  });
});
