/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import newId from 'uuid/v4';
import path from 'path';
import { chan, createResolverMatcher } from '../../../testUtils/setupTestGlobalContext';
import app from '../../api';
import {
  testCtx as ctx,
  createAParty,
  createAUser,
  createATeam,
  createATeamMember,
  createATask,
  createAnAppointment,
  createACommunicationEntry,
  createAQuotePromotion,
  createAPartyMember,
  addATeamPropertyProgram,
  createAProgram,
} from '../../../testUtils/repoHelper';
import { createParty } from '../../../dal/partyRepo';
import { getAllUserEvents } from '../../../dal/calendarEventsRepo';
import { getAuthHeader, waitFor } from '../../../testUtils/apiHelper';
import { tenantId } from '../../../testUtils/test-tenant';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { setupConsumers } from '../../../workers/consumer';
import { now, toMoment } from '../../../../common/helpers/moment-utils';
import { getCommunicationsForPartyByCategory } from '../../../dal/communicationRepo';
import { getPropertyByName, updateProperty } from '../../../dal/propertyRepo';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import {
  processWorkbook,
  getCommsTemplatesFromWorkbook,
  getCommsTemplatesSettingsFromWorkbook,
  getPropertyFromWorkbook,
  getTemplateShortCodesFromWorkbook,
  getBusinessEntityFromWorkbook,
  getPropertyGroupFromWorkbook,
  getPartyCohortsFromWorkbook,
} from '../../../import/excelInventory.js';
import { parse } from '../../../helpers/workbook';
import { importProperties } from '../../../import/inventory/property';
import { importCommsTemplates } from '../../../import/inventory/commsTemplate';
import { importTemplateShortCodes } from '../../../import/inventory/templateShortCode';
import { importBusinessEntities } from '../../../import/inventory/businessEntity';
import { importPropertyGroups } from '../../../import/inventory/propertyGroup';
import { importPartyCohorts } from '../../../import/inventory/partyCohort';
import { importCommsTemplateSettings } from '../../../import/inventory/commsTemplateSettings';
import { spreadsheet } from '../../../../common/helpers/spreadsheet';

const testTeam = {
  name: 'team1',
  module: 'leasing',
  email: 'test1@test.a',
  phone: '12025550190',
};

const testTeam2 = {
  name: 'team2',
  module: 'leasing',
  email: 'test2@test.a',
  phone: '12025550111',
};

describe('API/party', () => {
  describe('given a request to close a party', () => {
    describe('when the party does not exist', () => {
      it('returns 404 and PARTY_NOT_FOUND token', async () => {
        const user = await createAUser();

        await request(app)
          .post(`/parties/${newId()}/close`)
          .set(getAuthHeader(tenantId, user.id))
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('PARTY_NOT_FOUND'));
      });
    });

    describe('when the partyId is not a valid UUID', () => {
      it('returns 400 and INCORRECT_PARTY_ID', async () => {
        const user = await createAUser();

        await request(app)
          .post('/parties/some-uuid/close')
          .set(getAuthHeader(tenantId, user.id))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INCORRECT_PARTY_ID'));
      });
    });

    describe('when the partyId is valid, but the close reason is not set', () => {
      it('returns 400 and CLOSE_REASON_REQUIRED', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });

        await request(app)
          .post(`/parties/${party.id}/close`)
          .set(getAuthHeader(tenantId, user.id))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('CLOSE_REASON_REQUIRED'));
      });
    });

    describe('when the user does not have access to the party', () => {
      it('returns 403 and FORBIDDEN token', async () => {
        const party = await createAParty();

        await request(app)
          .post(`/parties/${party.id}/close`)
          .set(getAuthHeader())
          .expect(403)
          .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
      });
    });

    describe('when the user is owner', () => {
      it('should mark the party as closed and save the close reason', async () => {
        const user = await createAUser();
        const party = await createAParty({ userId: user.id });

        const response = await request(app)
          .post(`/parties/${party.id}/close`)
          .set(getAuthHeader(tenantId, user.id))
          .send({ closeReasonId: DALTypes.ClosePartyReasons.NO_LONGER_MOVING })
          .expect(200);

        const responseBody = response.body;
        expect(responseBody.endDate).to.be.ok;
        expect(responseBody.metadata.closeReasonId).to.equal(DALTypes.ClosePartyReasons.NO_LONGER_MOVING);
      });
    });

    describe('when the user is not the owner and is a member of one of the party teams', () => {
      it('returns 200 OK', async () => {
        const team = await createATeam(testTeam);
        const team2 = await createATeam(testTeam2);
        const user = await createAUser();
        await createATeamMember({ teamId: team.id, userId: user.id });

        const owner = await createAUser();
        await createATeamMember({ teamId: team.id, userId: owner.id });

        const party = await createParty(ctx, {
          id: newId(),
          userId: owner.id,
          teams: [team2.id],
        });

        await request(app)
          .post(`/parties/${party.id}/close`)
          .set(getAuthHeader(tenantId, user.id, [{ id: team.id, mainRoles: ['LA'] }]))
          .send({ closeReasonId: DALTypes.ClosePartyReasons.NO_LONGER_MOVING })
          .expect(200);
      });
    });

    describe('when the user is not the owner but is member in one of the party teams', () => {
      it('should be able to mark the party as closed', async () => {
        const team = await createATeam(testTeam);
        const user = await createAUser();
        await createATeamMember({ teamId: team.id, userId: user.id });

        const owner = await createAUser();
        await createATeamMember({ teamId: team.id, userId: owner.id });

        const party = await createParty(ctx, {
          id: newId(),
          userId: owner.id,
          teams: [team.id],
        });

        const response = await request(app)
          .post(`/parties/${party.id}/close`)
          .set(getAuthHeader(tenantId, user.id, [{ id: team.id, mainRoles: ['LA'] }]))
          .send({ closeReasonId: DALTypes.ClosePartyReasons.NO_LONGER_MOVING })
          .expect(200);

        const responseBody = response.body;
        expect(responseBody.endDate).to.be.ok;
      });
    });

    describe('when the request is valid', () => {
      const setupMsgQueueAndWaitFor = async (conditions, workerKeysToBeStarted) => {
        const { resolvers, promises } = waitFor(conditions);
        const matcher = createResolverMatcher(resolvers);
        await setupConsumers(chan(), matcher, workerKeysToBeStarted);
        return { task: Promise.all(promises) };
      };

      it('should cancel any future tasks related to the party', async () => {
        const team = await createATeam(testTeam);
        const user = await createAUser();
        await createATeamMember({ teamId: team.id, userId: user.id });

        const owner = await createAUser();
        await createATeamMember({ teamId: team.id, userId: owner.id });

        const party = await createParty(ctx, {
          id: newId(),
          userId: owner.id,
          teams: [team.id],
        });

        let dueDateTomorow = now();
        dueDateTomorow = toMoment(dueDateTomorow).add(1, 'day');
        const createFollowupPartyTask = partyId => ({
          name: DALTypes.TaskNames.FOLLOWUP_PARTY,
          category: DALTypes.TaskCategories.INACTIVE,
          partyId,
        });
        const createManualTask = partyId => ({
          name: 'test Name',
          category: DALTypes.TaskCategories.MANUAL,
          partyId,
          dueDate: dueDateTomorow,
        });

        await createATask(createFollowupPartyTask(party.id));
        await createATask(createManualTask(party.id));
        await createAnAppointment({
          partyId: party.id,
          salesPersonId: user.id,
          startDate: dueDateTomorow,
          endDate: dueDateTomorow,
        });

        const events = await getAllUserEvents(ctx, user.id);
        expect(events.length).to.equal(1);

        const queueConditionforTaskCancel = (msg, handlerSucceeded) => {
          const matchedParty = msg.partyId === party.id;
          if (matchedParty && !handlerSucceeded) {
            throw new Error('handler failed!'); // this will cause the waiter to reject, failing the test
          }
          return matchedParty;
        };
        const { task: cancelTask } = await setupMsgQueueAndWaitFor([queueConditionforTaskCancel], ['tasks']);

        await request(app)
          .post(`/parties/${party.id}/close`)
          .set(getAuthHeader(tenantId, user.id, [{ id: team.id, mainRoles: ['LM'] }]))
          .send({ closeReasonId: DALTypes.ClosePartyReasons.NO_LONGER_MOVING })
          .expect(200);

        await cancelTask;

        const res = await request(app).get(`/parties/${party.id}/tasks`).set(getAuthHeader(tenantId, user.id)).expect(200);

        expect(res.body.length).to.equal(3);
        res.body.forEach(t => expect(t.state).to.equal(DALTypes.TaskStates.CANCELED));

        const eventsAfterClose = await getAllUserEvents(ctx, user.id);
        expect(eventsAfterClose.length).to.equal(0);
      });

      it('should mark as read all communications related to the party', async () => {
        const team = await createATeam(testTeam);
        const user = await createAUser();
        await createATeamMember({ teamId: team.id, userId: user.id });

        const owner = await createAUser();
        await createATeamMember({ teamId: team.id, userId: owner.id });

        const party = await createParty(ctx, {
          id: newId(),
          userId: owner.id,
          teams: [team.id],
          ownerTeam: team.id,
        });

        const comm = await createACommunicationEntry({
          parties: [party.id],
          unread: true,
          message: {
            subject: 'Last chance',
            text: 'You take the blue pill - the story ends, you wake up in your bed and believe whatever you want to believe.',
          },
        });

        await request(app)
          .post(`/parties/${party.id}/close`)
          .set(getAuthHeader(tenantId, user.id, [{ id: team.id, mainRoles: ['LM'] }]))
          .send({
            closeReasonId: DALTypes.ClosePartyReasons.FOUND_ANOTHER_PLACE,
          })
          .expect(200);

        const { status, body } = await request(app)
          .post('/parties/communications')
          .set(getAuthHeader(tenantId, user.id))
          .send({ partyIds: [party.id] });

        expect(status).to.equal(200);
        expect(body.length).to.equal(1);
        expect(body[0].id).to.equal(comm.id);
        expect(body[0].unread).to.equal(false);
      });

      describe('and a contact party declined decision exists', () => {
        let partyId;
        let teamId;
        let userId;
        let property;

        beforeEach(async () => {
          const sheetsForTemplates = [
            {
              workbookSheetName: spreadsheet.BusinessEntity.workbookSheetName,
              getEntities: getBusinessEntityFromWorkbook,
              importEntities: importBusinessEntities,
              headers: spreadsheet.BusinessEntity.columns,
            },
            {
              workbookSheetName: spreadsheet.PropertyGroup.workbookSheetName,
              getEntities: getPropertyGroupFromWorkbook,
              importEntities: importPropertyGroups,
              headers: spreadsheet.PropertyGroup.columns,
            },
            {
              workbookSheetName: spreadsheet.PartyCohorts.workbookSheetName,
              getEntities: getPartyCohortsFromWorkbook,
              importEntities: importPartyCohorts,
              headers: spreadsheet.PartyCohorts.columns,
            },
            {
              workbookSheetName: spreadsheet.Property.workbookSheetName,
              getEntities: getPropertyFromWorkbook,
              importEntities: importProperties,
              isAllowedForCustomerAdmin: true,
              headers: spreadsheet.Property.columns,
            },
            {
              workbookSheetName: spreadsheet.CommsTemplate.workbookSheetName,
              getEntities: getCommsTemplatesFromWorkbook,
              importEntities: importCommsTemplates,
              headers: spreadsheet.CommsTemplate.columns,
            },
            {
              workbookSheetName: spreadsheet.CommsTemplateSettings.workbookSheetName,
              getEntities: getCommsTemplatesSettingsFromWorkbook,
              importEntities: importCommsTemplateSettings,
              headers: spreadsheet.CommsTemplateSettings.columns,
            },
            {
              workbookSheetName: spreadsheet.TemplateShortCode.workbookSheetName,
              getEntities: getTemplateShortCodesFromWorkbook,
              importEntities: importTemplateShortCodes,
              headers: spreadsheet.TemplateShortCode.columns,
            },
          ];

          const setupSampleData = async () => {
            const inventoryFilePath = path.join(__dirname, '../../../import/__tests__/resources/Inventory.xlsx');

            await processWorkbook(ctx, await parse(inventoryFilePath), sheetsForTemplates);
          };

          await setupSampleData();

          const team = await createATeam(testTeam);
          teamId = team.id;

          const user = await createAUser();
          userId = user.id;

          await createATeamMember({ teamId: team.id, userId: user.id });

          const owner = await createAUser();
          await createATeamMember({ teamId: team.id, userId: owner.id });

          property = await getPropertyByName(ctx, 'cove');
          await updateProperty(
            ctx,
            { id: property.id },
            { settings: { applicationReview: { sendAALetterOnDecline: true }, application: { urlPropPolicy: 'testUrl' } } },
          );
          const party = await createAParty({ userId: owner.id, teams: [team.id], assignedPropertyId: property.id }, ctx);
          partyId = party.id;

          const program = await createAProgram({ property: { id: party.assignedPropertyId } });

          await addATeamPropertyProgram(ctx, {
            teamId: team.id,
            propertyId: party.assignedPropertyId,
            programId: program.id,
            commDirection: 'out',
          });

          const contactInfo = enhance([{ type: 'email', value: 'john@doe.io', id: newId() }]);
          await createAPartyMember(party.id, {
            memberType: DALTypes.MemberType.RESIDENT,
            memberState: DALTypes.PartyStateType.APPLICANT,
            fullname: 'TEST',
            contactInfo,
          });

          await createAQuotePromotion(partyId, DALTypes.PromotionStatus.CANCELED);
        });

        describe('if the tasks is active and no declined application communication was sent', () => {
          it('should send the application declined communication', async () => {
            const createContactPartyDeclinedDecisionTask = () => ({
              name: DALTypes.TaskNames.CONTACT_PARTY_DECLINE_DECISION,
              category: DALTypes.TaskCategories.APPLICATION_APPROVAL,
              partyId,
              dueDate: now(),
              state: DALTypes.TaskStates.ACTIVE,
            });

            await createATask(createContactPartyDeclinedDecisionTask());

            await request(app)
              .post(`/parties/${partyId}/close`)
              .set(getAuthHeader(tenantId, userId, [{ id: teamId, mainRoles: ['LA'] }]))
              .send({ closeReasonId: DALTypes.ClosePartyReasons.NO_LONGER_MOVING })
              .expect(200);

            const applicationDeniedComms = await getCommunicationsForPartyByCategory(ctx, partyId, DALTypes.CommunicationCategory.APPLICATION_DECLINED);
            expect(applicationDeniedComms).to.have.length(1);
          });
        });

        describe('if the tasks is active and a declined application communication was sent', () => {
          it('should not send another application declined communication', async () => {
            const createContactPartyDeclinedDecisionTask = () => ({
              name: DALTypes.TaskNames.CONTACT_PARTY_DECLINE_DECISION,
              category: DALTypes.TaskCategories.APPLICATION_APPROVAL,
              partyId,
              dueDate: now(),
              state: DALTypes.TaskStates.ACTIVE,
            });

            await createATask(createContactPartyDeclinedDecisionTask());

            const communication = await createACommunicationEntry({
              parties: [partyId],
              category: DALTypes.CommunicationCategory.APPLICATION_DECLINED,
              message: {
                subject: 'Last chance',
                text: 'You take the blue pill - the story ends, you wake up in your bed and believe whatever you want to believe.',
              },
            });
            await request(app)
              .post(`/parties/${partyId}/close`)
              .set(getAuthHeader(tenantId, userId, [{ id: teamId, mainRoles: ['LA'] }]))
              .send({ closeReasonId: DALTypes.ClosePartyReasons.NO_LONGER_MOVING })
              .expect(200);

            const applicationDeniedComms = await getCommunicationsForPartyByCategory(ctx, partyId, DALTypes.CommunicationCategory.APPLICATION_DECLINED);
            expect(applicationDeniedComms).to.have.length(1);
            expect(applicationDeniedComms[0].id).to.equal(communication.id);
          });
        });

        describe('if the tasks is completed and no declined application communication was sent', () => {
          it('should send the application declined communication', async () => {
            const createContactPartyDeclinedDecisionTask = () => ({
              name: DALTypes.TaskNames.CONTACT_PARTY_DECLINE_DECISION,
              category: DALTypes.TaskCategories.APPLICATION_APPROVAL,
              partyId,
              dueDate: now(),
              state: DALTypes.TaskStates.COMPLETED,
            });

            await createATask(createContactPartyDeclinedDecisionTask());

            await request(app)
              .post(`/parties/${partyId}/close`)
              .set(getAuthHeader(tenantId, userId, [{ id: teamId, mainRoles: ['LA'] }]))
              .send({ closeReasonId: DALTypes.ClosePartyReasons.NO_LONGER_MOVING })
              .expect(200);

            const applicationDeniedComms = await getCommunicationsForPartyByCategory(ctx, partyId, DALTypes.CommunicationCategory.APPLICATION_DECLINED);
            expect(applicationDeniedComms).to.have.length(1);
          });
        });

        describe('if no declined application communication was sent but the sendAALetterOnDecline flag is false', () => {
          it('should not send the application declined communication', async () => {
            await updateProperty(ctx, { id: property.id }, { settings: { ...property.settings, applicationReview: { sendAALetterOnDecline: false } } });

            await request(app)
              .post(`/parties/${partyId}/close`)
              .set(getAuthHeader(tenantId, userId, [{ id: teamId, mainRoles: ['LA'] }]))
              .send({ closeReasonId: DALTypes.ClosePartyReasons.NO_LONGER_MOVING })
              .expect(200);

            const applicationDeniedComms = await getCommunicationsForPartyByCategory(ctx, partyId, DALTypes.CommunicationCategory.APPLICATION_DECLINED);
            expect(applicationDeniedComms).to.have.length(0);
          });
        });

        describe('if no declined application communication was sent but the party is closed with the reason APPLICATION_DECLINED', () => {
          it('should send the application declined communication', async () => {
            await request(app)
              .post(`/parties/${partyId}/close`)
              .set(getAuthHeader(tenantId, userId, [{ id: teamId, mainRoles: ['LA'] }]))
              .send({
                closeReasonId: Object.keys(DALTypes.ClosePartyReasons).find(
                  key => DALTypes.ClosePartyReasons[key] === DALTypes.ClosePartyReasons.APPLICATION_DECLINED,
                ),
              })
              .expect(200);

            const applicationDeniedComms = await getCommunicationsForPartyByCategory(ctx, partyId, DALTypes.CommunicationCategory.APPLICATION_DECLINED);
            expect(applicationDeniedComms).to.have.length(1);
          });
        });
      });
    });
  });
});
