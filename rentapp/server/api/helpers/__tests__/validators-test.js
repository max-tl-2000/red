/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
const { mockModules } = require('../../../../../common/test-helpers/mocker').default(jest);

chai.use(chaiAsPromised);
const { expect } = chai;

describe('Validators', () => {
  let assertNoScreeningRequests;
  const partyId = newId();
  const personId = newId();
  const applicantId = newId();
  const partyMembers = [{ personId }];
  const partyApplication = { isHeld: true };
  const personApplications = [{ applicationData: { applicants: [{ applicantId }] } }];
  const screeningRequests = [{ applicantData: { applicants: [{ personId }] } }];

  const setupMocks = mocks => {
    jest.resetModules();
    mockModules({
      '../../../../../server/dal/partyRepo': {
        getPartyMembersByPartyIds: mocks.partyMembers,
      },
      '../../../services/party-application': {
        getPartyApplicationByPartyId: mocks.partyApplication,
      },
      '../../../dal/fadv-submission-repo': {
        getAllScreeningRequestsForParty: mocks.screeningRequests,
      },
      '../../../dal/person-application-repo': {
        getPersonApplicationsByPartyIdPersonIds: mocks.screeningRequests,
      },
    });
    const validators = require('../validators'); // eslint-disable-line global-require
    assertNoScreeningRequests = validators.assertNoScreeningRequests;
  };

  const buildMockObject = ({ members = partyMembers, application = partyApplication }) => ({
    partyMembers: jest.fn(() => members),
    partyApplication: jest.fn(() => application),
    screeningRequests: jest.fn(() => screeningRequests),
    personApplications: jest.fn(() => personApplications),
  });

  const validateAssertNoScreeningRequests = async () => {
    const res = await assertNoScreeningRequests({ tenantId: newId() }, partyId);
    expect(res).to.equal(undefined);
  };

  describe('Hold application, assert no screening requests', () => {
    describe('If guests from two parties were merged, one had an application held and the other had screenings, when releasing the hold', () => {
      it('should continue the release hold process', async () => {
        setupMocks(buildMockObject({}));

        await validateAssertNoScreeningRequests();
      });
    });

    describe('If two parties with two different members were merged, one had an application held and the other had screenings, when releasing the hold', () => {
      it('should continue the release hold process', async () => {
        partyMembers.push({ personId: newId() });
        setupMocks(buildMockObject({ members: partyMembers }));

        await validateAssertNoScreeningRequests();
      });
    });

    describe('If party member have screenings', () => {
      it('should return a hold action cancel error', async () => {
        const application = { isHeld: false };
        setupMocks(buildMockObject({ application }));

        try {
          await assertNoScreeningRequests({ tenantId: newId() }, partyId);
        } catch (error) {
          expect(error.token).to.equal('HOLD_ACTION_CANCELED');
        }
      });
    });
  });
});
