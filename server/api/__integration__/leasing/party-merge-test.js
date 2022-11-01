/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { expect } from 'chai';
import request from 'supertest';
import app from '../../api';
import { getAuthHeader, setupQueueToWaitFor } from '../../../testUtils/apiHelper';
import { createLeaseTestData, createLease } from '../../../testUtils/leaseTestHelper';
import {
  testCtx as ctx,
  createAUser,
  createAParty,
  createAPartyMember,
  createAProperty,
  createAPerson,
  createAnAppointment,
  createAQuote,
  createATask,
  createACommunicationEntry,
  createAQuotePromotion,
  createAnActivityLog,
  createATeam,
  createATeamMember,
  createAPublishedQuote,
  createAnInventoryOnHold,
  toggleExtCalendarFeature,
  createAnInventory,
} from '../../../testUtils/repoHelper';
import { createAPersonApplication, createAPartyApplication, createAnApplicationInvoice } from '../../../../rentapp/server/test-utils/repo-helper';
import { createPartyApplicationDocument } from '../../../../rentapp/server/dal/party-application-repo';
import { getAllScreeningRequestsForParty } from '../../../../rentapp/server/dal/fadv-submission-repo';
import { partyKeys } from '../../../testUtils/expectedKeys';
import { removePartyMember } from '../../../services/party';
import * as mergeRepo from '../../../dal/mergePartyRepo';
import { loadParty, getAllQuotePromotionsByPartyId, updateParty, markMemberAsRemoved } from '../../../dal/partyRepo';
import { getTasksByPartyIds } from '../../../dal/tasksRepo';
import { loadCommunicationsByPartyIds, getUnreadCommunicationsByPartyId } from '../../../dal/communicationRepo';
import { getQuotesByPartyId } from '../../../dal/quoteRepo';
import { getInventoriesOnHoldByParty } from '../../../dal/inventoryRepo';
import { getPersonApplicationsByFilter } from '../../../../rentapp/server/dal/person-application-repo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { personApplicationWithMissingNotRequiredElements as applicationData } from '../../../../rentapp/server/helpers/__tests__/fixtures/fadv-test-data.js';
import { now } from '../../../../common/helpers/moment-utils';

const createMergeSession = async (mergeContext, partyId) =>
  await request(app).post('/mergePartySessions').set(getAuthHeader(tenant.id)).send({ mergeContext, partyId });

const getNextMatch = async sessionId => await request(app).post(`/mergePartySessions/${sessionId}/matches`).set(getAuthHeader(tenant.id)).expect(200);

describe('/mergePartySessions', () => {
  describe('when the payload does not contain a merge context', () => {
    it('responds with status code 400 and MISSING_MERGE_CONTEXT token', async () => {
      const {
        status,
        body: { token },
      } = await createMergeSession();
      expect(status).to.equal(400);
      expect(token).to.equal('MISSING_MERGE_CONTEXT');
    });
  });

  describe('when the payload contains an invalid merge context', () => {
    it('responds with status code 400 and INVALID_MERGE_CONTEXT token', async () => {
      const {
        status,
        body: { token },
      } = await createMergeSession('invalid-merge-context');
      expect(status).to.equal(400);
      expect(token).to.equal('INVALID_MERGE_CONTEXT');
    });
  });

  describe('when the payload contains an invalid party id', () => {
    it('responds with status code 400 and INCORRECT_PARTY_ID token', async () => {
      const {
        status,
        body: { token },
      } = await createMergeSession(DALTypes.MergePartyContext.PARTY, 'invalid-party-id');
      expect(status).to.equal(400);
      expect(token).to.equal('INCORRECT_PARTY_ID');
    });
  });

  describe('when the party id from payload does not exist', () => {
    it('responds with status code 400 and PARTY_NOT_FOUND token', async () => {
      const {
        status,
        body: { token },
      } = await createMergeSession(DALTypes.MergePartyContext.PARTY, newId());
      expect(status).to.equal(404);
      expect(token).to.equal('PARTY_NOT_FOUND');
    });
  });

  describe('when the party id is a valid uuid', () => {
    it('should create a new merge session and the response should contain the new session id', async () => {
      const { id: userId } = await createAUser();
      const { id: partyId } = await createAParty({ userId });
      await createAPartyMember(partyId);

      const {
        status,
        body: { id: sessionId },
      } = await createMergeSession(DALTypes.MergePartyContext.PARTY, partyId);
      expect(status).to.equal(200);
      const mergeSessions = await mergeRepo.getAllMergeSessions(ctx);
      expect(mergeSessions.length).to.equal(1);
      expect(sessionId).to.equal(mergeSessions[0].id);
    });
  });
});

describe('/mergePartySessions/:sessionId/matches', () => {
  const expectedKeys = ['matchId', 'sessionId', 'isMergeConflict', 'firstParty', 'secondParty', 'result'];

  const expectedPartyKeys = [...partyKeys, 'partyMembers', 'lastContactedDate', 'partyOwner', 'property'];

  const expectedMergeResultKeys = [...partyKeys, 'partyMembers', 'lastContactedDate', 'appointments', 'quotes'];

  describe('when there is no possible match', () => {
    it('the response should contain an empty json object', async () => {
      const { id: userId } = await createAUser();
      const { id: propertyId } = await createAProperty();
      const { id: partyId } = await createAParty({ userId, assignedPropertyId: propertyId });
      await createAPartyMember(partyId);

      const {
        body: { id: sessionId },
      } = await createMergeSession(DALTypes.MergePartyContext.PARTY, partyId);

      const { body } = await getNextMatch(sessionId);
      expect(body).to.deep.equal({});
    });
  });

  describe('when there is at least a possible match', () => {
    it('the response should contain the expected keys', async () => {
      const { id: userId } = await createAUser();
      const { id: propertyId } = await createAProperty();
      const { id: personId } = await createAPerson();

      const { id: partyId } = await createAParty({ userId, assignedPropertyId: propertyId });
      await createAPartyMember(partyId, { personId });
      await createAnAppointment({ partyId, salesPersonId: userId });
      await createAnAppointment({ partyId, salesPersonId: userId });
      await createAQuote(partyId);

      const { id: party2Id } = await createAParty({ userId, assignedPropertyId: propertyId });
      await createAPartyMember(party2Id, { personId });
      await createAnAppointment({ partyId: party2Id, salesPersonId: userId });
      await createAQuote(party2Id);

      const {
        body: { id: sessionId },
      } = await createMergeSession(DALTypes.MergePartyContext.PARTY, partyId);

      const { body } = await getNextMatch(sessionId);
      expect(body).to.have.all.keys(expectedKeys);
      const { secondParty: matchSecondParty, result: matchResult } = body;
      expect(matchSecondParty).to.have.all.keys(expectedPartyKeys);
      expect(matchResult).to.have.all.keys(expectedMergeResultKeys);
      expect(matchResult.appointments).to.equal(3);
      expect(matchResult.quotes).to.equal(2);
    });
  });

  describe('when the endpoint is called multiple time with a session id and an available match exists', () => {
    it('a party match should be returned for each call, until all matches are resolved', async () => {
      const { id: userId } = await createAUser();
      const { id: propertyId } = await createAProperty();
      const { id: personId } = await createAPerson();

      const { id: partyId } = await createAParty({ userId, assignedPropertyId: propertyId });
      await createAPartyMember(partyId, { personId });

      const { id: party2Id } = await createAParty({ userId, assignedPropertyId: propertyId });
      await createAPartyMember(party2Id, { personId });

      const { id: party3Id } = await createAParty({ userId, assignedPropertyId: propertyId });
      await createAPartyMember(party3Id, { personId });

      const {
        body: { id: sessionId },
      } = await createMergeSession(DALTypes.MergePartyContext.PARTY, partyId);

      const {
        body: { secondParty: matchSecondParty },
      } = await getNextMatch(sessionId);
      const {
        body: { secondParty: match2SecondParty },
      } = await getNextMatch(sessionId);
      expect([matchSecondParty.id, match2SecondParty.id].sort()).to.deep.equal([party2Id, party3Id].sort());

      // there should be no more matches
      const { body } = await getNextMatch(sessionId);
      expect(body).to.deep.equal({});
    });
  });

  describe('no possible match should be found when one of the parties is a renewal party', () => {
    describe('when the base party is renewal', () => {
      it('no possible match should be returned', async () => {
        const { id: userId } = await createAUser();
        const { id: propertyId } = await createAProperty();
        const { id: personId } = await createAPerson();

        const { id: partyId } = await createAParty({ userId, assignedPropertyId: propertyId, workflowName: DALTypes.WorkflowName.RENEWAL });
        await createAPartyMember(partyId, { personId });

        const { id: party2Id } = await createAParty({ userId, assignedPropertyId: propertyId });
        await createAPartyMember(party2Id, { personId });

        const {
          body: { id: sessionId },
        } = await createMergeSession(DALTypes.MergePartyContext.PARTY, partyId);

        const { body } = await getNextMatch(sessionId);
        expect(body).to.deep.equal({});
      });
    });
  });

  describe('when there is both a renewal and an active workflow as match', () => {
    it('only the renewal should be selected as a match', async () => {
      const { id: userId } = await createAUser();
      const { id: propertyId } = await createAProperty();
      const { id: personId } = await createAPerson();

      const { id: activePartyId, partyGroupId } = await createAParty({
        userId,
        assignedPropertyId: propertyId,
        workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
      });
      await createAPartyMember(activePartyId, { personId });

      const { id: renewalPartyId } = await createAParty({
        userId,
        assignedPropertyId: propertyId,
        workflowName: DALTypes.WorkflowName.RENEWAL,
        partyGroupId,
      });
      await createAPartyMember(renewalPartyId, { personId });

      const { id: newPartyId } = await createAParty({ userId, assignedPropertyId: propertyId, workflowName: DALTypes.WorkflowName.NEW_LEASE });
      await createAPartyMember(newPartyId, { personId });

      const {
        body: { id: sessionId },
      } = await createMergeSession(DALTypes.MergePartyContext.PARTY, newPartyId);

      const {
        body: { secondParty: mergeMatch },
      } = await getNextMatch(sessionId);

      expect(mergeMatch.id).to.deep.equal(renewalPartyId);

      const { body } = await getNextMatch(sessionId);

      expect(body).to.deep.equal({});
    });
  });

  describe('when there is a new workflow, a renewal and an active workflow as match', () => {
    it('the new workflow is the first merge candidate followed by the renewal workflow', async () => {
      const { id: userId } = await createAUser();
      const { id: propertyId } = await createAProperty();
      const { id: personId } = await createAPerson();

      const { id: activePartyId, partyGroupId } = await createAParty({
        userId,
        assignedPropertyId: propertyId,
        workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
      });
      await createAPartyMember(activePartyId, { personId });

      const { id: renewalPartyId } = await createAParty({
        userId,
        assignedPropertyId: propertyId,
        workflowName: DALTypes.WorkflowName.RENEWAL,
        partyGroupId,
      });
      await createAPartyMember(renewalPartyId, { personId });

      const { id: firstNewPartyId } = await createAParty({ userId, assignedPropertyId: propertyId, workflowName: DALTypes.WorkflowName.NEW_LEASE });
      await createAPartyMember(firstNewPartyId, { personId });

      const { id: secondNewPartyId } = await createAParty({ userId, assignedPropertyId: propertyId, workflowName: DALTypes.WorkflowName.NEW_LEASE });
      await createAPartyMember(secondNewPartyId, { personId });

      const {
        body: { id: sessionId },
      } = await createMergeSession(DALTypes.MergePartyContext.PARTY, firstNewPartyId);

      const {
        body: { secondParty: firstMergeMatch },
      } = await getNextMatch(sessionId);

      expect(firstMergeMatch.id).to.deep.equal(secondNewPartyId);

      const {
        body: { secondParty: secondMergeMatch },
      } = await getNextMatch(sessionId);

      expect(secondMergeMatch.id).to.deep.equal(renewalPartyId);
    });
  });
});

describe('/mergePartySessions/:sessionId/matches/:matchId/resolve', () => {
  const prepareDataForResolveRequest = async () => {
    const { id: userId } = await createAUser();
    const property = await createAProperty();
    const person = await createAPerson();

    const qualificationQuestions = {
      moveInTime: 'NEXT_2_MONTHS',
      numBedrooms: ['ONE_BED'],
      groupProfile: 'COUPLE_OR_FAMILY',
      cashAvailable: 'YES',
    };

    const storedUnitsFilters = {
      moveInDate: { max: '2017-10-30', min: '2017-09-30' },
      numBedrooms: ['ONE_BED'],
    };
    const team = await createATeam();

    const party2 = await createAParty({ userId, assignedPropertyId: property.id, qualificationQuestions, ownerTeam: team.id });
    const party2Member = await createAPartyMember(party2.id, { personId: person.id, memberType: DALTypes.MemberType.RESIDENT });

    const party = await createAParty({ userId, assignedPropertyId: property.id, storedUnitsFilters, ownerTeam: team.id });
    const partyMember = await createAPartyMember(party.id, { personId: person.id, memberType: DALTypes.MemberType.RESIDENT });

    const {
      body: { id: sessionId },
    } = await createMergeSession(DALTypes.MergePartyContext.PARTY, party.id);

    const {
      body: { matchId },
    } = await getNextMatch(sessionId);

    return {
      userId,
      person,
      property,
      sessionId,
      matchId,
      party,
      party2,
      partyMember,
      party2Member,
      qualificationQuestions,
      storedUnitsFilters,
    };
  };

  const mergeParties = async (userId, sessionId, matchId) =>
    await request(app)
      .patch(`/mergePartySessions/${sessionId}/matches/${matchId}/resolve`)
      .set(getAuthHeader(tenant.id, userId))
      .send({ response: DALTypes.MergePartyResponse.MERGE, partyOwnerId: userId });

  const closeParty = async (userId, partyId) =>
    await request(app)
      .post(`/parties/${partyId}/close`)
      .set(getAuthHeader(tenant.id, userId))
      .send({ closeReasonId: DALTypes.ClosePartyReasons.ALREADY_A_RESIDENT });

  const dontMergeParties = async (userId, sessionId, matchId) =>
    await request(app)
      .patch(`/mergePartySessions/${sessionId}/matches/${matchId}/resolve`)
      .set(getAuthHeader(tenant.id, userId))
      .send({ response: DALTypes.MergePartyResponse.DONT_MERGE });

  describe('when the session id is not a valid id', () => {
    it('responds with status code 400 and INCORRECT_SESSION_ID token', async () => {
      const { id: userId } = await createAUser();
      const sessionId = 'invalid-session-id';
      const matchId = newId();

      const {
        status,
        body: { token },
      } = await dontMergeParties(userId, sessionId, matchId);
      expect(status).to.equal(400);
      expect(token).to.equal('INCORRECT_SESSION_ID');
    });
  });

  describe('when the session id does not exist', () => {
    it('responds with status code 404 and MERGE_PARTY_SESSION_NOT_FOUND token', async () => {
      const { id: userId } = await createAUser();
      const sessionId = newId();
      const matchId = newId();

      const { status, body } = await dontMergeParties(userId, sessionId, matchId);
      expect(status).to.equal(404);
      expect(body.token).to.equal('MERGE_PARTY_SESSION_NOT_FOUND');
    });
  });

  describe('when the match id is not a valid id', () => {
    it('responds with status code 400 and INCORRECT_MATCH_ID token', async () => {
      const { userId, sessionId } = await prepareDataForResolveRequest();
      const matchId = 'invalid-match-id';

      const {
        status,
        body: { token },
      } = await dontMergeParties(userId, sessionId, matchId);
      expect(status).to.equal(400);
      expect(token).to.equal('INCORRECT_MATCH_ID');
    });
  });

  describe('when the match id does not exist', () => {
    it('responds with status code 404 and MERGE_PARTY_MATCH_NOT_FOUND token', async () => {
      const { userId, sessionId } = await prepareDataForResolveRequest();
      const matchId = newId();

      const {
        status,
        body: { token },
      } = await dontMergeParties(userId, sessionId, matchId);
      expect(status).to.equal(404);
      expect(token).to.equal('MERGE_PARTY_MATCH_NOT_FOUND');
    });
  });

  describe("when the user chooses to don't merge the parties", () => {
    it('should mark the party match as resolved by the auth user and the resultPartyId should be null', async () => {
      const { userId, sessionId, matchId } = await prepareDataForResolveRequest();

      const { status } = await dontMergeParties(userId, sessionId, matchId);
      expect(status).to.equal(200);
      const dbMatch = await mergeRepo.getMergePartyMatch(ctx, matchId);
      expect(dbMatch.resolvedBy).to.equal(userId);
      expect(dbMatch.resultPartyId).to.be.null;
    });
  });

  describe('when the user chooses to merge the parties', () => {
    const expectedPartyDataBeforeKeys = [
      'party',
      'members',
      'comms',
      'tasks',
      'activityLogs',
      'invOnHolds',
      'quotes',
      'promotions',
      'partyApplications',
      'personApplications',
      'invoices',
      'transactions',
    ];

    const partyApplicationData = {
      applicationData: {},
      maxApprovedAt: null,
      minDeniedAt: null,
    };

    const createPersonApplicationWithInvoice = async (personId, partyId, partyApplicationId) => {
      const personApplication = await createAPersonApplication({}, personId, partyId, partyApplicationId);
      await createAnApplicationInvoice({
        id: newId(),
        applicationFeeId: newId(),
        applicationFeeAmount: 43,
        personApplicationId: personApplication.id,
        partyApplicationId,
      });
    };

    const createDataForFirstParty = async (userId, partyId, memberId, personId) => {
      await createAnAppointment({
        partyId,
        salesPersonId: userId,
        partyMembers: [memberId],
      });
      const { id: partyApplicationId } = await createAPartyApplication(partyId, newId(), partyApplicationData);
      await createPersonApplicationWithInvoice(personId, partyId, partyApplicationId);
      await createAQuote(partyId);
      await createAQuotePromotion(partyId, DALTypes.PromotionStatus.APPROVED);
      await createACommunicationEntry({ parties: [partyId] });
      await createAnActivityLog(userId, partyId);
      await createAnActivityLog(userId, partyId);
    };

    const createDataForSecondParty = async (userId, partyId, memberId, commonPersonId) => {
      await createAnAppointment({
        partyId,
        salesPersonId: userId,
        partyMembers: [memberId],
      });
      const { id: person2Id } = await createAPerson();
      await createAPartyMember(partyId, { personId: person2Id, memberType: DALTypes.MemberType.RESIDENT });
      const party2Application = await createAPartyApplication(partyId, newId(), partyApplicationData);
      await createPersonApplicationWithInvoice(commonPersonId, partyId, party2Application.id);
      await createPersonApplicationWithInvoice(person2Id, partyId, party2Application.id);
      await createAQuote(partyId);
      await createAQuotePromotion(partyId, DALTypes.PromotionStatus.APPROVED);
      await createACommunicationEntry({ parties: [partyId] });
      await createACommunicationEntry({ parties: [partyId] });
      await createAnActivityLog(userId, partyId);
    };

    const checkExpectedForFirstParty = partyDataBeforeMerge => {
      expect(partyDataBeforeMerge).to.have.all.keys(expectedPartyDataBeforeKeys);
      expect(partyDataBeforeMerge.members.length).to.equal(1);
      expect(partyDataBeforeMerge.comms.length).to.equal(1);
      expect(partyDataBeforeMerge.tasks.length).to.equal(1);
      expect(partyDataBeforeMerge.quotes.length).to.equal(2);
      expect(partyDataBeforeMerge.promotions.length).to.equal(1);
      expect(partyDataBeforeMerge.activityLogs.length).to.equal(2);
      expect(partyDataBeforeMerge.invoices.length).to.equal(1);
      expect(partyDataBeforeMerge.partyApplications.length).to.equal(1);
      expect(partyDataBeforeMerge.personApplications.length).to.equal(1);
    };

    const checkExpectedForSecondParty = partyDataBeforeMerge => {
      expect(partyDataBeforeMerge).to.have.all.keys(expectedPartyDataBeforeKeys);
      expect(partyDataBeforeMerge.members.length).to.equal(2);
      expect(partyDataBeforeMerge.comms.length).to.equal(2);
      expect(partyDataBeforeMerge.tasks.length).to.equal(1);
      expect(partyDataBeforeMerge.quotes.length).to.equal(2);
      expect(partyDataBeforeMerge.promotions.length).to.equal(1);
      expect(partyDataBeforeMerge.activityLogs.length).to.equal(1);
      expect(partyDataBeforeMerge.invoices.length).to.equal(2);
      expect(partyDataBeforeMerge.partyApplications.length).to.equal(1);
      expect(partyDataBeforeMerge.personApplications.length).to.equal(2);
    };

    it.skip('should mark the party match as resolved by the auth user and the resultPartyId and dataBeforeMerge should not be null', async () => {
      const expectedMatchKeys = ['resultPartyId'];

      const expectedMergeChangesKeys = [
        'partyFields',
        'activityLogs',
        'comms',
        'tasks',
        'quotes',
        'members',
        'invoices',
        'promotions',
        'partyApplication',
        'personApplications',
        'partyApplicationDocuments',
        'mergedInventoriesOnHold',
      ];

      const { userId, sessionId, matchId, party: party1, party2, partyMember, party2Member } = await prepareDataForResolveRequest();

      await createDataForFirstParty(userId, party1.id, partyMember.id, partyMember.personId);
      await createDataForSecondParty(userId, party2.id, party2Member.id, partyMember.personId);

      const { status, body } = await mergeParties(userId, sessionId, matchId);
      expect(status).to.equal(200);
      expect(body).to.have.all.keys(expectedMatchKeys);
      const dbMatch = await mergeRepo.getMergePartyMatch(ctx, matchId);
      expect(dbMatch.resolvedBy).to.equal(userId);
      // party1 and party2 have the same state, so party1 should be considered the base party
      expect(dbMatch.resultPartyId).to.equal(party1.id);
      expect(dbMatch.mergeChanges).to.have.all.keys(expectedMergeChangesKeys);
      const { firstParty: firstPartyBeforeMerge, secondParty: secondPartyBeforeMerge } = dbMatch.dataBeforeMerge;
      checkExpectedForFirstParty(firstPartyBeforeMerge);
      checkExpectedForSecondParty(secondPartyBeforeMerge);
    });
  });

  it('should merge the teams and collaborators arrays', async () => {
    const { id: userId } = await createAUser();
    const property = await createAProperty();
    const person = await createAPerson();

    const createANewTeam = async id => {
      const team = await createATeam({
        name: `team-${id}`,
        module: 'leasing',
        email: `team-${id}@reva.tech`,
        phone: `1202555019${id}`,
      });
      return team.id;
    };

    const createANewUser = async () => {
      const user = await createAUser();
      return user.id;
    };

    const teams = [await createANewTeam(1), await createANewTeam(2), await createANewTeam(3)];
    const collaborators = [await createANewUser(), await createANewUser(), await createANewUser(), await createANewUser()];

    const party = await createAParty({
      userId,
      assignedPropertyId: property.id,
      teams: [teams[0], teams[1]],
      collaborators: [collaborators[0], collaborators[1]],
    });
    await createAPartyMember(party.id, { personId: person.id, memberType: DALTypes.MemberType.RESIDENT });

    const party2 = await createAParty({
      userId,
      assignedPropertyId: property.id,
      teams: [teams[0], teams[2]],
      collaborators: [collaborators[2], collaborators[3]],
      state: DALTypes.PartyStateType.LEASE,
    });
    await createAPartyMember(party2.id, { personId: person.id, memberType: DALTypes.MemberType.RESIDENT });

    const {
      body: { id: sessionId },
    } = await createMergeSession(DALTypes.MergePartyContext.PARTY, party.id);
    const {
      body: { matchId },
    } = await getNextMatch(sessionId);

    const { status } = await mergeParties(userId, sessionId, matchId);
    expect(status).to.equal(200);

    const resolvedMatch = await mergeRepo.getMergePartyMatch(ctx, matchId);
    const updatedParty = await loadParty(ctx, resolvedMatch.resultPartyId);
    expect(resolvedMatch.resultPartyId).to.equal(party2.id);
    expect(updatedParty.teams.sort()).to.deep.equal(teams.sort());
    expect(updatedParty.collaborators.sort()).to.deep.equal([...collaborators, userId].sort());
  });

  it('should merge the favourite units', async () => {
    const { userId, sessionId, matchId, party: party1, party2 } = await prepareDataForResolveRequest();
    const addFavoriteUnitToParty = async (partyId, favoriteUnits) => await updateParty(ctx, { id: partyId, metadata: { favoriteUnits } });

    const firstPartyFavoriteUnits = ['p1-unit-1-id', 'p1-unit-2-id', 'common-unit-id'];
    const secondPartyFavoriteUnits = ['p2-unit-1-id', 'p2-unit-2-id', 'common-unit-id'];
    await addFavoriteUnitToParty(party1.id, firstPartyFavoriteUnits);
    await addFavoriteUnitToParty(party2.id, secondPartyFavoriteUnits);

    const { status, body } = await mergeParties(userId, sessionId, matchId);
    expect(status).to.equal(200);
    const baseParty = await loadParty(ctx, body.resultPartyId);
    const expectedFavoriteUnits = [...new Set([...firstPartyFavoriteUnits, ...secondPartyFavoriteUnits])];
    expect(baseParty.metadata.favoriteUnits.sort()).to.deep.equal(expectedFavoriteUnits.sort());
  });

  describe('when the user chooses to merge the parties from the first possible match and another match exists', () => {
    it('should return a new match with firstPartyId set to resultPartyId from the previously resolved match', async () => {
      const { userId, person, property, sessionId, matchId, party } = await prepareDataForResolveRequest();

      const { status } = await mergeParties(userId, sessionId, matchId);

      expect(status).to.equal(200);
      const resolvedMatch = await mergeRepo.getMergePartyMatch(ctx, matchId);
      // party1 and party2 have the same state, so party1 should be considered the base party, since it has the latest updated_at
      expect(resolvedMatch.resultPartyId).to.equal(party.id);

      const party3 = await createAParty({ userId, assignedPropertyId: property.id });
      await createAPartyMember(party3.id, { personId: person.id, memberType: DALTypes.MemberType.RESIDENT });

      const {
        body: { firstParty, secondParty },
      } = await getNextMatch(sessionId);
      expect(firstParty.id).to.equal(party.id);
      expect(secondParty.id).to.equal(party3.id);
    });
  });

  describe("when the user chooses to don't merge the parties from the first possible match and another match exists", () => {
    it('should return a new match with firstPartyId set to firstPartyId from from the previously resolved match', async () => {
      const { userId, person, property, sessionId, matchId, party } = await prepareDataForResolveRequest();

      const { status } = await dontMergeParties(userId, sessionId, matchId);
      expect(status).to.equal(200);
      const firstMatch = await mergeRepo.getMergePartyMatch(ctx, matchId);
      expect(firstMatch.resolvedBy).to.equal(userId);
      expect(firstMatch.resultPartyId).to.be.null;

      const party3 = await createAParty({ userId, assignedPropertyId: property.id });
      await createAPartyMember(party3.id, { personId: person.id, memberType: DALTypes.MemberType.RESIDENT });

      const {
        body: { firstParty, secondParty },
      } = await getNextMatch(sessionId);
      expect(firstParty.id).to.equal(party.id);
      expect(secondParty.id).to.equal(party3.id);
    });
  });

  describe('when both parties have two members each and one person is common', () => {
    it('should copy a party member to the result party', async () => {
      const { userId, sessionId, matchId, party, party2 } = await prepareDataForResolveRequest();

      const newPersonForParty1 = await createAPerson();
      await createAPartyMember(party.id, { personId: newPersonForParty1.id });
      const newPersonForParty2 = await createAPerson();
      await createAPartyMember(party2.id, { personId: newPersonForParty2.id });

      const { status, body } = await mergeParties(userId, sessionId, matchId);
      expect(status).to.equal(200);
      const baseParty = await loadParty(ctx, body.resultPartyId);
      expect(baseParty.partyMembers.length).to.equal(3);
      // the members from merged party should be copied, not moved
      const mergedPartyId = body.resultPartyId === party.id ? party2.id : party.id;
      const mergedParty = await loadParty(ctx, mergedPartyId);
      expect(mergedParty.partyMembers.length).to.equal(2);
    });
  });

  describe('when both parties have two common members but one is inactive in the merged party', () => {
    it('should contain both members in the result party', async () => {
      const { userId, sessionId, matchId, party, party2 } = await prepareDataForResolveRequest();

      const newPerson = await createAPerson('Inactive Person for merge in merged');
      await createAPartyMember(party.id, { personId: newPerson.id });
      const pm2 = await createAPartyMember(party2.id, { personId: newPerson.id });
      await markMemberAsRemoved(ctx, pm2.id);

      const { status, body } = await mergeParties(userId, sessionId, matchId);
      expect(status).to.equal(200);
      expect(body.resultPartyId).to.equal(party.id);
      const basePartyMembersAfterMerge = await mergeRepo.getAllPartyMembers(ctx, party.id, true);
      expect(basePartyMembersAfterMerge.length).to.equal(2);
      const newPersonPm = basePartyMembersAfterMerge.find(pm => pm.personId === newPerson.id);
      expect(newPersonPm.endDate).to.be.null;
    });
  });

  describe('when both parties have two common members but one is inactive in the base party', () => {
    it('should contain both members in the result party', async () => {
      const { userId, sessionId, matchId, party, party2 } = await prepareDataForResolveRequest();

      const newPerson = await createAPerson('Inactive Person for merge in base');
      const pm1 = await createAPartyMember(party.id, { personId: newPerson.id });
      await markMemberAsRemoved(ctx, pm1.id);
      await createAPartyMember(party2.id, { personId: newPerson.id });
      const basePartyMembersBeforeMerge = await mergeRepo.getAllPartyMembers(ctx, party.id, true);
      const pmThatIsInactiveForPerson = basePartyMembersBeforeMerge.find(pm => pm.personId === newPerson.id);
      const { status, body } = await mergeParties(userId, sessionId, matchId);
      expect(status).to.equal(200);
      expect(body.resultPartyId).to.equal(party.id);

      const basePartyMembersAfterMerge = await mergeRepo.getAllPartyMembers(ctx, party.id, true);

      expect(basePartyMembersAfterMerge.length).to.equal(3);
      // we have 3 party members at this stage
      // one active that was the base person created through prepareDataForResolveRequest
      // one inactive for party 1 for newPerson
      // one active for new person that came through the merge from the merged party
      const newPersonPm = basePartyMembersAfterMerge.find(pm => pm.personId === newPerson.id && pm.id !== pmThatIsInactiveForPerson.id);
      expect(newPersonPm.endDate).to.be.null;
    });
  });

  describe('when the base party has a lease and the merge party does not', () => {
    describe('when all the members from the merged party are also members in the base party', () => {
      it('should allow the merge to happen', async () => {
        const { party, userId, promotedQuote, property } = await createLeaseTestData();
        const person = await createAPerson();
        const secondPerson = await createAPerson();

        await createLease(party.id, userId, promotedQuote.id);
        await createAPartyMember(party.id, { personId: person.id });
        await createAPartyMember(party.id, { personId: secondPerson.id });

        const { id: party2Id } = await createAParty({ userId, assignedPropertyId: property.id });
        await createAPartyMember(party2Id, { personId: person.id });

        const {
          body: { id: sessionId },
        } = await createMergeSession(DALTypes.MergePartyContext.PARTY, party.id);
        const {
          body: { matchId },
        } = await getNextMatch(sessionId);

        const { status, body } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);
        const baseParty = await loadParty(ctx, body.resultPartyId);
        expect(baseParty.partyMembers.length).to.equal(4);
        const mergedPartyId = body.resultPartyId === party.id ? party2Id : party.id;
        const mergedParty = await loadParty(ctx, mergedPartyId);
        expect(mergedParty.partyMembers.every(pm => baseParty.partyMembers.some(pm2 => pm2.personId === pm.personId)));
      });
    });
    describe('when not all the members from the merged party are in the base party', () => {
      it('should return the isMergeConflict key as equal to true', async () => {
        const { party, userId, promotedQuote, property } = await createLeaseTestData();
        const { id: personId } = await createAPerson();
        const { id: secondPersonId } = await createAPerson();

        await createLease(party.id, userId, promotedQuote.id);
        await createAPartyMember(party.id, { personId });

        const { id: party2Id } = await createAParty({ userId, assignedPropertyId: property.id });
        await createAPartyMember(party2Id, { personId });
        await createAPartyMember(party2Id, { secondPersonId });

        const updatedParty = await updateParty(ctx, party);

        const {
          body: { id: sessionId },
        } = await createMergeSession(DALTypes.MergePartyContext.PARTY, updatedParty.id);

        const { body } = await getNextMatch(sessionId);
        expect(body.isMergeConflict).to.be.true;
      });
    });
  });

  describe('when some members have guarantors', () => {
    describe('when the same person is guarantor in both parties', () => {
      it('should associate the resident from the merged party with the guarantor from the target party', async () => {
        const { id: userId } = await createAUser();
        const property = await createAProperty();
        const person = await createAPerson();

        const party2 = await createAParty({ userId, assignedPropertyId: property.id });
        const party2Guarantor = await createAPartyMember(party2.id, { personId: person.id, memberType: DALTypes.MemberType.GUARANTOR });
        const party2Person = await createAPerson();
        await createAPartyMember(party2.id, {
          personId: party2Person.id,
          memberType: DALTypes.MemberType.RESIDENT,
          guaranteedBy: party2Guarantor.id,
        });

        const party = await createAParty({ userId, assignedPropertyId: property.id });
        const partyGuarantor = await createAPartyMember(party.id, { personId: person.id, memberType: DALTypes.MemberType.GUARANTOR });
        const partyPerson = await createAPerson();
        await createAPartyMember(party.id, {
          personId: partyPerson.id,
          memberType: DALTypes.MemberType.RESIDENT,
          guaranteedBy: partyGuarantor.id,
        });

        const {
          body: { id: sessionId },
        } = await createMergeSession(DALTypes.MergePartyContext.PARTY, party.id);
        const {
          body: { matchId },
        } = await getNextMatch(sessionId);
        const { status, body } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);
        const baseParty = await loadParty(ctx, body.resultPartyId);
        expect(baseParty.partyMembers.length).to.equal(3);
        const basePartyResidents = baseParty.partyMembers.filter(m => m.memberType === DALTypes.MemberType.RESIDENT);
        basePartyResidents.forEach(r => expect(r.guaranteedBy).to.equal(partyGuarantor.id));
      });
    });

    describe('when the same person is resident in both parties', () => {
      it('should keep the common resident associated with the guarantor from the base party and copy the guarantor from the merged party to the base party', async () => {
        const { id: userId } = await createAUser();
        const property = await createAProperty();
        const person = await createAPerson();

        const party2 = await createAParty({ userId, assignedPropertyId: property.id });
        const party2Person = await createAPerson();
        const party2Guarantor = await createAPartyMember(party2.id, { personId: party2Person.id, memberType: DALTypes.MemberType.GUARANTOR });
        await createAPartyMember(party2.id, {
          personId: person.id,
          memberType: DALTypes.MemberType.RESIDENT,
          guaranteedBy: party2Guarantor.id,
        });

        const party = await createAParty({ userId, assignedPropertyId: property.id });
        const partyPerson = await createAPerson();
        const partyGuarantor = await createAPartyMember(party.id, { personId: partyPerson.id, memberType: DALTypes.MemberType.GUARANTOR });
        await createAPartyMember(party.id, {
          personId: person.id,
          memberType: DALTypes.MemberType.RESIDENT,
          guaranteedBy: partyGuarantor.id,
        });

        const {
          body: { id: sessionId },
        } = await createMergeSession(DALTypes.MergePartyContext.PARTY, party.id);
        const {
          body: { matchId },
        } = await getNextMatch(sessionId);
        const { status, body } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);
        const baseParty = await loadParty(ctx, body.resultPartyId);
        expect(baseParty.partyMembers.length).to.equal(3);
        const basePartyResidents = baseParty.partyMembers.filter(m => m.memberType === DALTypes.MemberType.RESIDENT);
        expect(basePartyResidents.length).to.equal(1);
        expect(basePartyResidents[0].guaranteedBy).to.equal(partyGuarantor.id);
        const basePartyGuarantors = baseParty.partyMembers.filter(m => m.memberType === DALTypes.MemberType.GUARANTOR);
        expect(basePartyGuarantors.length).to.equal(2);
      });
    });

    describe('when the same person is resident in both parties, but has an associated guarantor only in the merged party', () => {
      it('should keep the resident from the base party, copy the guarantor to the base party and associate the resident to the copied guarantor', async () => {
        const { id: userId } = await createAUser();
        const property = await createAProperty();
        const person = await createAPerson();

        const party2 = await createAParty({ userId, assignedPropertyId: property.id });
        const party2Person = await createAPerson();
        const party2Guarantor = await createAPartyMember(party2.id, { personId: party2Person.id, memberType: DALTypes.MemberType.GUARANTOR });
        await createAPartyMember(party2.id, {
          personId: person.id,
          memberType: DALTypes.MemberType.RESIDENT,
          guaranteedBy: party2Guarantor.id,
        });

        const party = await createAParty({ userId, assignedPropertyId: property.id });
        const partyMember = await createAPartyMember(party.id, {
          personId: person.id,
          memberType: DALTypes.MemberType.RESIDENT,
        });

        const {
          body: { id: sessionId },
        } = await createMergeSession(DALTypes.MergePartyContext.PARTY, party.id);
        const {
          body: { matchId },
        } = await getNextMatch(sessionId);
        const { status, body } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);
        const baseParty = await loadParty(ctx, body.resultPartyId);
        expect(baseParty.partyMembers.length).to.equal(2);
        const basePartyGuarantors = baseParty.partyMembers.filter(m => m.memberType === DALTypes.MemberType.GUARANTOR);
        expect(basePartyGuarantors.length).to.equal(1);
        const basePartyResidents = baseParty.partyMembers.filter(m => m.memberType === DALTypes.MemberType.RESIDENT);
        expect(basePartyResidents.length).to.equal(1);
        expect(basePartyResidents[0].id).to.equal(partyMember.id);
        expect(basePartyResidents[0].guaranteedBy).to.equal(basePartyGuarantors[0].id);
      });
    });

    describe('when the common person is guarantor in the target party and resident in the merged party', () => {
      it('should set the member as resident in the target party and break the link between the members from target party', async () => {
        const { id: userId } = await createAUser();
        const property = await createAProperty();
        const commonPerson = await createAPerson();

        const party2 = await createAParty({ userId, assignedPropertyId: property.id });
        const party = await createAParty({ userId, assignedPropertyId: property.id }); // make sure this party has the latest updated_at to be determined as base
        const partyGuarantor = await createAPartyMember(party.id, { personId: commonPerson.id, memberType: DALTypes.MemberType.GUARANTOR });
        const party2Person = await createAPerson();
        const partyResident = await createAPartyMember(party.id, {
          personId: party2Person.id,
          memberType: DALTypes.MemberType.RESIDENT,
          guaranteedBy: partyGuarantor.id,
        });
        await createAPartyMember(party2.id, { personId: commonPerson.id, memberType: DALTypes.MemberType.RESIDENT });

        const {
          body: { id: sessionId },
        } = await createMergeSession(DALTypes.MergePartyContext.PARTY, party.id);
        const {
          body: { matchId },
        } = await getNextMatch(sessionId);
        const { status, body } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);
        const baseParty = await loadParty(ctx, body.resultPartyId);
        const basePartyMembers = baseParty.partyMembers;
        expect(basePartyMembers.length).to.equal(2);
        expect(basePartyMembers.find(m => m.id === partyGuarantor.id).memberType === DALTypes.MemberType.RESIDENT);
        expect(basePartyMembers.find(m => m.id === partyResident.id).guaranteedBy).to.be.null;
      });
    });

    describe('when the same person is resident in the target party and guarantor in the merged party', () => {
      it('should keep him as resident in the target party and break the link between him and the resident copied from the merged party', async () => {
        const { id: userId } = await createAUser();
        const property = await createAProperty();
        const commonPerson = await createAPerson();

        const party = await createAParty({ userId, assignedPropertyId: property.id });
        await createAPartyMember(party.id, { personId: commonPerson.id, memberType: DALTypes.MemberType.RESIDENT });

        const party2 = await createAParty({ userId, assignedPropertyId: property.id });
        const party2Guarantor = await createAPartyMember(party2.id, { personId: commonPerson.id, memberType: DALTypes.MemberType.GUARANTOR });
        const party2Person = await createAPerson();
        await createAPartyMember(party2.id, {
          personId: party2Person.id,
          memberType: DALTypes.MemberType.RESIDENT,
          guaranteedBy: party2Guarantor.id,
        });

        const {
          body: { id: sessionId },
        } = await createMergeSession(DALTypes.MergePartyContext.PARTY, party.id);
        const {
          body: { matchId },
        } = await getNextMatch(sessionId);
        const { status, body } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);
        const baseParty = await loadParty(ctx, body.resultPartyId);
        expect(baseParty.partyMembers.length).to.equal(2);
        baseParty.partyMembers.forEach(r => expect(r.memberType).to.equal(DALTypes.MemberType.RESIDENT));
        baseParty.partyMembers.forEach(r => expect(r.guaranteedBy).to.be.null);
      });
    });
  });

  describe('when both parties have tasks', () => {
    it('should move all appointments and manual tasks to the result party', async () => {
      const { userId, sessionId, matchId, party, party2, partyMember, party2Member } = await prepareDataForResolveRequest();

      await createAnAppointment({
        partyId: party.id,
        salesPersonId: userId,
        partyMembers: [partyMember.id],
      });

      createAnAppointment({
        partyId: party2.id,
        salesPersonId: userId,
        partyMembers: [party2Member.id],
      });

      const party2ManualTask = {
        name: 'Manual task',
        category: DALTypes.TaskCategories.MANUAL,
        partyId: party2.id,
        userIds: [userId],
      };
      await createATask(party2ManualTask);

      const { status } = await mergeParties(userId, sessionId, matchId);
      expect(status).to.equal(200);

      const resolvedMatch = await mergeRepo.getMergePartyMatch(ctx, matchId);
      const resultPartyTasks = await getTasksByPartyIds(ctx, [resolvedMatch.resultPartyId]);
      expect(resultPartyTasks.length).to.equal(3);
    });
  });

  // This test fails because the created party is not assigned to a team, which causes the
  // team reassignment to fail
  describe.skip('when both parties have tasks', () => {
    describe('when the old party owner has calendar integration but the new one does not', () => {
      it('should move all appointments and manual tasks to the result party', async () => {
        const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId: newId() } };
        await toggleExtCalendarFeature(true);
        const { id: userId } = await createAUser();
        const { id: userId2 } = await createAUser(userParams);
        const property = await createAProperty();
        const person = await createAPerson();

        const qualificationQuestions = {
          moveInTime: 'NEXT_2_MONTHS',
          numBedrooms: ['ONE_BED'],
          groupProfile: 'COUPLE_OR_FAMILY',
          cashAvailable: 'YES',
        };

        const storedUnitsFilters = {
          moveInDate: { max: '2017-10-30', min: '2017-09-30' },
          numBedrooms: ['ONE_BED'],
        };

        const party2 = await createAParty({ userId: userId2, assignedPropertyId: property.id, qualificationQuestions });
        const party2Member = await createAPartyMember(party2.id, { personId: person.id, memberType: DALTypes.MemberType.RESIDENT });

        const party = await createAParty({ userId, assignedPropertyId: property.id, storedUnitsFilters });
        const partyMember = await createAPartyMember(party.id, { personId: person.id, memberType: DALTypes.MemberType.RESIDENT });

        const {
          body: { id: sessionId },
        } = await createMergeSession(DALTypes.MergePartyContext.PARTY, party.id);

        const {
          body: { matchId },
        } = await getNextMatch(sessionId);

        await createAnAppointment({
          partyId: party.id,
          salesPersonId: userId,
          partyMembers: [partyMember.id],
        });

        createAnAppointment({
          partyId: party2.id,
          salesPersonId: userId2,
          partyMembers: [party2Member.id],
        });

        const party2ManualTask = {
          name: 'Manual task',
          category: DALTypes.TaskCategories.MANUAL,
          partyId: party2.id,
          userIds: [userId2],
        };
        await createATask(party2ManualTask);

        const { status } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);

        const resolvedMatch = await mergeRepo.getMergePartyMatch(ctx, matchId);
        const resultPartyTasks = await getTasksByPartyIds(ctx, [resolvedMatch.resultPartyId]);
        expect(resultPartyTasks.length).to.equal(3);

        const task1 = resultPartyTasks[0];
        const task2 = resultPartyTasks[1];
        const task3 = resultPartyTasks[2];

        expect(task1.userIds.length).to.equal(1);
        expect(task2.userIds.length).to.equal(1);
        expect(task3.userIds.length).to.equal(1);

        expect(task1.userIds[0]).to.equal(userId);
        expect(task2.userIds[0]).to.equal(userId);
        expect(task3.userIds[0]).to.equal(userId);
      });
    });
  });

  describe('when both parties have comms', () => {
    it('should move all comms to the result party', async () => {
      const { userId, sessionId, matchId, party, party2 } = await prepareDataForResolveRequest();

      await createACommunicationEntry({ parties: [party.id] });
      await createACommunicationEntry({ parties: [party2.id] });

      const { status } = await mergeParties(userId, sessionId, matchId);
      expect(status).to.equal(200);

      const resolvedMatch = await mergeRepo.getMergePartyMatch(ctx, matchId);
      const resultPartyComms = await loadCommunicationsByPartyIds(ctx, [resolvedMatch.resultPartyId]);
      expect(resultPartyComms.length).to.equal(2);

      const resultPartyUnreadComms = await getUnreadCommunicationsByPartyId(ctx, resolvedMatch.resultPartyId);
      expect(resultPartyUnreadComms.length).to.equal(2);
    });
  });

  describe('when both parties have unread comms', () => {
    it('should move all comms to the result party, except the common ones', async () => {
      const { userId, sessionId, matchId, party, party2 } = await prepareDataForResolveRequest();

      await createACommunicationEntry({ parties: [party.id, party2.id] });
      await createACommunicationEntry({ parties: [party.id] });
      await createACommunicationEntry({ parties: [party2.id] });

      const { status } = await mergeParties(userId, sessionId, matchId);
      expect(status).to.equal(200);

      const resolvedMatch = await mergeRepo.getMergePartyMatch(ctx, matchId);

      const resultPartyComms = await loadCommunicationsByPartyIds(ctx, [resolvedMatch.resultPartyId]);
      expect(resultPartyComms.length).to.equal(3);

      const resultPartyUnreadComms = await getUnreadCommunicationsByPartyId(ctx, resolvedMatch.resultPartyId);
      expect(resultPartyUnreadComms.length).to.equal(3);

      const mergedPartyId = resolvedMatch.resultPartyId === resolvedMatch.firstPartyId ? resolvedMatch.secondPartyId : resolvedMatch.firstPartyId;

      const mergedPartyUnreadComms = await getUnreadCommunicationsByPartyId(ctx, mergedPartyId);
      expect(mergedPartyUnreadComms.length).to.equal(0);
    });
  });

  describe('when the first party has qualificationQuestions and the second one has units filters', () => {
    it('should move unit filters and qualification qustions to result party', async () => {
      const { userId, sessionId, matchId, qualificationQuestions, storedUnitsFilters, property } = await prepareDataForResolveRequest();

      const { status } = await mergeParties(userId, sessionId, matchId);
      expect(status).to.equal(200);

      const resolvedMatch = await mergeRepo.getMergePartyMatch(ctx, matchId);
      const updatedParty = await loadParty(ctx, resolvedMatch.resultPartyId);
      expect(updatedParty.qualificationQuestions).to.deep.equal(qualificationQuestions);
      // property is added in partyRepo.createParty function
      expect(updatedParty.storedUnitsFilters).to.deep.equal({ ...storedUnitsFilters, propertyIds: [property.id] });
    });
  });

  describe('when the target party is the younger party', () => {
    it('should overwrite (firstContactedDate, firstContactChannel, programId, source) from target party with the ones from merged party', async () => {
      const { id: userId } = await createAUser();
      const property = await createAProperty();
      const person = await createAPerson();
      const team = await createATeam();

      const getPartyMetadata = id => ({
        firstContactedDate: `party-${id}-date`,
        firstContactChannel: `party-${id}-contact-channel`,
        programId: `party-${id}-program`,
        source: `party-${id}-sources`,
        creationType: `party-${id}-creation-type`,
      });

      const party = await createAParty({
        userId,
        ownerTeam: team.id,
        assignedPropertyId: property.id,
        metadata: getPartyMetadata(1),
      });
      await createAPartyMember(party.id, { personId: person.id, memberType: DALTypes.MemberType.RESIDENT });

      const party2 = await createAParty({
        userId,
        assignedPropertyId: property.id,
        ownerTeam: team.id,
        metadata: getPartyMetadata(2),
        state: DALTypes.PartyStateType.LEASE,
      });
      await createAPartyMember(party2.id, { personId: person.id, memberType: DALTypes.MemberType.RESIDENT });

      const {
        body: { id: sessionId },
      } = await createMergeSession(DALTypes.MergePartyContext.PARTY, party.id);
      const {
        body: { matchId },
      } = await getNextMatch(sessionId);

      const { status } = await mergeParties(userId, sessionId, matchId);
      expect(status).to.equal(200);

      const resolvedMatch = await mergeRepo.getMergePartyMatch(ctx, matchId);
      const updatedParty = await loadParty(ctx, resolvedMatch.resultPartyId);
      expect(resolvedMatch.resultPartyId).to.equal(party2.id);
      expect(updatedParty.metadata).to.deep.equal({
        ...getPartyMetadata(1),
        firstCollaborator: userId,
        originalTeam: team.id,
      });
    });
  });

  describe('when both parties have quotes', () => {
    describe('when both quotes are unpromoted', () => {
      it('should move the quote from the merged party to the base party', async () => {
        const { userId, sessionId, matchId, party, party2 } = await prepareDataForResolveRequest();

        await createAQuote(party.id);
        await createAQuote(party2.id);

        const { status, body } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);
        const quotes = await getQuotesByPartyId(ctx, body.resultPartyId);
        expect(quotes.length).to.equal(2);
      });
    });

    describe('when only the quote from the base party is promoted', () => {
      it('should move the unpromoted quote from the merged party to the base party', async () => {
        const { userId, sessionId, matchId, party, party2 } = await prepareDataForResolveRequest();

        await createAQuotePromotion(party.id, DALTypes.PromotionStatus.APPROVED);
        await createAQuote(party2.id);

        const { status, body } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);
        const quotes = await getQuotesByPartyId(ctx, body.resultPartyId);
        expect(quotes.length).to.equal(2);
      });
    });

    describe('when only the quote from the merged party is promoted', () => {
      it('should move the promoted quote from the merged party to the base party', async () => {
        const { userId, sessionId, matchId, party, party2 } = await prepareDataForResolveRequest();

        await createAQuote(party.id);
        await createAQuotePromotion(party2.id, DALTypes.PromotionStatus.APPROVED);

        const { status, body } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);
        const quotes = await getQuotesByPartyId(ctx, body.resultPartyId);
        expect(quotes.length).to.equal(2);
        const quotePromotions = await getAllQuotePromotionsByPartyId(ctx, party.id);
        expect(quotePromotions.length).to.equal(1);
        expect(quotePromotions[0].partyId).to.equal(party.id);
      });
    });

    it('should move the inventory on hold of the promoted quote from the merged party to the base party', async () => {
      const { userId, sessionId, matchId, party, party2 } = await prepareDataForResolveRequest();
      const inventory = await createAnInventory();
      const quoteData = {
        inventoryId: inventory.id,
        publishedQuoteData: {
          leaseTerms: [{ termLength: 12 }],
          publishDate: new Date(),
          expirationDate: new Date(),
          leaseStartDate: new Date(),
          additionalAndOneTimeCharges: {
            oneTimeCharges: [],
            additionalCharges: [],
          },
        },
      };

      await createAQuote(party.id);
      const mergedPartyQuote = await createAQuote(party2.id, quoteData);
      await createAQuotePromotion(party2.id, DALTypes.PromotionStatus.APPROVED, mergedPartyQuote.id);
      await createAnInventoryOnHold(inventory.id, party2.id, userId);

      const { status, body } = await mergeParties(userId, sessionId, matchId);
      expect(status).to.equal(200);

      const mergedPartyId = body.resultPartyId === party.id ? party2.id : party.id;

      const inventoriesOnHoldMergedParty = await getInventoriesOnHoldByParty(ctx, mergedPartyId);
      expect(inventoriesOnHoldMergedParty.length).to.equal(0);

      const inventoriesOnHoldOnBaseParty = await getInventoriesOnHoldByParty(ctx, body.resultPartyId);
      expect(inventoriesOnHoldOnBaseParty.length).to.equal(1);
    });

    describe('when quotes from both parties are promoted', () => {
      it('should move the quote and the promotion, but the promotion should be marked as CANCELED', async () => {
        const { userId, sessionId, matchId, party, party2 } = await prepareDataForResolveRequest();

        const party1QuotePromotion = await createAQuotePromotion(party.id, DALTypes.PromotionStatus.APPROVED);
        const party2QuotePromotion = await createAQuotePromotion(party2.id, DALTypes.PromotionStatus.APPROVED);

        const { status, body } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);
        const quotes = await getQuotesByPartyId(ctx, body.resultPartyId);
        expect(quotes.length).to.equal(2);
        const matchQuotePromotion = quotes.some(({ id }) => id === party1QuotePromotion.quoteId);
        expect(matchQuotePromotion).to.equal(true);
        const quotePromotions = await getAllQuotePromotionsByPartyId(ctx, party.id);
        expect(quotePromotions.length).to.equal(2);
        quotePromotions.forEach(promo => expect(promo.partyId).to.equal(party.id));
        const party2PromotionAfterMerge = quotePromotions.find(p => p.id === party2QuotePromotion.id);
        expect(party2PromotionAfterMerge.promotionStatus === DALTypes.PromotionStatus.CANCELED);
      });
    });
  });

  describe('when one or both parties are in application state', () => {
    const partyApplicationData = {
      applicationData: {},
      maxApprovedAt: null,
      minDeniedAt: null,
    };

    describe('when one person has an application just in merged party', () => {
      it('should copy the person application from merged party to base party', async () => {
        const { userId, sessionId, matchId, party, party2, partyMember } = await prepareDataForResolveRequest();

        const person2 = await createAPerson();
        await createAPartyMember(party.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });
        await createAPartyMember(party2.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });

        const partyApplication = await createAPartyApplication(party.id, newId(), partyApplicationData);
        const party2Application = await createAPartyApplication(party2.id, newId(), partyApplicationData);
        await createAPersonApplication({}, partyMember.personId, party.id, partyApplication.id);
        await createAPersonApplication({}, person2.id, party2.id, party2Application.id);

        const { status, body } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);
        const personApplications = await mergeRepo.getPersonApplicationsByPartyId(ctx, body.resultPartyId);
        expect(personApplications.length).to.equal(2);
        const { id: partyApplicationId } = await mergeRepo.getPartyApplicationByPartyId(ctx, body.resultPartyId);
        expect(personApplications[0].partyApplicationId).to.be.equal(partyApplicationId);
        expect(personApplications[1].partyApplicationId).to.be.equal(partyApplicationId);
      });
      describe('when one person has a more advanced application in merged party', () => {
        it('should update the application data to the base party', async () => {
          const { userId, sessionId, matchId, party: party1, party2, partyMember } = await prepareDataForResolveRequest();

          const person1Id = partyMember.personId;
          const { id: person2Id } = await createAPerson();
          await createAPartyMember(party1.id, { personId: person2Id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party2.id, { personId: person2Id, memberType: DALTypes.MemberType.RESIDENT });

          const party1Application = await createAPartyApplication(party1.id, newId(), partyApplicationData);
          const party2Application = await createAPartyApplication(party2.id, newId(), partyApplicationData);

          const personsApplicationData = {};
          personsApplicationData[person1Id] = {
            firstName: 'Jon',
            lastName: 'Doe',
            address: { enteredByUser: { unparsedAddress: '' } },
            dateOfBirth: 'Invalid date',
          };
          personsApplicationData[person2Id] = {
            firstName: 'Maria',
            lastName: 'Doe',
            address: { enteredByUser: { unparsedAddress: '' } },
            dateOfBirth: 'Invalid date',
          };

          const paymentCompleted = true;
          const party1Person1Application = await createAPersonApplication(
            personsApplicationData[person1Id],
            person1Id,
            party1.id,
            party1Application.id,
            paymentCompleted,
          );
          await mergeRepo.updatePersonApplication(ctx, { ...party1Person1Application, applicationStatus: DALTypes.PersonApplicationStatus.COMPLETED });
          await createAPersonApplication({}, person2Id, party1.id, party1Application.id);

          await createAPersonApplication({}, person1Id, party2.id, party2Application.id);
          const party2Person2Application = await createAPersonApplication(
            personsApplicationData[person2Id],
            person2Id,
            party2.id,
            party2Application.id,
            paymentCompleted,
          );
          await mergeRepo.updatePersonApplication(ctx, { ...party2Person2Application, applicationStatus: DALTypes.PersonApplicationStatus.PAID });

          const { status, body } = await mergeParties(userId, sessionId, matchId);
          expect(status).to.equal(200);
          const personApplications = await mergeRepo.getPersonApplicationsByPartyId(ctx, body.resultPartyId);
          expect(personApplications.length).to.equal(2);
          const personsApplicationStatusResult = {
            [person1Id]: DALTypes.PersonApplicationStatus.COMPLETED,
            [person2Id]: DALTypes.PersonApplicationStatus.PAID,
          };
          personApplications.forEach(ap => {
            expect(ap.applicationData).to.deep.equal(personsApplicationData[ap.personId]);
            expect(ap.paymentCompleted).to.be.true;
            expect(ap.applicationStatus).to.be.equal(personsApplicationStatusResult[ap.personId]);
          });
        });
      });
      describe('when one person has a paid application in merged party and an open application in base party', () => {
        it('should update the application to paid status in base party, move the invoice and trigger screening', async () => {
          const { userId, sessionId, matchId, party, party2, partyMember } = await prepareDataForResolveRequest();

          const person2 = await createAPerson();
          await createAPartyMember(party.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party2.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });

          const party1Application = await createAPartyApplication(party.id, newId(), partyApplicationData);
          const party2Application = await createAPartyApplication(party2.id, newId(), partyApplicationData);

          const paymentCompleted = true;
          await createAPersonApplication({}, partyMember.personId, party.id, party1Application.id);
          await createAPersonApplication(applicationData, person2.id, party.id, party1Application.id, paymentCompleted);

          const personApplication = await createAPersonApplication(applicationData, partyMember.personId, party2.id, party2Application.id, paymentCompleted);
          await createAnApplicationInvoice({
            id: newId(),
            applicationFeeId: newId(),
            applicationFeeAmount: 43,
            personApplicationId: personApplication.id,
            partyApplicationId: party2Application.id,
          });

          await createAPersonApplication({}, person2.id, party2.id, party2Application.id);

          await createAPublishedQuote(party.id);

          const condition = msg => msg.partyId === party.id;
          const { task: screeningMessageTask } = await setupQueueToWaitFor([condition], ['screening']);

          const { status, body } = await mergeParties(userId, sessionId, matchId);
          await screeningMessageTask;

          expect(status).to.equal(200);
          const personApplications = await mergeRepo.getPersonApplicationsByPartyId(ctx, body.resultPartyId);
          expect(personApplications.length).to.equal(2);
          expect(personApplications[0].paymentCompleted).to.be.true;
          expect(personApplications[1].paymentCompleted).to.be.true;
          const screenings = await getAllScreeningRequestsForParty(ctx, body.resultPartyId);
          expect(screenings.length).to.equal(2);
        });
      });

      describe('when one person has a paid application without an invoice in merged party and an open application in base party', () => {
        it('should update the application to paid status in base party and copy the invoice', async () => {
          const { userId, sessionId, matchId, party, party2, partyMember } = await prepareDataForResolveRequest();

          const person2 = await createAPerson();
          await createAPartyMember(party.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party2.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });

          const party1Application = await createAPartyApplication(party.id, newId(), partyApplicationData);
          const party2Application = await createAPartyApplication(party2.id, newId(), partyApplicationData);

          const paymentCompleted = true;

          await createAPersonApplication({}, partyMember.personId, party.id, party1Application.id);

          const personApplication = await createAPersonApplication(applicationData, partyMember.personId, party2.id, party2Application.id, paymentCompleted);
          await createAnApplicationInvoice({
            id: newId(),
            applicationFeeId: newId(),
            applicationFeeAmount: 43,
            personApplicationId: personApplication.id,
            partyApplicationId: party2Application.id,
          });

          await createAPersonApplication(applicationData, person2.id, party.id, party1Application.id, paymentCompleted);
          await mergeRepo.updatePersonApplication(ctx, { ...personApplication, endedAsMergedAt: now().toDate() });

          const { status, body } = await mergeParties(userId, sessionId, matchId);

          expect(status).to.equal(200);
          const personApplications = await mergeRepo.getPersonApplicationsByPartyId(ctx, body.resultPartyId);
          expect(personApplications.length).to.equal(2);
          const firstPersonApps = personApplications.filter(application => application.personId === partyMember.personId);
          const secondPersonApps = personApplications.filter(application => application.personId === person2.id);

          expect(firstPersonApps[0].paymentCompleted).to.be.false;
          expect(secondPersonApps[0].paymentCompleted).to.be.true;
        });
      });

      describe('when two parties are merged and a person has two open applications', () => {
        it('should mark the least advanced one as endedAsMergedAt', async () => {
          const { id: userId } = await createAUser();
          const property = await createAProperty();

          const person1 = await createAPerson();
          const person2 = await createAPerson();
          const person3 = await createAPerson();

          const qualificationQuestions = {
            moveInTime: 'NEXT_2_MONTHS',
            numBedrooms: ['ONE_BED'],
            groupProfile: 'COUPLE_OR_FAMILY',
            cashAvailable: 'YES',
          };

          const storedUnitsFilters = {
            moveInDate: { max: '2017-10-30', min: '2017-09-30' },
            numBedrooms: ['ONE_BED'],
          };

          const party1 = await createAParty({ userId, assignedPropertyId: property.id, storedUnitsFilters });
          const party2 = await createAParty({ userId, assignedPropertyId: property.id, qualificationQuestions });

          await createAPartyMember(party1.id, { personId: person1.id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party1.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });

          await createAPartyMember(party2.id, { personId: person1.id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party2.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party2.id, { personId: person3.id, memberType: DALTypes.MemberType.RESIDENT });

          const party1Application = await createAPartyApplication(party1.id, newId(), partyApplicationData);
          const party2Application = await createAPartyApplication(party2.id, newId(), partyApplicationData);

          const paymentCompleted = true;

          await createAPersonApplication({}, person1.id, party1.id, party1Application.id);
          await createAPersonApplication({}, person2.id, party1.id, party1Application.id);

          const personApplicationParty2Member1 = await createAPersonApplication({}, person1.id, party2.id, party2Application.id);
          await mergeRepo.updatePersonApplication(ctx, {
            ...personApplicationParty2Member1,
            paymentCompleted,
            applicationStatus: DALTypes.PersonApplicationStatus.PAID,
          });
          const personApplicationParty2Member2 = await createAPersonApplication({}, person2.id, party2.id, party2Application.id);
          await mergeRepo.updatePersonApplication(ctx, {
            ...personApplicationParty2Member2,
            paymentCompleted,
            applicationStatus: DALTypes.PersonApplicationStatus.PAID,
          });
          await createAPersonApplication({}, person3.id, party2.id, party2Application.id);

          const {
            body: { id: sessionId },
          } = await createMergeSession(DALTypes.MergePartyContext.PARTY, party1.id);

          const {
            body: { matchId },
          } = await getNextMatch(sessionId);

          const { status, body } = await mergeParties(userId, sessionId, matchId);

          expect(status).to.equal(200);
          const personApplicationsInClosedParty = await mergeRepo.getPersonApplicationsByPartyId(ctx, party1.id, { includeMerged: true });
          expect(personApplicationsInClosedParty.length).to.equal(2);

          const resultPartyPersonApplications = await mergeRepo.getPersonApplicationsByPartyId(ctx, body.resultPartyId, { includeMerged: true });
          expect(resultPartyPersonApplications.length).to.equal(3);
          const firstPersonApps = resultPartyPersonApplications.filter(application => application.personId === person1.id);
          expect(firstPersonApps.length).to.equal(1);
          const secondPersonApps = resultPartyPersonApplications.filter(application => application.personId === person2.id);
          expect(secondPersonApps[0].paymentCompleted).to.be.true;
          const endedAsMergedAtApps = await mergeRepo.getPersonApplicationsByPartyId(ctx, party1.id, { includeMerged: true });
          expect(endedAsMergedAtApps.length).to.equal(2);
          expect(endedAsMergedAtApps[0].paymentCompleted).to.be.false;
          const survivingAppsWithPayments = resultPartyPersonApplications.filter(application => !application.endedAsMergedAt && application.paymentCompleted);
          expect(survivingAppsWithPayments.length).to.equal(2);
          expect(survivingAppsWithPayments[0].paymentCompleted).to.be.true;
          const survivingAppsWithoutPayments = resultPartyPersonApplications.filter(
            application => !application.endedAsMergedAt && !application.paymentCompleted,
          );
          expect(survivingAppsWithoutPayments.length).to.equal(1);
          expect(survivingAppsWithoutPayments[0].paymentCompleted).to.be.false;
        });
      });

      describe('when two parties are merged and a person is removed from party and has an application', () => {
        it('should not move the application to the base party', async () => {
          const { id: userId } = await createAUser();
          const property = await createAProperty();

          const person1 = await createAPerson();
          const person2 = await createAPerson();
          const person3 = await createAPerson();

          const qualificationQuestions = {
            moveInTime: 'NEXT_2_MONTHS',
            numBedrooms: ['ONE_BED'],
            groupProfile: 'COUPLE_OR_FAMILY',
            cashAvailable: 'YES',
          };

          const storedUnitsFilters = {
            moveInDate: { max: '2017-10-30', min: '2017-09-30' },
            numBedrooms: ['ONE_BED'],
          };

          const party1 = await createAParty({ userId, assignedPropertyId: property.id, storedUnitsFilters });
          const party2 = await createAParty({ userId, assignedPropertyId: property.id, qualificationQuestions });

          await createAPartyMember(party1.id, { personId: person1.id, memberType: DALTypes.MemberType.RESIDENT });
          const partyMember2 = await createAPartyMember(party1.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });

          await createAPartyMember(party2.id, { personId: person1.id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party2.id, { personId: person3.id, memberType: DALTypes.MemberType.RESIDENT });

          const party1Application = await createAPartyApplication(party1.id, newId(), partyApplicationData);
          const party2Application = await createAPartyApplication(party2.id, newId(), partyApplicationData);

          const paymentCompleted = true;

          await createAPersonApplication({}, person1.id, party1.id, party1Application.id);
          await createAPersonApplication({}, person2.id, party1.id, party1Application.id);

          const personApplicationParty2Member1 = await createAPersonApplication({}, person1.id, party2.id, party2Application.id);
          await mergeRepo.updatePersonApplication(ctx, {
            ...personApplicationParty2Member1,
            paymentCompleted,
            applicationStatus: DALTypes.PersonApplicationStatus.PAID,
          });
          const personApplicationParty2Member2 = await createAPersonApplication({}, person2.id, party2.id, party2Application.id);
          await mergeRepo.updatePersonApplication(ctx, {
            ...personApplicationParty2Member2,
            paymentCompleted,
            applicationStatus: DALTypes.PersonApplicationStatus.PAID,
          });
          await createAPersonApplication({}, person3.id, party2.id, party2Application.id);

          await removePartyMember({
            ...ctx,
            params: { partyId: party1.id, memberId: partyMember2.id },
            body: {
              notes: 'No longer moving',
            },
          });

          const {
            body: { id: sessionId },
          } = await createMergeSession(DALTypes.MergePartyContext.PARTY, party1.id);

          const {
            body: { matchId },
          } = await getNextMatch(sessionId);

          const { status, body } = await mergeParties(userId, sessionId, matchId);

          expect(status).to.equal(200);

          expect(body.resultPartyId).not.equal(party1.id);

          const personApplicationsInClosedParty = await mergeRepo.getPersonApplicationsByPartyId(ctx, party1.id, { includeMerged: true });
          expect(personApplicationsInClosedParty.length).to.equal(2);

          const personApplicationForRemovedPartyMember = personApplicationsInClosedParty.find(pa => pa.personId === person2.id);
          expect(personApplicationForRemovedPartyMember).to.exist;
          expect(personApplicationForRemovedPartyMember.endedAsMergedAt).to.be.null;

          const resultPartyPersonApplications = await mergeRepo.getPersonApplicationsByPartyId(ctx, body.resultPartyId, { includeMerged: true });
          expect(resultPartyPersonApplications.length).to.equal(2);

          const personApplicationForRemovedPartyMemberInResultParty = resultPartyPersonApplications.find(pa => pa.personId === person2.id);
          expect(personApplicationForRemovedPartyMemberInResultParty).to.not.exist;
        });
      });

      describe('when one person has a complete application in merged party and an open application in base party', () => {
        it('should update the application to complete status in base party and move the invoices from merged party', async () => {
          const { userId, sessionId, matchId, party, party2, partyMember } = await prepareDataForResolveRequest();

          const person2 = await createAPerson();
          await createAPartyMember(party.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party2.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });

          const paymentCompleted = true;
          await createAPersonApplication({}, partyMember.personId, party.id);
          const party1Person2Appl = await createAPersonApplication({}, person2.id, party.id, newId(), paymentCompleted);
          await mergeRepo.updatePersonApplication(ctx, { ...party1Person2Appl, applicationStatus: DALTypes.PersonApplicationStatus.COMPLETED });

          const party2Person1Appl = await createAPersonApplication({}, partyMember.personId, party2.id, newId(), paymentCompleted);
          await mergeRepo.updatePersonApplication(ctx, { ...party2Person1Appl, applicationStatus: DALTypes.PersonApplicationStatus.COMPLETED });
          await createAPersonApplication({}, person2.id, party2.id);

          const { status, body } = await mergeParties(userId, sessionId, matchId);

          expect(status).to.equal(200);
          const personApplications = await mergeRepo.getPersonApplicationsByPartyId(ctx, body.resultPartyId);
          expect(personApplications.length).to.equal(2);
          expect(personApplications[0].paymentCompleted).to.be.true;
          expect(personApplications[1].paymentCompleted).to.be.true;
        });
      });

      describe('when one person has one completed application in one party and an endedAsMerged application in another party (resulted from a person merge)', () => {
        it('should pick as base party the one with active application', async () => {
          const { userId, sessionId, matchId, party, party2, property } = await prepareDataForResolveRequest();

          const { id: personId } = await createAPerson();
          await createAPartyMember(party2.id, { personId, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party.id, { personId, memberType: DALTypes.MemberType.RESIDENT });

          const paymentCompleted = true;
          const party1PersonAppl = await createAPersonApplication({}, personId, party.id, newId(), paymentCompleted);
          await mergeRepo.updatePersonApplication(ctx, {
            ...party1PersonAppl,
            applicationStatus: DALTypes.PersonApplicationStatus.COMPLETED,
            endedAsMergedAt: now().toDate(),
          });

          const party2Application = await createAPartyApplication(party2.id, newId(), partyApplicationData);
          const party2PersonApplication = await createAPersonApplication({}, personId, party2.id, party2Application.id, paymentCompleted);
          await createAnApplicationInvoice({
            id: newId(),
            applicationFeeId: newId(),
            propertyId: property.id,
            applicationFeeAmount: 43,
            paymentCompleted,
            personApplicationId: party2PersonApplication.id,
            partyApplicationId: party2Application.id,
          });
          await mergeRepo.updatePersonApplication(ctx, { ...party2PersonApplication, applicationStatus: DALTypes.PersonApplicationStatus.COMPLETED });

          const { status, body } = await mergeParties(userId, sessionId, matchId);
          expect(status).to.equal(200);

          const personApplications = await mergeRepo.getPersonApplicationsByPartyId(ctx, body.resultPartyId, { includeMerged: true });

          expect(personApplications.length).to.equal(1);
          expect(personApplications[0].paymentCompleted).to.be.true;
        });
      });

      describe('when applications from two parties are merged', () => {
        it('should move all application invoices from merged party to base party', async () => {
          const { userId, sessionId, matchId, party: party1, party2, partyMember } = await prepareDataForResolveRequest();

          const person1Id = partyMember.personId;
          const { id: person2Id } = await createAPerson();
          const { id: person3Id } = await createAPerson();
          await createAPartyMember(party1.id, { personId: person2Id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party1.id, { personId: person3Id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party2.id, { personId: person2Id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party2.id, { personId: person3Id, memberType: DALTypes.MemberType.RESIDENT });

          const party1Application = await createAPartyApplication(party1.id, newId(), partyApplicationData);
          const party2Application = await createAPartyApplication(party2.id, newId(), partyApplicationData);

          const createPersonApplicationWithInvoice = async (personId, partyId, partyApplicationId) => {
            const personApplication = await createAPersonApplication({}, personId, partyId, partyApplicationId);
            await createAnApplicationInvoice({
              id: newId(),
              applicationFeeId: newId(),
              applicationFeeAmount: 43,
              personApplicationId: personApplication.id,
              partyApplicationId,
            });
          };

          await createPersonApplicationWithInvoice(person1Id, party1.id, party1Application.id);
          await createAPersonApplication({}, person2Id, party1.id, party1Application.id);

          await createPersonApplicationWithInvoice(person1Id, party2.id, party2Application.id);
          await createPersonApplicationWithInvoice(person2Id, party2.id, party2Application.id);
          await createPersonApplicationWithInvoice(person3Id, party2.id, party2Application.id);

          const { status, body } = await mergeParties(userId, sessionId, matchId);
          expect(status).to.equal(200);
          const partyApplication = await mergeRepo.getPartyApplicationByPartyId(ctx, body.resultPartyId);
          const invoices = await mergeRepo.getApplicationInvoicesByPartyApplicationId(ctx, partyApplication.id);
          expect(invoices.length).to.equal(4);
        });
      });
    });
    describe('when applications from two parties are merged', () => {
      it('should move all party application documents and from merged party to base party', async () => {
        const { userId, sessionId, matchId, party: party1, party2 } = await prepareDataForResolveRequest();

        const party1Application = await createAPartyApplication(party1.id, newId(), partyApplicationData);
        const party2Application = await createAPartyApplication(party2.id, newId(), partyApplicationData);

        await createPartyApplicationDocument(ctx, { id: newId(), partyApplicationId: party1Application.id });
        await createPartyApplicationDocument(ctx, { id: newId(), partyApplicationId: party2Application.id });

        const { status, body } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);
        const partyApplication = await mergeRepo.getPartyApplicationByPartyId(ctx, body.resultPartyId);
        const partyDocuments = await mergeRepo.getPartyApplicationDocumentsByPartyApplicationId(ctx, partyApplication.id);
        expect(partyDocuments.length).to.equal(2);
      });
    });
    describe('when applications from two parties are merged and some person applications are copied or updated with data from merged party', () => {
      it('should clear the maxApprovedAt and minApprovedAt data and set isHeld value on base partyApplication', async () => {
        const { userId, sessionId, matchId, party: party1, party2, partyMember } = await prepareDataForResolveRequest();

        const person1Id = partyMember.personId;
        const { id: person2Id } = await createAPerson();
        await createAPartyMember(party1.id, { personId: person2Id, memberType: DALTypes.MemberType.RESIDENT });
        await createAPartyMember(party2.id, { personId: person2Id, memberType: DALTypes.MemberType.RESIDENT });

        const party1ApplicationData = {
          applicationData: {},
          maxApprovedAt: 10,
          minDeniedAt: 20,
          isHeld: false,
        };
        const party2ApplicationData = {
          applicationData: {},
          maxApprovedAt: 10,
          minDeniedAt: 20,
          isHeld: true,
          holdReason: DALTypes.HoldReasonTypes.MANUAL,
        };
        const party1Application = await createAPartyApplication(party1.id, newId(), party1ApplicationData);
        const party2Application = await createAPartyApplication(party2.id, newId(), party2ApplicationData);

        await createAPersonApplication({}, person1Id, party1.id, party1Application.id);
        await createAPersonApplication({}, person2Id, party2.id, party2Application.id);

        const { status, body } = await mergeParties(userId, sessionId, matchId);
        expect(status).to.equal(200);
        const partyApplication = await mergeRepo.getPartyApplicationByPartyId(ctx, body.resultPartyId);
        expect(partyApplication.maxApprovedAt).to.equal(null);
        expect(partyApplication.minDeniedAt).to.equal(null);
        expect(partyApplication.isHeld).to.be.false;
      });
    });
  });

  describe('when parties have overlapping appointments', () => {
    const overlappingApptTime = { startDate: now().add(1, 'hour'), endDate: now().add(2, 'hours') };

    const setupForOverlappingAppts = async (firstPartyApptTime = overlappingApptTime, secondPartyApptTime = overlappingApptTime) => {
      const { id: teamId } = await createATeam();
      const { id: assignedPropertyId } = await createAProperty();
      const { id: firstPartyOwnerId } = await createAUser();
      await createATeamMember({ teamId, userId: firstPartyOwnerId });

      const { id: secondPartyOwnerId } = await createAUser();
      await createATeamMember({ teamId, userId: secondPartyOwnerId });

      const person = await createAPerson();

      const firstParty = await createAParty({ userId: firstPartyOwnerId, assignedPropertyId });
      await createAPartyMember(firstParty.id, { personId: person.id });

      const firstPartyAppt = await createAnAppointment({ partyId: firstParty.id, salesPersonId: firstPartyOwnerId, ...firstPartyApptTime });

      const secondParty = await createAParty({ userId: secondPartyOwnerId, assignedPropertyId });
      await createAPartyMember(secondParty.id, { personId: person.id });

      const secondPartyAppt = await createAnAppointment({ partyId: secondParty.id, salesPersonId: secondPartyOwnerId, ...secondPartyApptTime });

      const {
        body: { id: sessionId },
      } = await createMergeSession(DALTypes.MergePartyContext.PARTY, firstParty.id);

      const {
        body: { matchId },
      } = await getNextMatch(sessionId);

      return { sessionId, matchId, teamId, firstParty, secondParty, firstPartyOwnerId, secondPartyOwnerId, firstPartyAppt, secondPartyAppt };
    };

    describe('when the chosen owner is the owner of second party', () => {
      it('should respond with status code 412, APPOINTMENTS_CONFLICT token and overlapping appointment ids from first party', async () => {
        const { teamId, sessionId, matchId, firstPartyOwnerId, secondPartyOwnerId, firstPartyAppt } = await setupForOverlappingAppts();

        const { status, body } = await request(app)
          .patch(`/mergePartySessions/${sessionId}/matches/${matchId}/resolve`)
          .set(getAuthHeader(tenant.id, firstPartyOwnerId))
          .send({
            response: DALTypes.MergePartyResponse.MERGE,
            partyOwnerId: secondPartyOwnerId,
            ownerTeamId: teamId,
            shouldCheckConflictingAppointments: true,
          });

        expect(status).to.equal(412);
        expect(body.token).to.equal('APPOINTMENTS_CONFLICT');
        expect(body.data.appointments.map(a => a.id)).to.deep.equal([firstPartyAppt.id]);
      });
    });

    describe('when the chosen owner is the owner of first party', () => {
      it('should respond with status code 412, APPOINTMENTS_CONFLICT token and overlapping appointment ids from second party', async () => {
        const { teamId, sessionId, matchId, firstPartyOwnerId, secondPartyAppt } = await setupForOverlappingAppts();

        const { status, body } = await request(app)
          .patch(`/mergePartySessions/${sessionId}/matches/${matchId}/resolve`)
          .set(getAuthHeader(tenant.id, firstPartyOwnerId))
          .send({
            response: DALTypes.MergePartyResponse.MERGE,
            partyOwnerId: firstPartyOwnerId,
            ownerTeamId: teamId,
            shouldCheckConflictingAppointments: true,
          });

        expect(status).to.equal(412);
        expect(body.token).to.equal('APPOINTMENTS_CONFLICT');
        expect(body.data.appointments.map(a => a.id)).to.deep.equal([secondPartyAppt.id]);
      });
    });

    describe('when the chosen owner is a third person', () => {
      describe("and first party's appointments overlap his", () => {
        it('should respond with status code 412, APPOINTMENTS_CONFLICT token and overlapping appointment ids from first party', async () => {
          const firstPartyApptTime = { startDate: now().add('1', 'hours'), endDate: now().add(2, 'hours') };
          const secondPartyApptTime = { startDate: now().add('3', 'hours'), endDate: now().add(4, 'hours') };

          const { teamId, sessionId, matchId, firstPartyOwnerId, firstPartyAppt } = await setupForOverlappingAppts(firstPartyApptTime, secondPartyApptTime);

          const { id: thirdUserId } = await createAUser();
          await createATeamMember({ teamId, userId: thirdUserId });

          const thirdParty = await createAParty({ userId: thirdUserId });
          await createAnAppointment({ partyId: thirdParty.id, salesPersonId: thirdUserId, ...firstPartyApptTime });

          const { status, body } = await request(app)
            .patch(`/mergePartySessions/${sessionId}/matches/${matchId}/resolve`)
            .set(getAuthHeader(tenant.id, firstPartyOwnerId))
            .send({
              response: DALTypes.MergePartyResponse.MERGE,
              partyOwnerId: thirdUserId,
              ownerTeamId: teamId,
              shouldCheckConflictingAppointments: true,
            });

          expect(status).to.equal(412);
          expect(body.token).to.equal('APPOINTMENTS_CONFLICT');
          expect(body.data.appointments.map(a => a.id)).to.deep.equal([firstPartyAppt.id]);
        });
      });

      describe("and second party's appointments overlap his", () => {
        it('should respond with status code 412, APPOINTMENTS_CONFLICT token and overlapping appointment ids from second party', async () => {
          const firstPartyApptTime = { startDate: now().add('1', 'hours'), endDate: now().add(2, 'hours') };
          const secondPartyApptTime = { startDate: now().add('3', 'hours'), endDate: now().add(4, 'hours') };

          const { teamId, sessionId, matchId, firstPartyOwnerId, secondPartyAppt } = await setupForOverlappingAppts(firstPartyApptTime, secondPartyApptTime);

          const { id: thirdUserId } = await createAUser();
          await createATeamMember({ teamId, userId: thirdUserId });

          const thirdParty = await createAParty({ userId: thirdUserId });
          await createAnAppointment({ partyId: thirdParty.id, salesPersonId: thirdUserId, ...secondPartyApptTime });

          const { status, body } = await request(app)
            .patch(`/mergePartySessions/${sessionId}/matches/${matchId}/resolve`)
            .set(getAuthHeader(tenant.id, firstPartyOwnerId))
            .send({
              response: DALTypes.MergePartyResponse.MERGE,
              partyOwnerId: thirdUserId,
              ownerTeamId: teamId,
              shouldCheckConflictingAppointments: true,
            });

          expect(status).to.equal(412);
          expect(body.token).to.equal('APPOINTMENTS_CONFLICT');
          expect(body.data.appointments.map(a => a.id)).to.deep.equal([secondPartyAppt.id]);
        });
      });

      describe("and both first and second party's appointments overlap his", () => {
        it('should respond with status code 412, APPOINTMENTS_CONFLICT token and overlapping appointment ids from both parties', async () => {
          const { teamId, sessionId, matchId, firstPartyOwnerId, firstPartyAppt, secondPartyAppt } = await setupForOverlappingAppts();

          const { id: thirdUserId } = await createAUser();
          await createATeamMember({ teamId, userId: thirdUserId });

          const thirdParty = await createAParty({ userId: thirdUserId });
          await createAnAppointment({ partyId: thirdParty.id, salesPersonId: thirdUserId, ...overlappingApptTime });

          const { status, body } = await request(app)
            .patch(`/mergePartySessions/${sessionId}/matches/${matchId}/resolve`)
            .set(getAuthHeader(tenant.id, firstPartyOwnerId))
            .send({
              response: DALTypes.MergePartyResponse.MERGE,
              partyOwnerId: thirdUserId,
              ownerTeamId: teamId,
              shouldCheckConflictingAppointments: true,
            });

          expect(status).to.equal(412);
          expect(body.token).to.equal('APPOINTMENTS_CONFLICT');
          expect(body.data.appointments.map(a => a.id)).to.deep.equal([firstPartyAppt.id, secondPartyAppt.id]);
        });
      });

      describe("and none of first and second party's appointments overlap his, but they overlap each other", () => {
        it('should respond with status code 412, APPOINTMENTS_CONFLICT token and overlapping appointment ids from both parties', async () => {
          const { teamId, sessionId, matchId, firstPartyOwnerId, firstPartyAppt, secondPartyAppt } = await setupForOverlappingAppts();

          const { id: thirdUserId } = await createAUser();
          await createATeamMember({ teamId, userId: thirdUserId });

          const { status, body } = await request(app)
            .patch(`/mergePartySessions/${sessionId}/matches/${matchId}/resolve`)
            .set(getAuthHeader(tenant.id, firstPartyOwnerId))
            .send({
              response: DALTypes.MergePartyResponse.MERGE,
              partyOwnerId: thirdUserId,
              ownerTeamId: teamId,
              shouldCheckConflictingAppointments: true,
            });

          expect(status).to.equal(412);
          expect(body.token).to.equal('APPOINTMENTS_CONFLICT');
          expect(body.data.appointments.map(a => a.id)).to.deep.equal([firstPartyAppt.id, secondPartyAppt.id]);
        });
      });
      describe('when a party member with an application is merged and another application is created in the base party', () => {
        const partyApplicationData = {
          applicationData: {},
          maxApprovedAt: null,
          minDeniedAt: null,
        };
        it('should return the last application from the base party when searching by person id and two application searching by party id', async () => {
          const { userId, sessionId, matchId, person, party, party2, partyMember } = await prepareDataForResolveRequest();

          const person2 = await createAPerson();
          await createAPartyMember(party.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party2.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });

          const partyApplication = await createAPartyApplication(party.id, newId(), partyApplicationData);
          const party2Application = await createAPartyApplication(party2.id, newId(), partyApplicationData);
          await createAPersonApplication({}, partyMember.personId, party.id, partyApplication.id);
          await createAPersonApplication({}, person2.id, party2.id, party2Application.id);

          const { status, body } = await mergeParties(userId, sessionId, matchId);
          expect(status).to.equal(200);

          const applicationsByPersonId = await getPersonApplicationsByFilter(ctx, { personId: person2.id });
          expect(applicationsByPersonId.length).to.equal(1);
          expect(applicationsByPersonId[0].partyId).to.be.equal(body.resultPartyId);
          expect(applicationsByPersonId[0].personId).to.be.equal(person2.id);

          const applicationsByPartyId = await getPersonApplicationsByFilter(ctx, { partyId: body.resultPartyId });
          expect(applicationsByPartyId.length).to.equal(2);
          expect(applicationsByPartyId.some(application => application.personId === person2.id)).to.be.true;
          expect(applicationsByPartyId.some(application => application.personId === person.id)).to.be.true;

          const personApplications = await mergeRepo.getPersonApplicationsByPartyId(ctx, body.resultPartyId);
          expect(personApplications.length).to.equal(2);
          const { id: partyApplicationId } = await mergeRepo.getPartyApplicationByPartyId(ctx, body.resultPartyId);
          expect(personApplications.filter(application => application.partyApplicationId === partyApplicationId).length).to.equal(2);
        });

        it('should return both applications when searching by person id passing the flag includeMerge', async () => {
          const { userId, sessionId, matchId, person, party, party2, partyMember } = await prepareDataForResolveRequest();
          const person2 = await createAPerson();
          await createAPartyMember(party.id, { personId: person.id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party2.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });
          await createAPartyMember(party.id, { personId: person2.id, memberType: DALTypes.MemberType.RESIDENT });

          const partyApplication = await createAPartyApplication(party.id, newId(), partyApplicationData);
          const party2Application = await createAPartyApplication(party2.id, newId(), partyApplicationData);
          await createAPersonApplication({}, partyMember.personId, party.id, partyApplication.id);
          await createAPersonApplication({}, person2.id, party.id, partyApplication.id);
          await createAPersonApplication({}, person2.id, party2.id, party2Application.id);

          const { status: mergeStatus } = await mergeParties(userId, sessionId, matchId);
          expect(mergeStatus).to.equal(200);
          const { status } = await closeParty(userId, party2.id);
          expect(status).to.equal(200);

          const applicationsByPersonId = await getPersonApplicationsByFilter(ctx, { personId: person2.id }, { includeMerged: true });
          expect(applicationsByPersonId.length).to.equal(2);
          expect(applicationsByPersonId.some(application => application.partyId === party2.id)).to.be.true;
          expect(applicationsByPersonId.some(application => application.partyId === party.id)).to.be.true;
          expect(applicationsByPersonId.filter(application => application.personId === person2.id).length).to.equal(2);

          const applicationsByPartyId = await getPersonApplicationsByFilter(ctx, { partyId: party.id }, { includeMerged: true });

          expect(applicationsByPartyId.length).to.equal(2);
          expect(applicationsByPartyId.some(application => application.personId === person2.id)).to.be.true;
          expect(applicationsByPartyId.some(application => application.personId === person.id)).to.be.true;
        });
      });
    });
  });
});
