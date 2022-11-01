/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { mapSeries } from 'bluebird';
import request from 'supertest';
import v4 from 'uuid/v4';
import app, { processDBEvents } from '../../api';
import decisionApp from '../../../decision_service/api';
import { getAuthHeader, waitFor } from '../../../testUtils/apiHelper';
import { tenant, chan, createResolverMatcher, enableAggregationTriggers } from '../../../testUtils/setupTestGlobalContext';
import { loadParty, createPartyMember, loadParties } from '../../../dal/partyRepo';
import { getPartyLeases } from '../../../dal/leaseRepo';
import {
  testCtx as ctx,
  createAParty,
  createAUser,
  createAnAppointment,
  createAnAmenity,
  addAmenityToInventory,
  createATeam,
  createATeamMember,
  createAProperty,
  createALeaseName,
  createALeaseTerm,
  createAQuote,
  createAPartyMember,
  createAQuotePromotion,
  createAnInventory,
  refreshUnitSearch,
  createABuilding,
  createAInventoryGroup,
  createATask,
} from '../../../testUtils/repoHelper';

import { startWaitingForEvents } from '../../../testUtils/leaseTestHelper';
import { performPartyStateTransition } from '../../../services/partyStatesTransitions';
import { DALTypes } from '../../../../common/enums/DALTypes';
import sleep from '../../../../common/helpers/sleep';
import { DATE_US_FORMAT, LA_TIMEZONE } from '../../../../common/date-constants';
import { setupConsumers } from '../../../workers/consumer';
import { tenantId } from '../../../testUtils/test-tenant';
import { importLeaseTemplates } from '../../../workers/lease/importLeaseTemplatesHandler';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { createAPersonApplication, createAPartyApplication } from '../../../../rentapp/server/test-utils/repo-helper.js';
import { signLease } from '../../../services/leases/leaseService';
import { generateTokenForDomain } from '../../../services/tenantService';
import { LEASE_MESSAGE_TYPE } from '../../../helpers/message-constants';
import { now } from '../../../../common/helpers/moment-utils';
import { setSubscriptionRequest, resetEventDeliveryMechanism } from '../../../workers/party/documentHistoryHandler';
import { setLeasingApiRequest } from '../../../decision_service/utils';
import { refreshSubscriptions } from '../../../dal/subscriptionsRepo';
import { createRenewalParty, createActiveLeaseParty } from '../../../testUtils/partyWorkflowTestHelper';

describe('party state transitions', () => {
  let matcher;
  const setupMsgQueueAndWaitFor = async (conditions, workerKeysToBeStarted) => {
    const { resolvers, promises } = waitFor(conditions);
    matcher = createResolverMatcher(resolvers);
    await setupConsumers(chan(), matcher, workerKeysToBeStarted);
    return { task: Promise.all(promises) };
  };

  const requiredQualificationQuestions = {
    numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.ONE_BED],
    cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
  };

  describe('CONTACT transitions', () => {
    let teamId;
    let teamEmail;
    let header;
    const teamName = 'testTeam';

    beforeEach(async () => {
      const user = await createAUser();
      const { id, directEmailIdentifier } = await createATeam({
        name: teamName,
        module: 'leasing',
        email: 'leasing@test.com',
        phone: '16504375757',
      });
      teamId = id;
      teamEmail = directEmailIdentifier;
      await createATeamMember({ teamId, userId: user.id });

      const token = await generateTokenForDomain({
        tenantId: tenant.id,
        domain: 'testing.reva.tech',
        expiresIn: '1m',
        allowedEndpoints: ['contactUs', 'leads'],
      });
      header = {
        Authorization: `Bearer ${token}`,
        referer: 'http://testing.reva.tech',
      };
    });

    it.skip('new parties without qualification questions are created in CONTACT State', async () => {
      const formData = {
        name: 'Orson Welles',
        phone: '+1-202-555-0130',
        teamEmail,
      };

      const queueCondition = msg => msg.data && msg.data.phone === formData.phone;
      const { task } = await setupMsgQueueAndWaitFor([queueCondition], ['webInquiry']);

      await request(app).post('/contactUs').set(header).send(formData).expect(200);
      await task;

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);
      expect(parties[0].state).to.equal(DALTypes.PartyStateType.CONTACT);
    });

    it.skip('new parties with qualification questions are created in LEAD State', async () => {
      const formData = {
        name: 'Orson Welles',
        phone: '+1-202-555-0130',
        teamEmail,
        qualificationQuestions: requiredQualificationQuestions,
      };

      const queueCondition = msg => msg.data && msg.data.phone === formData.phone;
      const { task } = await setupMsgQueueAndWaitFor([queueCondition], ['webInquiry']);

      await request(app).post('/contactUs').set(header).send(formData).expect(200);
      await task;

      const parties = await loadParties(ctx);
      expect(parties.length).to.equal(1);
      expect(parties[0].state).to.equal(DALTypes.PartyStateType.LEAD);
    });

    describe('All appointments are canceled', () => {
      it('should transition to CONTACT state we have no questions are answered', async () => {
        const party = await createAParty({
          state: DALTypes.PartyStateType.LEAD,
        });
        const user = await createAUser();
        const appointment = await createAnAppointment({
          salesPersonId: user.id,
          partyId: party.id,
          startDate: new Date('12-14-2015 16:30:00'),
          endDate: new Date('12-14-2015 17:30:00'),
        });

        await request(app).patch(`/tasks/${appointment.id}`).set(getAuthHeader()).send({ id: appointment.id, state: DALTypes.TaskStates.CANCELED }).expect(200);

        const updatedParty = await loadParty(ctx, party.id);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.CONTACT);
      });
    });
  });

  describe('LEAD transitions', () => {
    describe('qualification questions are answered', () => {
      it('should transition party to LEAD state', async () => {
        const user = await createAUser();
        const party = await createAParty({
          userId: user.id,
          state: DALTypes.PartyStateType.CONTACT,
        });
        await request(app)
          .patch(`/parties/${party.id}`)
          .set(getAuthHeader(tenantId, user.id))
          .send({
            id: party.id,
            qualificationQuestions: requiredQualificationQuestions,
          })
          .expect(200);

        const updatedParty = await loadParty(ctx, party.id);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.LEAD);
      });
    });

    describe('an appointment is created', () => {
      it('should transition party to LEAD state', async () => {
        const party = await createAParty({
          state: DALTypes.PartyStateType.CONTACT,
        });
        const user = await createAUser();
        const appointment = {
          salesPersonId: user.id,
          partyId: party.id,
          category: DALTypes.TaskCategories.APPOINTMENT,
          startDate: new Date('12-14-2015 16:30:00'),
          endDate: new Date('12-14-2015 17:30:00'),
        };

        await request(app).post('/tasks').set(getAuthHeader()).send(appointment).expect(200);

        const updatedParty = await loadParty(ctx, party.id);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.LEAD);
      });
    });

    describe('all appointments are removed', () => {
      it('should transition party to LEAD state', async () => {
        const party = await createAParty({
          state: DALTypes.PartyStateType.PROSPECT,
          qualificationQuestions: requiredQualificationQuestions,
        });
        const user = await createAUser();
        const appointment = await createAnAppointment({
          salesPersonId: user.id,
          partyId: party.id,
          startDate: new Date('12-14-2015 16:30:00'),
          endDate: new Date('12-14-2015 17:30:00'),
        });

        await request(app).patch(`/tasks/${appointment.id}`).set(getAuthHeader()).send({ id: appointment.id, state: DALTypes.TaskStates.CANCELED }).expect(200);

        const updatedParty = await loadParty(ctx, party.id);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.LEAD);
      });
    });

    describe('all appointments are mark as uncomplete ', () => {
      it('should transition party to LEAD state', async () => {
        const party = await createAParty({
          state: DALTypes.PartyStateType.PROSPECT,
        });
        const user = await createAUser();
        const appointment = await createAnAppointment({
          salesPersonId: user.id,
          partyId: party.id,
          state: DALTypes.TaskStates.COMPLETED,
          startDate: new Date('12-14-2015 16:30:00'),
          endDate: new Date('12-14-2015 17:30:00'),
        });

        await request(app).patch(`/tasks/${appointment.id}`).set(getAuthHeader()).send({ id: appointment.id, state: DALTypes.TaskStates.ACTIVE }).expect(200);

        const updatedParty = await loadParty(ctx, party.id);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.LEAD);
      });
    });
  });

  describe('PROSPECT transitions ', () => {
    describe('an appointment has been completed', () => {
      it('should transition party to PROSPECT state', async () => {
        const party = await createAParty({
          state: DALTypes.PartyStateType.CONTACT,
        });
        const user = await createAUser();
        const appointment = await createAnAppointment({
          salesPersonId: user.id,
          partyId: party.id,
          startDate: new Date('12-14-2015 16:30:00'),
          endDate: new Date('12-14-2015 17:30:00'),
        });

        await request(app)
          .patch(`/tasks/${appointment.id}`)
          .set(getAuthHeader(ctx.tenantId, user.id))
          .send({ state: DALTypes.TaskStates.COMPLETED })
          .expect(200);

        const updatedParty = await loadParty(ctx, party.id);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.PROSPECT);
      });
    });

    describe('A quote is published for the party', () => {
      it('should transition party to PROSPECT state', async () => {
        const party = await createAParty({
          state: DALTypes.PartyStateType.LEAD,
        });
        const inventory = await createAnInventory();
        const amenity = await createAnAmenity({
          id: v4(),
          category: 'inventory',
          propertyId: inventory.propertyId,
        });
        await addAmenityToInventory(ctx, inventory.id, amenity.id);

        const res = await request(app)
          .post('/quotes')
          .set(getAuthHeader())
          .send({
            inventoryId: inventory.id,
            partyId: party.id,
          })
          .expect(200);
        await request(app)
          .patch(`/quotes/draft/${res.body.id}`)
          .set(getAuthHeader())
          .send({
            leaseStartDate: now().toISOString(),
            publishDate: now().toISOString(),
            expirationDate: now().add(50, 'days').toISOString(),
            propertyTimezone: 'America/Los_Angeles',
            selections: { selectedLeaseTerms: [{ id: v4() }] },
          });

        const updatedParty = await loadParty(ctx, party.id);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.PROSPECT);
      });
    });
  });

  describe('APPLICANT transitions ', () => {
    const publishedLease = {
      leaseStartDate: now().format(DATE_US_FORMAT),
      leaseEndDate: now().add(50, 'days').format(DATE_US_FORMAT),
      moveinRentEndDate: now().add(55, 'days').format(DATE_US_FORMAT),
      moveInDate: now().add(5, 'days').format(DATE_US_FORMAT),
      unitRent: 500,
      rentersInsuranceFacts: 'buyInsuranceFlag',
      concessions: {},
      additionalCharges: {
        petFee: {
          quoteSectionName: DALTypes.QuoteSection.PET,
          amount: 100,
        },
      },
      oneTimeCharges: {
        unitDeposit: {
          amount: 2500,
          feeType: DALTypes.FeeType.DEPOSIT,
          quoteSectionName: DALTypes.QuoteSection.DEPOSIT,
          firstFee: true,
        },
      },
    };

    describe('a quote promotion was created without applicants in the party', () => {
      it('should transition party to APPLICANT state', async () => {
        const party = await createAParty({
          state: DALTypes.PartyStateType.PROSPECT,
        });
        await createPartyMember(
          ctx,
          {
            memberType: DALTypes.MemberType.RESIDENT,
            memberState: DALTypes.PartyStateType.PROSPECT,
            fullname: 'TEST',
          },
          party.id,
        );

        const { id: propertyId } = await createAProperty();
        const building = await createABuilding({ propertyId });
        const { id: leaseNameId } = await createALeaseName(ctx, { propertyId });

        const { id: leaseTermId } = await createALeaseTerm({
          leaseNameId,
          propertyId,
          termLength: 12,
        });

        const inventoryGroup = await createAInventoryGroup({
          propertyId,
          leaseNameId,
        });

        const inventory = await createAnInventory({
          propertyId,
          buildingId: building.id,
          inventoryGroupId: inventoryGroup.id,
        });

        const { id: quoteId } = await createAQuote(party.id, {
          inventoryId: inventory.id,
          publishedQuoteData: {
            leaseTerms: [
              {
                id: leaseTermId,
                termLength: 12,
                concessions: [],
                adjustedMarketRent: 42,
                chargeConcessions: [],
              },
            ],
            publishDate: new Date(),
            expirationDate: new Date(),
            leaseStartDate: new Date(),
            additionalAndOneTimeCharges: {
              oneTimeCharges: [],
              additionalCharges: [],
            },
          },
          publishDate: new Date(),
        });

        await createAQuotePromotion(party.id, DALTypes.PromotionStatus.APPROVED, quoteId, leaseTermId);
        await performPartyStateTransition(ctx, party.id);
        const updatedParty = await loadParty(ctx, party.id);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.APPLICANT);
      });
    });

    describe('an application was submited for one of the party members', () => {
      it('should transition party to APPLICANT state', async () => {
        const party = await createAParty({
          state: DALTypes.PartyStateType.PROSPECT,
        });
        await createPartyMember(
          ctx,
          {
            memberType: DALTypes.MemberType.RESIDENT,
            memberState: DALTypes.PartyStateType.APPLICANT,
            fullname: 'TEST',
          },
          party.id,
        );

        // this should be done on the application endpoint when the endpoint will be available
        await performPartyStateTransition(ctx, party.id);
        const updatedParty = await loadParty(ctx, party.id);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.APPLICANT);
      });
    });

    describe('several conditions are valid for party state', () => {
      it('should transition party highest state matching the condition', async () => {
        const party = await createAParty({
          state: DALTypes.PartyStateType.PROSPECT,
          qualificationQuestions: { testQuestion: 'asd' },
        });
        await createPartyMember(
          ctx,
          {
            memberType: DALTypes.MemberType.RESIDENT,
            memberState: DALTypes.PartyStateType.APPLICANT,
            fullname: 'TEST',
          },
          party.id,
        );

        const user = await createAUser();
        await createAnAppointment({
          salesPersonId: user.id,
          partyId: party.id,
          state: DALTypes.TaskStates.COMPLETED,
          startDate: new Date('12-14-2015 16:30:00'),
          endDate: new Date('12-14-2015 17:30:00'),
        });

        // this should be done on the application endpoint when the endpoint will be available
        await performPartyStateTransition(ctx, party.id);
        const updatedParty = await loadParty(ctx, party.id);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.APPLICANT);
      });
    });

    const setupLease = async (userId, partyId) => {
      const { personId } = await createAPartyMember(partyId, {
        memberType: DALTypes.MemberType.RESIDENT,
        fullname: 'TEST',
      });

      const { id: propertyId } = await createAProperty();
      const building = await createABuilding({ propertyId });
      const { id: leaseNameId } = await createALeaseName(ctx, { propertyId });

      const { id: leaseTermId } = await createALeaseTerm({
        leaseNameId,
        propertyId,
        termLength: 12,
      });

      const inventoryGroup = await createAInventoryGroup({
        propertyId,
        leaseNameId,
      });

      const inventory = await createAnInventory({
        propertyId,
        buildingId: building.id,
        inventoryGroupId: inventoryGroup.id,
      });

      const amenity = await createAnAmenity({
        id: v4(),
        category: 'inventory',
        propertyId: inventory.propertyId,
      });
      await addAmenityToInventory(ctx, inventory.id, amenity.id);

      await refreshUnitSearch();

      const { id: quoteId } = await createAQuote(partyId, {
        inventoryId: inventory.id,
        propertyTimezone: LA_TIMEZONE,
        publishedQuoteData: {
          leaseTerms: [
            {
              id: leaseTermId,
              termLength: 12,
              concessions: [],
              adjustedMarketRent: 42,
              chargeConcessions: [],
            },
          ],
          publishDate: new Date(),
          expirationDate: new Date(),
          leaseStartDate: new Date(),
          additionalAndOneTimeCharges: {
            oneTimeCharges: [],
            additionalCharges: [],
          },
        },
        publishDate: new Date(),
      });
      await importLeaseTemplates({ tenantId: tenant.id });
      const { id: partyApplicationId } = await createAPartyApplication(partyId, v4(), {});
      await createAPersonApplication({ firstName: 'Name' }, personId, partyId, partyApplicationId);
      const promotedQuote = await createAQuotePromotion(partyId, DALTypes.PromotionStatus.APPROVED, quoteId, leaseTermId);
      const leaseData = {
        promotedQuoteId: promotedQuote.id,
        partyId,
      };
      return { leaseData, userId, partyId };
    };

    const renewalPartyLeaseSetup = async () => {
      const { renewalParty } = await createRenewalParty();
      const { userId, id: partyId } = renewalParty;
      return await setupLease(userId, partyId);
    };

    const leasingPartyLeaseSetup = async () => {
      const { id: userId } = await createAUser();
      const team = await createATeam({
        name: 'team',
        module: 'leasing',
        email: 'a@a.a',
        phone: '12025550190',
      });
      await createATeamMember({
        teamId: team.id,
        userId,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LWA.name, FunctionalRoleDefinition.LCA.name],
        },
      });
      const { id: partyId } = await createAParty({
        userId,
        teams: [team.id],
        ownerTeam: team.id,
      });
      return await setupLease(userId, partyId);
    };

    describe('a lease is published', () => {
      it('should transition the associated party to LEASE state', async () => {
        const { leaseData, userId, partyId } = await leasingPartyLeaseSetup();
        const { body: lease } = await request(app).post(`/parties/${partyId}/leases`).set(getAuthHeader(tenant.id, userId)).send(leaseData).expect(200);

        const queueCondition = msg => msg.leaseData && msg.leaseData.id === lease.id;
        const { task } = await setupMsgQueueAndWaitFor([queueCondition], ['lease']);

        await request(app)
          .post(`/parties/${partyId}/leases/${lease.id}/publish`)
          .set(getAuthHeader(tenant.id, userId))
          .send({
            id: lease.id,
            baselineData: { ...lease.baselineData, publishedLease },
          })
          .expect(200);
        const [handled] = await task;
        expect(handled).to.be.true;

        const updatedParty = await loadParty(ctx, partyId);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.LEASE);
      });
    });

    describe('when a lease is voided on a renewal party', () => {
      it('should transition the associated party to PROSPECT state', async () => {
        const { leaseData, userId, partyId } = await renewalPartyLeaseSetup();
        const { body: lease } = await request(app).post(`/parties/${partyId}/leases`).set(getAuthHeader(tenant.id, userId)).send(leaseData).expect(200);

        const queueCondition = msg => msg.leaseData && msg.leaseData.id === lease.id;
        const { task } = await setupMsgQueueAndWaitFor([queueCondition], ['lease']);

        await request(app)
          .post(`/parties/${partyId}/leases/${lease.id}/publish`)
          .set(getAuthHeader(tenant.id, userId))
          .send({
            id: lease.id,
            baselineData: { ...lease.baselineData, publishedLease },
          })
          .expect(200);

        const [handled] = await task;
        expect(handled).to.be.true;

        const updatedParty = await loadParty(ctx, partyId);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.LEASE);

        await request(app).post(`/parties/${partyId}/leases/${lease.id}/void`).set(getAuthHeader(tenant.id, userId)).send().expect(200);

        const partyWithVoidedLease = await loadParty(ctx, partyId);
        expect(partyWithVoidedLease.state).to.equal(DALTypes.PartyStateType.PROSPECT);
      });
    });

    describe('when the countersigner signs the lease', () => {
      it('should transition the associated party to FUTURERESIDENT state', async () => {
        const { leaseData, userId, partyId } = await leasingPartyLeaseSetup();
        const { body: lease } = await request(app).post(`/parties/${partyId}/leases`).set(getAuthHeader(tenant.id, userId)).send(leaseData).expect(200);

        const queueCondition = (publishMsg, processed, msg) => {
          const matched =
            publishMsg.leaseData && publishMsg.leaseData.id === lease.id && processed && msg.fields.routingKey === LEASE_MESSAGE_TYPE.PUBLISH_LEASE;
          return matched;
        };

        const { task } = await setupMsgQueueAndWaitFor([queueCondition], ['lease', 'tasks']);
        await request(app)
          .post(`/parties/${partyId}/leases/${lease.id}/publish`)
          .set(getAuthHeader(tenant.id, userId))
          .send({
            id: lease.id,
            baselineData: { ...lease.baselineData, publishedLease },
          })
          .expect(200);
        await task;

        const [partyLease] = await getPartyLeases({ tenantId: tenant.id }, partyId);
        const membersSignatures = partyLease.signatures.filter(item => item.partyMemberId);
        await mapSeries(
          membersSignatures,
          async signature =>
            await signLease({
              ctx,
              envelopeId: signature.envelopeId,
              clientUserId: signature.metadata.clientUserId,
            }),
        );

        const countersignerSignature = partyLease.signatures.filter(item => item.userId);

        await mapSeries(
          countersignerSignature,
          async signature =>
            await signLease({
              ctx,
              envelopeId: signature.envelopeId,
              clientUserId: signature.metadata.clientUserId,
            }),
        );
        await sleep(3000);

        const updatedParty = await loadParty(ctx, partyId);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.FUTURERESIDENT);
      });
    });

    describe('when the moveInDate for an executed lease is reached', () => {
      let partyId;
      let pgClient;
      let authToken;

      beforeEach(async () => {
        setSubscriptionRequest(request(decisionApp));
        setLeasingApiRequest(() => request(app));
        resetEventDeliveryMechanism();
        const leaseSetup = await leasingPartyLeaseSetup();
        const { leaseData, userId } = leaseSetup;
        authToken = getAuthHeader(tenant.id, userId);
        partyId = leaseSetup.partyId;
        const { body: lease } = await request(app).post(`/parties/${partyId}/leases`).set(authToken).send(leaseData).expect(200);

        publishedLease.moveInDate = now().format(DATE_US_FORMAT);

        const queueCondition = msg => msg.leaseData && msg.leaseData.id === lease.id;
        const { task } = await setupMsgQueueAndWaitFor([queueCondition], ['lease', 'tasks', 'history']);

        await enableAggregationTriggers(tenant.id);
        await refreshSubscriptions(tenant);
        pgClient = await processDBEvents();

        await request(app)
          .post(`/parties/${partyId}/leases/${lease.id}/publish`)
          .set(getAuthHeader(tenant.id, userId))
          .send({
            id: lease.id,
            baselineData: { ...lease.baselineData, publishedLease },
          })
          .expect(200);
        await task;

        const [partyLease] = await getPartyLeases({ tenantId: tenant.id }, partyId);
        const membersSignatures = partyLease.signatures.filter(item => item.partyMemberId);

        const waiters = startWaitingForEvents(matcher, 3);
        await mapSeries(
          membersSignatures,
          async signature =>
            await signLease({
              ctx,
              envelopeId: signature.envelopeId,
              clientUserId: signature.metadata.clientUserId,
            }),
        );

        const countersignerSignature = partyLease.signatures.filter(item => item.userId);

        await mapSeries(
          countersignerSignature,
          async signature =>
            await signLease({
              ctx,
              envelopeId: signature.envelopeId,
              clientUserId: signature.metadata.clientUserId,
            }),
        );

        await sleep(4000);
        await Promise.all(waiters);
      });

      afterEach(async () => {
        await pgClient.close();
      });

      // This test fails randomly. Marking his as skip for the moment, it will be fixed as part of: https://redisrupt.atlassian.net/browse/CPM-17931
      it.skip('should transition the associated party to RESIDENT state', async () => {
        const updatedParty = await loadParty(ctx, partyId);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.RESIDENT);
      });

      it.skip('should transition the associated party to RESIDENT state even if there are still active tasks', async () => {
        await createATask({
          partyId,
          name: DALTypes.TaskNames.FOLLOWUP_PARTY,
        });

        const updatedParty = await loadParty(ctx, partyId);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.RESIDENT);
      });
    });
  });

  describe('Renewal party transitions ', () => {
    describe('A newly created renewal party', () => {
      it('should be in the PROSPECT state', async () => {
        const { renewalParty } = await createRenewalParty();
        expect(renewalParty.state).to.equal(DALTypes.PartyStateType.PROSPECT);
      });
    });

    describe('Publishing a quote for a renewal party', () => {
      it('should leave the party in PROSPECT state', async () => {
        const { renewalParty } = await createRenewalParty();

        const inventory = await createAnInventory();
        const amenity = await createAnAmenity({
          id: v4(),
          category: 'inventory',
          propertyId: inventory.propertyId,
        });
        await addAmenityToInventory(ctx, inventory.id, amenity.id);

        const res = await request(app)
          .post('/quotes')
          .set(getAuthHeader())
          .send({
            inventoryId: inventory.id,
            partyId: renewalParty.id,
          })
          .expect(200);
        await request(app)
          .patch(`/quotes/draft/${res.body.id}`)
          .set(getAuthHeader())
          .send({
            leaseStartDate: now().toISOString(),
            publishDate: now().toISOString(),
            expirationDate: now().add(50, 'days').toISOString(),
            propertyTimezone: 'America/Los_Angeles',
            selections: { selectedLeaseTerms: [{ id: v4() }] },
          });

        const updatedParty = await loadParty(ctx, renewalParty.id);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.PROSPECT);
      });
    });
  });

  describe('Active lease party transitions ', () => {
    describe('A newly created active lease party', () => {
      it('should be in the RESIDENT state', async () => {
        const leaseStartDate = now().format(DATE_US_FORMAT);

        const leaseEndDate = now().add(100, 'days').format(DATE_US_FORMAT);

        const { activeLeaseParty } = await createActiveLeaseParty({ leaseStartDate, leaseEndDate });
        expect(activeLeaseParty.state).to.equal(DALTypes.PartyStateType.RESIDENT);
      });
    });

    describe('creating an appointment', () => {
      it('should leave the party in RESIDENT state', async () => {
        const leaseStartDate = now().format(DATE_US_FORMAT);

        const leaseEndDate = now().add(100, 'days').format(DATE_US_FORMAT);

        const { activeLeaseParty } = await createActiveLeaseParty({ leaseStartDate, leaseEndDate });
        expect(activeLeaseParty.state).to.equal(DALTypes.PartyStateType.RESIDENT);
        const user = await createAUser();

        await createAnAppointment({
          partyId: activeLeaseParty.id,
          salesPersonId: user.id,
          startDate: new Date('10-10-2020 16:30:00'),
        });
        await performPartyStateTransition(ctx, activeLeaseParty.id);

        const updatedParty = await loadParty(ctx, activeLeaseParty.id);
        expect(updatedParty.state).to.equal(DALTypes.PartyStateType.RESIDENT);
      });
    });
  });
});
