/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import sortBy from 'lodash/sortBy';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { loadParties } from '../../../dal/partyRepo';
import { updateUser } from '../../../dal/usersRepo';
import { getAllComms, getCommunicationByMessageId } from '../../../dal/communicationRepo';
import { loadProgramForIncomingCommByPhone } from '../../../dal/programsRepo';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import {
  testCtx as ctx,
  createAUser,
  createATeam,
  createATeamMember,
  createAParty,
  createAPartyMember,
  createAPersonContactInfo,
  createAPerson,
  createAProperty,
  createATeamPropertyProgram,
  createVoiceMessages,
  makeProgramInactive,
} from '../../../testUtils/repoHelper';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import {
  postCallback,
  postDirect,
  post,
  expectToContainDialToUser,
  makeUsersSipEndpointsOnline,
  makeSipEndpointsOnline,
} from '../../../testUtils/telephonyHelper';
import { getVoiceMessage } from '../../../services/telephony/voiceMessages';
import { DialStatus, CallStatus } from '../../../services/telephony/enums';
import { CommTargetType } from '../../../services/routing/targetUtils';
import { detachProgramPhoneNumbers } from '../../../workers/communication/detachPhoneNumbersHandler';

describe('given a request for an incoming call', () => {
  const firstCallerPhoneNo = '12025550395';
  const secondCallerPhoneNo = '12025550196';
  const thirdCallerPhoneNo = '12025550197';
  const secondUserPhoneNo = '12025550191';
  const callCenterPhoneNo = '12025550393';
  const firstMemberPhoneNo = '12025550180';
  const programPhoneNo = '12025550150';
  const secondProgramPhoneNo = '12025550151';

  const sortPartiesByCreateDate = parties => sortBy(parties, 'created_at');

  const createProgram = async (teamId, directPhoneIdentifier, propertyId) => {
    const programPropertyId = propertyId || (await createAProperty()).id;
    return await createATeamPropertyProgram({
      teamId,
      propertyId: programPropertyId,
      directPhoneIdentifier,
      commDirection: DALTypes.CommunicationDirection.IN,
    });
  };

  const createTeam = async (callRoutingStrategy, partyRoutingStrategy, callCenterPhoneNumber = '', programPhone = programPhoneNo) => {
    const teamMetadata = {
      callRoutingStrategy,
      partyRoutingStrategy,
    };
    const team = await createATeam({
      name: 'testTeam',
      module: 'leasing',
      metadata: teamMetadata,
      callCenterPhoneNumber,
    });

    const { programId } = await createProgram(team.id, programPhone);

    return { team, programId };
  };

  const addDispatcherToTeam = async (teamId, status = DALTypes.UserStatus.AVAILABLE, emailIdentifier = 'email-identifier') => {
    const dispatcher = await createAUser({
      ctx,
      name: 'the dispatcher',
      email: `${emailIdentifier}@domain.com`,
      status,
    });
    const roles = {
      mainRoles: [MainRoleDefinition.LA.name],
      functionalRoles: [FunctionalRoleDefinition.LD.name, FunctionalRoleDefinition.LWA.name],
    };
    await createATeamMember({ teamId, userId: dispatcher.id, roles });
    return dispatcher;
  };

  const makeRequest = async (fromPhoneNo, toPhoneNo) => {
    const callId = getUUID();
    const response = await postDirect()
      .send({ To: toPhoneNo })
      .send({ CallerName: 'The caller' })
      .send({ CallStatus: CallStatus.RINGING })
      .send({ From: fromPhoneNo })
      .send({ CallUUID: callId });
    return { ...response, callId };
  };

  const expectToPlayRingingTone = text => expect(text).to.contain('<Play');

  describe('when the phone number belongs to a user', () => {
    describe('and no party exists for the caller', () => {
      describe('and the user is not available', () => {
        it('a party should be created and assigned to the user and the response should contain unavailable message', async () => {
          const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
          const user = await createAUser({
            ctx,
            name: 'user1_name',
            email: 'user1@domain.com',
            status: DALTypes.UserStatus.NOT_AVAILABLE,
          });
          const voiceMessages = await createVoiceMessages();
          const { id: teamMemberId } = await createATeamMember({
            teamId: team.id,
            userId: user.id,
            directPhoneIdentifier: firstMemberPhoneNo,
            voiceMessageId: voiceMessages.id,
          });

          const { status, text } = await makeRequest(firstCallerPhoneNo, firstMemberPhoneNo);
          expect(status).to.equal(200);
          const parties = await loadParties(ctx);

          // a party is created
          expect(parties.length).to.equal(1);
          expect(parties[0].userId).to.equal(user.id);

          // response contains unavailable message
          expect(text).to.contain('<Speak');

          const { message } = await getVoiceMessage(ctx, { teamMemberId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
          expect(text).to.contain(message);
        });

        describe('and the user is inactive, but there is another user available', () => {
          it('a party should be created and assigned to another user based on the Round Robin strategy and the party owner should be called', async () => {
            const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
            const user = await createAUser({
              ctx,
              name: 'first user',
              email: 'user1@domain.com',
              status: DALTypes.UserStatus.AVAILABLE,
              isAdmin: false,
            });
            const user2 = await createAUser({
              ctx,
              name: 'second user',
              email: 'user2@domain.com',
              status: DALTypes.UserStatus.AVAILABLE,
              isAdmin: false,
            });
            await createATeamMember({ teamId: team.id, userId: user.id, directPhoneIdentifier: firstMemberPhoneNo, inactive: true });
            await createATeamMember({ teamId: team.id, userId: user2.id, inactive: false });
            await addDispatcherToTeam(team.id);

            makeUsersSipEndpointsOnline([user2]);

            const { status, text } = await makeRequest(firstCallerPhoneNo, firstMemberPhoneNo);
            expect(status).to.equal(200);
            const parties = await loadParties(ctx);

            // a party is created and assigned to first available user based on Round Robin strategy
            expect(parties.length).to.equal(1);
            expect(parties[0].userId).to.equal(user2.id);

            // party owner is called
            expectToContainDialToUser(text, user2);
          });
        });

        describe('and the user is inactive and there is no other user available', () => {
          it("a party should be created and assigned to the team's dispatcher and the team's dispatcher should be called", async () => {
            const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);

            const user = await createAUser({
              ctx,
              name: 'user1_name',
              email: 'user1@domain.com',
              status: DALTypes.UserStatus.AVAILABLE,
              isAdmin: false,
            });

            const user2 = await createAUser({
              ctx,
              name: 'user2_name',
              email: 'user2@domain.com',
              status: DALTypes.UserStatus.NOT_AVAILABLE,
              isAdmin: false,
            });

            await createATeamMember({ teamId: team.id, userId: user.id, directPhoneIdentifier: firstMemberPhoneNo, inactive: true });
            await createATeamMember({ teamId: team.id, userId: user2.id, inactive: false });
            const dispatcher = await addDispatcherToTeam(team.id, DALTypes.UserStatus.AVAILABLE);

            makeUsersSipEndpointsOnline([dispatcher]);

            const { status, text } = await makeRequest(firstCallerPhoneNo, firstMemberPhoneNo);
            expect(status).to.equal(200);
            const parties = await loadParties(ctx);

            // a party is created and assigned to the team's dispatcher
            expect(parties.length).to.equal(1);
            expect(parties[0].userId).to.equal(dispatcher.id);

            // the team's dispatcher is called
            expectToContainDialToUser(text, dispatcher);
          });
        });
      });

      describe('when the user is available', () => {
        describe("but he doesn't respond for 25 seconds", () => {
          it('a party should be created and assigned to the user and the user should be called and the response should contain unavailabe message', async () => {
            const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
            const user = await createAUser({
              ctx,
              name: 'user1_name',
              email: 'user1@domain.com',
              status: DALTypes.UserStatus.AVAILABLE,
            });
            const { id: teamMemberId } = await createATeamMember({ teamId: team.id, userId: user.id, directPhoneIdentifier: firstMemberPhoneNo });

            makeUsersSipEndpointsOnline([user]);

            const { status, text, callId } = await makeRequest(firstCallerPhoneNo, firstMemberPhoneNo);
            expect(status).to.equal(200);
            let parties = await loadParties(ctx);
            expect(parties.length).to.equal(1);

            expectToContainDialToUser(text, user);
            const [{ id: commId }] = await getAllComms(ctx);
            const { text: postDialResponseText } = await post('postDial').send({
              userId: user.id,
              partyId: parties[0].id,
              CallUUID: callId,
              DialStatus: DialStatus.NO_ANSWER,
              commId,
              commTargetType: CommTargetType.TEAM_MEMBER,
              targetContextId: teamMemberId,
            });

            parties = await loadParties(ctx);

            expect(parties[0].userId).to.equal(user.id);
            expect(postDialResponseText).to.contain('<Speak');
            const { message } = await getVoiceMessage(ctx, { teamMemberId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
            expect(postDialResponseText).to.contain(message);
          });
        });
      });
    });
  });

  describe('when the phone number belongs to a team', () => {
    describe("when the call routing strategy is set to 'Everybody'", () => {
      [false, true].forEach(isKnownCaller => {
        const knownCallerCondition = isKnownCaller ? 'when a party exists for caller phone number' : 'when a party does not exist for caller phone number';

        it(`${knownCallerCondition} it should dial all available users' ring phones and online endpoints`, async () => {
          const { team } = await createTeam(DALTypes.CallRoutingStrategy.EVERYBODY, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);

          const notAvailableUser = await createAUser({
            ctx,
            name: 'notAvailableUser',
            status: DALTypes.UserStatus.NOT_AVAILABLE,
          });
          await createATeamMember({ teamId: team.id, userId: notAvailableUser.id });

          const busyUser = await createAUser({
            ctx,
            name: 'busyUser',
            status: DALTypes.UserStatus.BUSY,
          });
          await createATeamMember({ teamId: team.id, userId: busyUser.id });

          const onlineEndpoint1 = {
            username: 'onlineEndpoint1',
            endpointId: getUUID(),
            isUsedInApp: true,
          };
          const onlineEndpoint2 = {
            username: 'onlineEndpoint2',
            endpointId: getUUID(),
          };

          const offlineEndpoint1 = {
            username: 'offlineEndpoint1',
            endpointId: getUUID(),
          };
          const offlineEndpoint2 = {
            username: 'offlineEndpoint2',
            endpointId: getUUID(),
          };
          const offlineEndpoint3 = {
            username: 'offlineEndpoint3',
            endpointId: getUUID(),
          };

          const availableUser1 = await createAUser({
            ctx,
            name: 'availableUser',
            status: DALTypes.UserStatus.AVAILABLE,
            sipEndpoints: [onlineEndpoint1, onlineEndpoint2, offlineEndpoint1, offlineEndpoint2],
          });
          await createATeamMember({ teamId: team.id, userId: availableUser1.id });

          const ringPhone = '12025550342';
          const availableUser2 = await createAUser({
            ctx,
            name: 'availableUser2',
            status: DALTypes.UserStatus.AVAILABLE,
            sipEndpoints: [offlineEndpoint3],
            ringPhones: [ringPhone],
          });
          await createATeamMember({ teamId: team.id, userId: availableUser2.id });

          makeSipEndpointsOnline([onlineEndpoint1, onlineEndpoint2]);

          if (isKnownCaller) {
            const party = await createAParty({ userId: availableUser1.id, ownerTeam: team.id });
            const existingPartyMember = await createAPartyMember(party.id, {
              fullName: 'John Doe',
            });
            await createAPersonContactInfo(existingPartyMember.personId, {
              type: 'phone',
              value: firstCallerPhoneNo,
            });
          }

          const { text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
          expect(text).to.contain('<Dial');
          expect(text).to.contain(`<User>sip:${onlineEndpoint1.username}@phone.plivo.com</User>`);
          expect(text).to.contain(`<User>sip:${onlineEndpoint2.username}@phone.plivo.com</User>`);
          expect(text).to.contain(`<Number>${ringPhone}</Number>`);

          expect(text).to.not.contain(`<User>sip:${offlineEndpoint1.username}@phone.plivo.com</User>`);
          expect(text).to.not.contain(`<User>sip:${offlineEndpoint2.username}@phone.plivo.com</User>`);
          expect(text).to.not.contain(`<User>sip:${offlineEndpoint3.username}@phone.plivo.com</User>`);
        });
      });
    });

    describe('when no party exists for the caller', () => {
      describe("when the call routing strategy is set to 'Owner'", () => {
        describe("and the party routing strategy is set to 'Round Robin'", () => {
          describe('and there is no user available', () => {
            it("a party should be created and assigned to the team's Dispatcher and the team's Dispatcher should be called", async () => {
              const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
              const dispatcher = await addDispatcherToTeam(team.id);
              const user1 = await createAUser({
                ctx,
                name: 'user1_name',
                email: 'user1@domain.com',
                status: DALTypes.UserStatus.NOT_AVAILABLE,
              });
              await createATeamMember({ teamId: team.id, userId: user1.id });

              makeUsersSipEndpointsOnline([dispatcher]);

              const { status, text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
              expect(status).to.equal(200);
              const parties = await loadParties(ctx);

              // a party is created and assigned to the team's dispatcher
              expect(parties.length).to.equal(1);
              expect(parties[0].userId).to.equal(dispatcher.id);

              // the team's dispatcher is called
              expectToContainDialToUser(text, dispatcher);
            });
          });

          describe('and there is no user with sip endpoints', () => {
            it("a party should be created and assigned to the team's Dispatcher and the play voice mail", async () => {
              const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
              const dispatcher = await addDispatcherToTeam(team.id);
              const user1 = await createAUser({
                ctx,
                name: 'user1_name',
                email: 'user1@domain.com',
                status: DALTypes.UserStatus.AVAILABLE,
              });
              await updateUser({ tenantId: tenant.id }, user1.id, {
                sipEndpoints: [],
              });
              await updateUser({ tenantId: tenant.id }, dispatcher.id, {
                sipEndpoints: [],
              });
              await createATeamMember({ teamId: team.id, userId: user1.id });

              const { status, text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
              expect(status).to.equal(200);
              const parties = await loadParties(ctx);

              // a party is created and assigned to the team's dispatcher
              expect(parties.length).to.equal(1);
              expect(parties[0].userId).to.equal(dispatcher.id);

              // the team's dispatcher is called
              expect(text).to.contain('<Response');
              expect(text).to.contain('<Speak');
            });
          });

          describe('and there is only one user available', () => {
            describe('and one incoming call', () => {
              it('should create a party for the available user and the available user should be called', async () => {
                const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                const user1 = await createAUser({
                  ctx,
                  name: 'user1',
                  email: 'user1@domain.com',
                  status: DALTypes.UserStatus.AVAILABLE,
                });
                await createATeamMember({ teamId: team.id, userId: user1.id });
                makeUsersSipEndpointsOnline([user1]);

                const { status, text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                expect(status).to.equal(200);
                const parties = await loadParties(ctx);

                // a party is created and assigned to the available user
                expect(parties.length).to.equal(1);
                expect(parties[0].userId).to.equal(user1.id);

                // the available user is called
                expectToContainDialToUser(text, user1);
              });
            });

            describe('and two incoming calls (from different callers)', () => {
              it('two parties should be created, first for him, second unnasigned yet and he should be called once and the other call should wait', async () => {
                const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                const user1 = await createAUser({
                  ctx,
                  name: 'user1',
                  email: 'user1@domain.com',
                  status: DALTypes.UserStatus.AVAILABLE,
                });
                await createATeamMember({ teamId: team.id, userId: user1.id });

                makeUsersSipEndpointsOnline([user1]);

                const { text: textFirstCall } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                const { text: textSecondCall } = await makeRequest(secondCallerPhoneNo, programPhoneNo);
                const parties = await loadParties(ctx);

                expectToContainDialToUser(textFirstCall, user1);

                expectToPlayRingingTone(textSecondCall);

                expect(parties.length).to.equal(2);
                expect(parties.some(party => party.userId === user1.id)).to.be.ok;
                expect(parties.some(party => !party.userId)).to.be.ok;
              });
            });
          });

          describe('and there are two users available', () => {
            describe('and one incoming call', () => {
              it('a party is created for the first user and the first user should be called', async () => {
                const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                const user1 = await createAUser({
                  ctx,
                  name: 'user1',
                  email: 'user1@domain.com',
                  status: DALTypes.UserStatus.AVAILABLE,
                });
                await createATeamMember({ teamId: team.id, userId: user1.id });
                const user2 = await createAUser({
                  ctx,
                  name: 'user2',
                  email: 'user2@domain.com',
                  status: DALTypes.UserStatus.AVAILABLE,
                });
                await createATeamMember({ teamId: team.id, userId: user2.id });

                makeUsersSipEndpointsOnline([user1]);

                const { text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                const parties = await loadParties(ctx);

                expect(parties.length).to.equal(1);
                expect(parties[0].userId).to.equal(user1.id);
                expectToContainDialToUser(text, user1);
              });
            });

            describe('and two incoming calls (from different callers)', () => {
              it(
                'a party should be created for the first user ' +
                  'and the first user should be called ' +
                  'and a new party is created for the second user ' +
                  'and the second user should be called',
                async () => {
                  const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                  const user1 = await createAUser({
                    ctx,
                    name: 'user1',
                    email: 'user1@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user1.id });
                  const user2 = await createAUser({
                    ctx,
                    name: 'user2',
                    email: 'user2@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user2.id });

                  makeUsersSipEndpointsOnline([user1, user2]);

                  const { text: firstCallText } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                  const { text: secondCallText } = await makeRequest(secondCallerPhoneNo, programPhoneNo);

                  const parties = await loadParties(ctx);
                  const sortedParties = sortPartiesByCreateDate(parties);
                  expect(parties.length).to.equal(2);
                  expect(sortedParties[0].userId).to.equal(user1.id);
                  expect(sortedParties[1].userId).to.equal(user2.id);

                  expectToContainDialToUser(firstCallText, user1);
                  expectToContainDialToUser(secondCallText, user2);
                },
              );
            });

            describe('and three incoming calls (from different callers)', () => {
              it(
                'one party should be created for the first user' +
                  'and the first user should be called 1 time' +
                  'and a new party is created for the second user ' +
                  'and the second user should be called 1 time' +
                  'and the third call should wait and the party should not be assigned yet',
                async () => {
                  const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                  const user1 = await createAUser({
                    ctx,
                    name: 'user1',
                    email: 'user1@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user1.id });
                  const user2 = await createAUser({
                    ctx,
                    name: 'user2',
                    email: 'user2@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user2.id });

                  makeUsersSipEndpointsOnline([user1, user2]);

                  const { text: firstCallText } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                  const { text: secondCallText } = await makeRequest(secondCallerPhoneNo, programPhoneNo);
                  const { text: thirdCallText } = await makeRequest(thirdCallerPhoneNo, programPhoneNo);

                  const parties = await loadParties(ctx);
                  const sortedParties = sortPartiesByCreateDate(parties);

                  expect(sortedParties[0].userId).to.equal(user1.id);
                  expect(sortedParties[1].userId).to.equal(user2.id);
                  expect(sortedParties[2].userId).to.not.be.ok;

                  expect(firstCallText).to.contain('<Dial');
                  expect(firstCallText).to.contain(`<User>sip:${user1.sipEndpoints[0].username}@phone.plivo.com</User>`);
                  expect(secondCallText).to.contain('<Dial');
                  expect(secondCallText).to.contain(`<User>sip:${user2.sipEndpoints[0].username}@phone.plivo.com</User>`);

                  expectToPlayRingingTone(thirdCallText);
                },
              );
            });
          });
        });

        describe("and the party routing strategy is set to 'Dispatcher'", () => {
          describe('and one incoming call', () => {
            it("a party should be created and assigned to the team's Dispatcher and the team's Dispatcher should be called", async () => {
              const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.DISPATCHER);
              const dispatcher = await addDispatcherToTeam(team.id, DALTypes.UserStatus.AVAILABLE);
              const user1 = await createAUser({
                ctx,
                name: 'user1_name',
                email: 'user1@domain.com',
                status: DALTypes.UserStatus.AVAILABLE,
              });
              await createATeamMember({ teamId: team.id, userId: user1.id });

              makeUsersSipEndpointsOnline([dispatcher]);

              const { text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
              const parties = await loadParties(ctx);

              expect(parties.length).to.equal(1);
              expect(parties[0].userId).to.equal(dispatcher.id);
              expect(text).to.contain('<Dial');
              expect(text).to.contain(`<User>sip:${dispatcher.sipEndpoints[0].username}@phone.plivo.com</User>`);
            });
          });

          describe('and two incoming calls (from different callers)', () => {
            it(
              "two parties should be created and one should be assigned to the team's Dispatcher " +
                "and the team's Dispatcher should be called 1 time and 1 call should wait",
              async () => {
                const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.DISPATCHER);
                const dispatcher = await addDispatcherToTeam(team.id, DALTypes.UserStatus.AVAILABLE);
                const user1 = await createAUser({
                  ctx,
                  name: 'user1_name',
                  email: 'user1@domain.com',
                  status: DALTypes.UserStatus.AVAILABLE,
                });
                await createATeamMember({ teamId: team.id, userId: user1.id });

                makeUsersSipEndpointsOnline([dispatcher]);

                const { text: firstCallText } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                const { text: secondCallText } = await makeRequest(secondCallerPhoneNo, programPhoneNo);
                const parties = await loadParties(ctx);

                expect(parties.length).to.equal(2);
                expect(parties.some(party => party.userId === dispatcher.id)).to.be.ok;
                expect(parties.some(party => !party.userId)).to.be.ok;

                expect(firstCallText).to.contain('<Dial');
                expect(firstCallText).to.contain(`<User>sip:${dispatcher.sipEndpoints[0].username}@phone.plivo.com</User>`);
                expectToPlayRingingTone(secondCallText);
              },
            );
          });
        });
      });

      describe("when the call routing strategy is set to 'Round Robin'", () => {
        describe("and the party routing strategy is set to 'Round Robin'", () => {
          describe('and there is no user available', () => {
            it("should create a party and assign it to the team's Dispatcher", async () => {
              const { team } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
              const dispatcher = await addDispatcherToTeam(team.id, DALTypes.UserStatus.NOT_AVAILABLE);
              const user1 = await createAUser({
                ctx,
                name: 'user1',
                email: 'user1@domain.com',
                status: DALTypes.UserStatus.NOT_AVAILABLE,
              });
              const voiceMessages = await createVoiceMessages();
              const { id: teamMemberId } = await createATeamMember({ teamId: team.id, userId: user1.id, voiceMessageId: voiceMessages.id });

              const { text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
              const parties = await loadParties(ctx);
              expect(parties.length).to.equal(1);
              expect(parties[0].userId).to.equal(dispatcher.id);
              expect(text).to.contain('<Speak');

              const { message } = await getVoiceMessage(ctx, { teamMemberId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
              expect(text).to.contain(message);
            });
          });

          describe('and there is only one user available', () => {
            describe('and he answers the call', () => {
              describe('and one incoming call', () => {
                it('should create a party for the available user', async () => {
                  const { team } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                  const user1 = await createAUser({
                    ctx,
                    name: 'user1',
                    email: 'user1@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user1.id });

                  makeUsersSipEndpointsOnline([user1]);

                  await makeRequest(firstCallerPhoneNo, programPhoneNo);
                  let parties = await loadParties(ctx);
                  expect(parties.length).to.equal(1);

                  const [{ id: commId }] = await getAllComms(ctx);
                  await postCallback(user1, parties[0], commId).send({
                    DialBLegTo: `sip:${user1.sipEndpoints[0].username}@phone.plivo.com`,
                  });

                  parties = await loadParties(ctx);
                  expect(parties[0].userId).to.equal(user1.id);
                });
              });

              describe('and two incoming calls', () => {
                it('should create 2 parties for the available user', async () => {
                  const { team } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                  const user1 = await createAUser({
                    ctx,
                    name: 'user1',
                    email: 'user1@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  const voiceMessages = await createVoiceMessages();
                  await createATeamMember({ teamId: team.id, userId: user1.id, voiceMessageId: voiceMessages.id });

                  makeUsersSipEndpointsOnline([user1]);
                  // first call
                  await makeRequest(firstCallerPhoneNo, programPhoneNo);
                  let parties = await loadParties(ctx);
                  expect(parties.length).to.equal(1);
                  const [{ id: commId }] = await getAllComms(ctx);

                  await postCallback(user1, parties[0], commId).send({
                    DialBLegTo: `sip:${user1.sipEndpoints[0].username}@phone.plivo.com`,
                  });

                  parties = await loadParties(ctx);
                  expect(parties[0].userId).to.equal(user1.id);

                  // second call
                  await makeRequest(secondCallerPhoneNo, programPhoneNo);
                  parties = await loadParties(ctx);
                  let sortedParties = sortPartiesByCreateDate(parties);
                  expect(sortedParties.length).to.equal(2);

                  const [, { id: secondCommId }] = await getAllComms(ctx);
                  await postCallback(user1, sortedParties[1], secondCommId).send({
                    DialBLegTo: `sip:${user1.sipEndpoints[0].username}@phone.plivo.com`,
                  });

                  parties = await loadParties(ctx);
                  sortedParties = sortPartiesByCreateDate(parties);
                  expect(sortedParties.map(party => party.userId)).to.deep.equal([user1.id, user1.id]);
                });
              });
            });
            describe('and he does not answer to the call', () => {
              describe('and one incoming call', () => {
                it('should create a party for the available user', async () => {
                  const { team, programId } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                  const user1 = await createAUser({
                    ctx,
                    name: 'user1',
                    email: 'user1@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user1.id });

                  makeUsersSipEndpointsOnline([user1]);

                  const { text, callId } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                  let parties = await loadParties(ctx);
                  expect(parties.length).to.equal(1);
                  expect(parties[0].userId).to.be.null;

                  expectToContainDialToUser(text, user1);

                  const [{ id: commId }] = await getAllComms(ctx);
                  const postDialResponse = await post('postDial').send({
                    userId: user1.id,
                    partyId: parties[0].id,
                    CallUUID: callId,
                    DialStatus: DialStatus.NO_ANSWER,
                    commId,
                    commTargetType: CommTargetType.PROGRAM,
                    targetContextId: programId,
                  });

                  parties = await loadParties(ctx);
                  expect(parties[0].userId).to.equal(user1.id);
                  expect(postDialResponse.text).to.contain('Speak');
                  const { message } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
                  expect(postDialResponse.text).to.contain(message);
                });
              });

              describe('and two incoming calls (from different callers)', () => {
                it('should create 2 parties for the available user', async () => {
                  const { team, programId } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                  const user1 = await createAUser({
                    ctx,
                    name: 'user1',
                    email: 'user1@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user1.id });

                  makeUsersSipEndpointsOnline([user1]);

                  // first call
                  const { text: firstCallText, callId: firstCallId } = await makeRequest(firstCallerPhoneNo, programPhoneNo);

                  let parties = await loadParties(ctx);
                  expect(parties.length).to.equal(1);
                  expect(parties[0].userId).to.be.null;
                  expectToContainDialToUser(firstCallText, user1);

                  const [{ id: commId }] = await getAllComms(ctx);
                  const firstPostDialResponse = await post('postDial').send({
                    userId: user1.id,
                    partyId: parties[0].id,
                    CallUUID: firstCallId,
                    DialStatus: DialStatus.NO_ANSWER,
                    commId,
                    commTargetType: CommTargetType.PROGRAM,
                    targetContextId: programId,
                  });

                  parties = await loadParties(ctx);
                  expect(parties[0].userId).to.equal(user1.id);
                  expect(firstPostDialResponse.text).to.contain('Speak');
                  const { message } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
                  expect(firstPostDialResponse.text).to.contain(message);

                  // second call
                  const { text: secondCallText, callId: secondCallId } = await makeRequest(secondCallerPhoneNo, programPhoneNo);

                  parties = await loadParties(ctx);
                  expect(parties.length).to.equal(2);
                  let sortedParties = sortPartiesByCreateDate(parties);
                  expect(sortedParties[1].userId).to.be.null;

                  expectToContainDialToUser(secondCallText, user1);

                  const [, { id: secondCommId }] = await getAllComms(ctx);
                  const secondpostDirectResponse = await post('postDial').send({
                    userId: user1.id,
                    partyId: sortedParties[1].id,
                    CallUUID: secondCallId,
                    DialStatus: DialStatus.NO_ANSWER,
                    commId: secondCommId,
                    commTargetType: CommTargetType.PROGRAM,
                    targetContextId: programId,
                  });

                  parties = await loadParties(ctx);
                  sortedParties = sortPartiesByCreateDate(parties);
                  expect(parties[1].userId).to.equal(user1.id);
                  expect(secondpostDirectResponse.text).to.contain('Speak');
                  const { message: unavailable } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
                  expect(secondpostDirectResponse.text).to.contain(unavailable);
                });
              });
            });
          });

          describe('and there are two users available', () => {
            describe('and one incoming call', () => {
              describe('and the first available user answers to the call', () => {
                it('should create a party for the first user available (sorting by fullName asc)', async () => {
                  const { team } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                  // set user2.fullName < user1.fullName to make sure the Round Robin is working correctly (first available user, sorted by fullName asc)
                  const user1 = await createAUser({
                    ctx,
                    name: 'user1',
                    email: 'user1@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user1.id });
                  const user2 = await createAUser({
                    ctx,
                    name: 'user0',
                    email: 'user0@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user2.id });

                  makeUsersSipEndpointsOnline([user2]);

                  const { text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                  let parties = await loadParties(ctx);
                  expect(parties.length).to.equal(1);

                  expectToContainDialToUser(text, user2);

                  const [{ id: commId }] = await getAllComms(ctx);
                  await postCallback(user2, parties[0], commId).send({
                    DialBLegTo: `sip:${user2.sipEndpoints[0].username}@phone.plivo.com`,
                  });

                  parties = await loadParties(ctx);
                  expect(parties[0].userId).to.equal(user2.id);
                });
              });

              describe('and the first available user does not answer to the call', () => {
                it('should create a party for the second user available (sorting by fullName asc)', async () => {
                  const { team, programId } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                  const user1 = await createAUser({
                    ctx,
                    name: 'user1',
                    email: 'user1@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user1.id });
                  const user2 = await createAUser({
                    ctx,
                    name: 'user2',
                    email: 'user0@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user2.id });

                  makeUsersSipEndpointsOnline([user1]);

                  const { text, callId } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                  let parties = await loadParties(ctx);
                  expect(parties.length).to.equal(1);
                  expectToContainDialToUser(text, user1);

                  const [{ id: commId }] = await getAllComms(ctx);
                  const postDialResponse = await post('postDial').send({
                    userId: user1.id,
                    partyId: parties[0].id,
                    CallUUID: callId,
                    DialStatus: DialStatus.NO_ANSWER,
                    commId,
                    commTargetType: CommTargetType.PROGRAM,
                    targetContextId: programId,
                  });

                  parties = await loadParties(ctx);
                  expect(parties[0].userId).to.equal(user2.id);
                  expect(postDialResponse.text).to.contain('Speak');
                  const { message } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
                  expect(postDialResponse.text).to.contain(message);
                });
              });
            });

            describe('and two incoming calls (from different callers)', () => {
              describe('and both users answer to the call', () => {
                it(
                  'should create a party for the first user available determined by Round Robin algorithm (sorting by fullName asc) ' +
                    'and a new party for the second user available determined by Round Robin algorithm',
                  async () => {
                    const { team } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);

                    const user1 = await createAUser({
                      ctx,
                      name: 'user1',
                      email: 'user1@domain.com',
                      status: DALTypes.UserStatus.AVAILABLE,
                    });
                    await createATeamMember({ teamId: team.id, userId: user1.id });

                    const user2 = await createAUser({
                      ctx,
                      name: 'user2',
                      email: 'user0@domain.com',
                      status: DALTypes.UserStatus.AVAILABLE,
                    });
                    await createATeamMember({ teamId: team.id, userId: user2.id });

                    makeUsersSipEndpointsOnline([user1, user2]);

                    // first call
                    const { text: firstCallText } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                    let parties = await loadParties(ctx);
                    expect(parties.length).to.equal(1);
                    expect(parties[0].userId).to.be.null;
                    expectToContainDialToUser(firstCallText, user1);

                    const [{ id: commId }] = await getAllComms(ctx);
                    await postCallback(user1, parties[0], commId).send({
                      DialBLegTo: `sip:${user1.sipEndpoints[0].username}@phone.plivo.com`,
                    });

                    parties = await loadParties(ctx);
                    expect(parties[0].userId).to.equal(user1.id);

                    // second call
                    const { text: secondCallText } = await makeRequest(secondCallerPhoneNo, programPhoneNo);
                    parties = await loadParties(ctx);
                    expect(parties.length).to.equal(2);
                    let sortedParties = sortPartiesByCreateDate(parties);
                    expect(sortedParties[1].userId).to.be.null;

                    expectToContainDialToUser(secondCallText, user2);

                    const [, { id: secondCommId }] = await getAllComms(ctx);
                    await postCallback(user2, sortedParties[1], secondCommId).send({
                      DialBLegTo: `sip:${user2.sipEndpoints[0].username}@phone.plivo.com`,
                    });

                    parties = await loadParties(ctx);
                    sortedParties = sortPartiesByCreateDate(parties);
                    expect(sortedParties.map(party => party.userId)).to.deep.equal([user1.id, user2.id]);
                  },
                );
              });

              describe('and no user answers to the call', () => {
                it('should create two parties and direct both calls to the first user and assign both parties to the second user', async () => {
                  const { team, programId } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);

                  const user1 = await createAUser({
                    ctx,
                    name: 'user1',
                    email: 'user1@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user1.id });
                  const user2 = await createAUser({
                    ctx,
                    name: 'user2',
                    email: 'user2@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user2.id });

                  makeUsersSipEndpointsOnline([user1, user2]);

                  // first call
                  const { text: firstCallText, callId: firstCallId } = await makeRequest(firstCallerPhoneNo, programPhoneNo);

                  let parties = await loadParties(ctx);
                  expect(parties.length).to.equal(1);

                  expectToContainDialToUser(firstCallText, user1);

                  const [{ id: commId }] = await getAllComms(ctx);
                  const firstPostDialResponse = await post('postDial').send({
                    userId: user1.id,
                    partyId: parties[0].id,
                    CallUUID: firstCallId,
                    DialStatus: DialStatus.NO_ANSWER,
                    commId,
                    commTargetType: CommTargetType.PROGRAM,
                    targetContextId: programId,
                  });

                  parties = await loadParties(ctx);
                  expect(parties[0].userId).to.equal(user2.id);
                  expect(firstPostDialResponse.text).to.contain('Speak');
                  const { message } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
                  expect(firstPostDialResponse.text).to.contain(message);

                  // second call
                  const { text: secondCallText, callId: secondCallId } = await makeRequest(secondCallerPhoneNo, programPhoneNo);

                  parties = await loadParties(ctx);
                  expect(parties.length).to.equal(2);
                  let sortedParties = sortPartiesByCreateDate(parties);

                  expectToContainDialToUser(secondCallText, user1);
                  const [, { id: secondCommId }] = await getAllComms(ctx);

                  const secondPostDialResponse = await post('postDial').send({
                    userId: user1.id,
                    partyId: sortedParties[1].id,
                    CallUUID: secondCallId,
                    DialStatus: DialStatus.NO_ANSWER,
                    commId: secondCommId,
                    commTargetType: CommTargetType.PROGRAM,
                    targetContextId: programId,
                  });

                  parties = await loadParties(ctx);
                  sortedParties = sortPartiesByCreateDate(parties);
                  expect(sortedParties.map(party => party.userId)).to.deep.equal([user2.id, user2.id]);
                  expect(secondPostDialResponse.text).to.contain('Speak');
                  const { message: unavailable } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
                  expect(secondPostDialResponse.text).to.contain(unavailable);
                });
              });

              describe('and only the first call is answered', () => {
                it(
                  'should call the first user and assign the first party to him ' +
                    'and should call the second user ' +
                    'and assign the second party also to the first user',
                  async () => {
                    const { team, programId } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                    const user1 = await createAUser({
                      ctx,
                      name: 'user1',
                      email: 'user1@domain.com',
                      status: DALTypes.UserStatus.AVAILABLE,
                    });
                    await createATeamMember({ teamId: team.id, userId: user1.id });
                    const user2 = await createAUser({
                      ctx,
                      name: 'user2',
                      email: 'user2@domain.com',
                      status: DALTypes.UserStatus.AVAILABLE,
                    });
                    await createATeamMember({ teamId: team.id, userId: user2.id });

                    makeUsersSipEndpointsOnline([user1, user2]);

                    // first call
                    const { callId: firstCallId, text: firstCallText } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                    let parties = await loadParties(ctx);
                    expect(parties.length).to.equal(1);
                    expect(parties[0].userId).to.be.null;
                    expectToContainDialToUser(firstCallText, user1);

                    const [{ id: commId }] = await getAllComms(ctx);
                    await postCallback(user1, parties[0], commId).send({
                      DialBLegTo: `sip:${user1.sipEndpoints[0].username}@phone.plivo.com`,
                    });

                    // complete first call
                    await post('postDial').send({
                      userId: user1.id,
                      partyId: parties[0].id,
                      CallUUID: firstCallId,
                      DialStatus: DialStatus.COMPLETED,
                      commId,
                    });

                    parties = await loadParties(ctx);
                    expect(parties[0].userId).to.equal(user1.id);

                    // second call
                    const { text: secondCallText, callId } = await makeRequest(secondCallerPhoneNo, programPhoneNo);
                    parties = await loadParties(ctx);
                    let sortedParties = sortPartiesByCreateDate(parties);
                    expect(sortedParties.length).to.equal(2);
                    expectToContainDialToUser(secondCallText, user2);

                    const [, { id: secondCommId }] = await getAllComms(ctx);
                    const secondPostDialResponse = await post('postDial').send({
                      userId: user2.id,
                      partyId: sortedParties[1].id,
                      CallUUID: callId,
                      DialStatus: DialStatus.NO_ANSWER,
                      commId: secondCommId,
                      commTargetType: CommTargetType.PROGRAM,
                      targetContextId: programId,
                    });

                    parties = await loadParties(ctx);
                    sortedParties = sortPartiesByCreateDate(parties);

                    expect(sortedParties.map(party => party.userId)).to.deep.equal([user1.id, user1.id]);
                    expect(secondPostDialResponse.text).to.contain('Speak');
                    const { message: unavailable } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
                    expect(secondPostDialResponse.text).to.contain(unavailable);
                  },
                );
              });

              describe('and only the second call is answered', () => {
                it(
                  'should call the first user and assign the first party to him ' +
                    'and should call the second user ' +
                    'and assign the second party also to the first user',
                  async () => {
                    const { team, programId } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                    const user1 = await createAUser({
                      ctx,
                      name: 'user1',
                      email: 'user1@domain.com',
                      status: DALTypes.UserStatus.AVAILABLE,
                    });
                    await createATeamMember({ teamId: team.id, userId: user1.id });
                    const user2 = await createAUser({
                      ctx,
                      name: 'user2',
                      email: 'user2@domain.com',
                      status: DALTypes.UserStatus.AVAILABLE,
                    });
                    await createATeamMember({ teamId: team.id, userId: user2.id });

                    makeUsersSipEndpointsOnline([user1, user2]);

                    // first call
                    const { text: firstCallText, callId } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                    let parties = await loadParties(ctx);
                    expect(parties.length).to.equal(1);
                    expect(parties[0].userId).to.be.null;
                    expectToContainDialToUser(firstCallText, user1);

                    const [{ id: commId }] = await getAllComms(ctx);

                    const firstPostDialResponse = await post('postDial').send({
                      userId: user1.id,
                      partyId: parties[0].id,
                      CallUUID: callId,
                      DialStatus: DialStatus.NO_ANSWER,
                      commId,
                      commTargetType: CommTargetType.PROGRAM,
                      targetContextId: programId,
                    });

                    parties = await loadParties(ctx);
                    expect(parties[0].userId).to.equal(user2.id);
                    expect(firstPostDialResponse.text).to.contain('Speak');
                    const { message } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
                    expect(firstPostDialResponse.text).to.contain(message);

                    // second call
                    const { text: secondCallText } = await makeRequest(secondCallerPhoneNo, programPhoneNo);
                    parties = await loadParties(ctx);
                    expect(parties.length).to.equal(2);
                    expectToContainDialToUser(secondCallText, user1);

                    const [, { id: secondCommId }] = await getAllComms(ctx);

                    let sortedParties = sortPartiesByCreateDate(parties);
                    await postCallback(user1, sortedParties[1], secondCommId).send({
                      DialBLegTo: `sip:${user1.sipEndpoints[0].username}@phone.plivo.com`,
                    });

                    parties = await loadParties(ctx);
                    sortedParties = sortPartiesByCreateDate(parties);
                    expect(sortedParties.map(party => party.userId)).to.deep.equal([user2.id, user1.id]);
                  },
                );
              });
            });

            describe('and three incoming calls (from different callers)', () => {
              it(
                'should create 2 parties for the first user available determined by Round Robin algorithm (sorting by fullName asc) ' +
                  'and 1 party for the second user available determined by Round Robin algorithm',
                async () => {
                  const { team } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);

                  // set user2.fullName < user1.fullName to make sure the Round Robin is working correctly (first available user, sorted by fullName asc)
                  const user1 = await createAUser({
                    ctx,
                    name: 'user1',
                    email: 'user1@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                  });
                  await createATeamMember({ teamId: team.id, userId: user1.id });
                  const user2 = await createAUser({
                    ctx,
                    name: 'user0',
                    directEmailIdentifier: 'user0-email-identifier',
                    email: 'user0@domain.com',
                    status: DALTypes.UserStatus.AVAILABLE,
                    directPhoneIdentifier: secondUserPhoneNo,
                  });
                  await createATeamMember({ teamId: team.id, userId: user2.id });

                  makeUsersSipEndpointsOnline([user1, user2]);

                  // first call
                  const { callId: firstCallId, text: firstCallText } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                  let parties = await loadParties(ctx);
                  expect(parties.length).to.equal(1);
                  expectToContainDialToUser(firstCallText, user2);
                  expect(firstCallText).to.contain(`<User>sip:${user2.sipEndpoints[0].username}@phone.plivo.com</User>`);

                  const { id: commId } = await getCommunicationByMessageId(ctx, firstCallId);
                  await postCallback(user2, parties[0], commId).send({
                    DialBLegTo: `sip:${user2.sipEndpoints[0].username}@phone.plivo.com`,
                  });

                  await post('postDial').send({
                    userId: user2.id,
                    partyId: parties[0].id,
                    CallUUID: firstCallId,
                    DialStatus: DialStatus.COMPLETED,
                    commId,
                  });

                  parties = await loadParties(ctx);
                  expect(parties[0].userId).to.equal(user2.id);

                  // second call
                  const { callId: secondCallId, text: secondCallText } = await makeRequest(secondCallerPhoneNo, programPhoneNo);
                  parties = await loadParties(ctx);
                  expect(parties.length).to.equal(2);
                  expectToContainDialToUser(secondCallText, user1);

                  const { id: secondCommId } = await getCommunicationByMessageId(ctx, secondCallId);

                  let sortedParties = sortPartiesByCreateDate(parties);
                  await postCallback(user1, sortedParties[1], secondCommId).send({
                    DialBLegTo: `sip:${user1.sipEndpoints[0].username}@phone.plivo.com`,
                  });

                  await post('postDial').send({
                    userId: user1.id,
                    partyId: sortedParties[1].id,
                    CallUUID: secondCallId,
                    DialStatus: DialStatus.COMPLETED,
                    commId: secondCommId,
                  });

                  parties = await loadParties(ctx);
                  sortedParties = sortPartiesByCreateDate(parties);
                  expect(sortedParties.map(party => party.userId)).to.deep.equal([user2.id, user1.id]);

                  // third call
                  const { callId: thirdCallId, text: thirdCallText } = await makeRequest(thirdCallerPhoneNo, programPhoneNo);
                  parties = await loadParties(ctx);
                  expect(parties.length).to.equal(3);
                  expectToContainDialToUser(thirdCallText, user2);

                  const { id: thirdCommId } = await getCommunicationByMessageId(ctx, thirdCallId);

                  sortedParties = sortPartiesByCreateDate(parties);
                  await postCallback(user2, sortedParties[2], thirdCommId).send({
                    DialBLegTo: `sip:${user2.sipEndpoints[0].username}@phone.plivo.com`,
                  });

                  await post('postDial').send({
                    userId: user2.id,
                    partyId: sortedParties[2].id,
                    CallUUID: thirdCallId,
                    DialStatus: DialStatus.COMPLETED,
                    commId: thirdCommId,
                  });

                  parties = await loadParties(ctx);
                  sortedParties = sortPartiesByCreateDate(parties);
                  expect(sortedParties.map(party => party.userId)).to.deep.equal([user2.id, user1.id, user2.id]);
                },
              );
            });
          });

          describe('and there is an inactive user in the team', () => {
            it('should skip the inactive user from the routing strategy', async () => {
              const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);

              const user1 = await createAUser({
                ctx,
                name: 'user0',
                email: 'user1@domain.com',
                status: DALTypes.UserStatus.AVAILABLE,
              });
              await createATeamMember({ teamId: team.id, userId: user1.id });
              const user2 = await createAUser({
                ctx,
                name: 'user1',
                email: 'user2@domain.com',
                status: DALTypes.UserStatus.AVAILABLE,
              });
              await createATeamMember({ teamId: team.id, userId: user2.id, roles: {}, inactive: true });
              const user3 = await createAUser({
                ctx,
                name: 'user2',
                email: 'user3@domain.com',
                status: DALTypes.UserStatus.AVAILABLE,
              });
              await createATeamMember({ teamId: team.id, userId: user3.id });

              makeUsersSipEndpointsOnline([user1, user2, user3]);

              // first call
              const { callId: firstCallId, text: firstCallText } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
              let parties = await loadParties(ctx);
              expect(parties.length).to.equal(1);
              expectToContainDialToUser(firstCallText, user1);
              const [{ id: commId }] = await getAllComms(ctx);

              await postCallback(user1, parties[0], commId).send({
                DialBLegTo: `sip:${user1.sipEndpoints[0].username}@phone.plivo.com`,
              });
              await post('postDial').send({
                userId: user1.id,
                partyId: parties[0].id,
                CallUUID: firstCallId,
                DialStatus: DialStatus.COMPLETED,
                commId,
              });

              parties = await loadParties(ctx);
              expect(parties[0].userId).to.equal(user1.id);

              // second call
              const { callId: secondCallId, text: secondCallText } = await makeRequest(secondCallerPhoneNo, programPhoneNo);
              parties = await loadParties(ctx);
              expect(parties.length).to.equal(2);
              expectToContainDialToUser(secondCallText, user3);

              let sortedParties = sortPartiesByCreateDate(parties);

              const [, { id: secondCommId }] = await getAllComms(ctx);
              await postCallback(user3, sortedParties[1], secondCommId).send({
                DialBLegTo: `sip:${user3.sipEndpoints[0].username}@phone.plivo.com`,
              });
              await post('postDial').send({
                userId: user3.id,
                partyId: sortedParties[1].id,
                CallUUID: secondCallId,
                DialStatus: DialStatus.COMPLETED,
                commId,
              });

              parties = await loadParties(ctx);
              sortedParties = sortPartiesByCreateDate(parties);
              expect(sortedParties.map(party => party.userId)).to.deep.equal([user1.id, user3.id]);

              // third call
              const { callId: thirdCallId, text: thirdCallText } = await makeRequest(thirdCallerPhoneNo, programPhoneNo);
              parties = await loadParties(ctx);
              expect(parties.length).to.equal(3);
              expectToContainDialToUser(thirdCallText, user1);
              sortedParties = sortPartiesByCreateDate(parties);

              const [, , { id: thirdCommId }] = await getAllComms(ctx);
              await postCallback(user1, sortedParties[2], thirdCommId).send({
                DialBLegTo: `sip:${user1.sipEndpoints[0].username}@phone.plivo.com`,
              });
              await post('postDial').send({
                userId: user1.id,
                partyId: sortedParties[2].id,
                CallUUID: thirdCallId,
                DialStatus: DialStatus.COMPLETED,
                commId: thirdCommId,
              });

              parties = await loadParties(ctx);
              sortedParties = sortPartiesByCreateDate(parties);
              expect(sortedParties.map(party => party.userId)).to.deep.equal([user1.id, user3.id, user1.id]);
            });
          });
        });

        describe("and the party routing strategy is set to 'Dispatcher'", () => {
          describe('and there is no user available to answer to the call', () => {
            it("a party should be created and assigned to the team's Dispatcher", async () => {
              const { team } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.DISPATCHER);
              const dispatcher = await addDispatcherToTeam(team.id, DALTypes.UserStatus.NOT_AVAILABLE);
              const user1 = await createAUser({
                ctx,
                name: 'user1_name',
                email: 'user1@domain.com',
                status: DALTypes.UserStatus.NOT_AVAILABLE,
              });
              const voiceMessages = await createVoiceMessages();
              const { id: teamMemberId } = await createATeamMember({ teamId: team.id, userId: user1.id, voiceMessageId: voiceMessages.id });

              const { text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
              const parties = await loadParties(ctx);
              expect(parties.length).to.equal(1);
              expect(parties[0].userId).to.equal(dispatcher.id);
              expect(text).to.contain('<Speak');
              const { message } = await getVoiceMessage(ctx, { teamMemberId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
              expect(text).to.contain(message);
            });
          });

          describe('and there is a user available to answer to the call, but he does not answer', () => {
            it(
              'a party should be created without an owner' +
                'and the available user should be called ' +
                "and the party should be assigned to the team's Dispatcher (after 25 seconds)",
              async () => {
                const { team, programId } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.DISPATCHER);
                const dispatcher = await addDispatcherToTeam(team.id, DALTypes.UserStatus.NOT_AVAILABLE);
                const user1 = await createAUser({
                  ctx,
                  name: 'user1_name',
                  email: 'user1@domain.com',
                  status: DALTypes.UserStatus.AVAILABLE,
                });
                await createATeamMember({ teamId: team.id, userId: user1.id });

                makeUsersSipEndpointsOnline([user1]);

                const { text, callId } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                let parties = await loadParties(ctx);
                expect(parties.length).to.equal(1);
                expectToContainDialToUser(text, user1);

                const [{ id: commId }] = await getAllComms(ctx);
                const postDialResponse = await post('postDial').send({
                  userId: user1.id,
                  partyId: parties[0].id,
                  CallUUID: callId,
                  DialStatus: DialStatus.NO_ANSWER,
                  commId,
                  commTargetType: CommTargetType.PROGRAM,
                  targetContextId: programId,
                });

                parties = await loadParties(ctx);
                expect(parties[0].userId).to.equal(dispatcher.id);
                expect(postDialResponse.text).to.contain('Speak');
                const { message } = await getVoiceMessage(ctx, { programId, messageType: DALTypes.VoiceMessageType.UNAVAILABLE });
                expect(postDialResponse.text).to.contain(message);
              },
            );
          });
        });
      });
    });

    describe('when a party exists for the caller', () => {
      describe("when the call routing strategy is set to 'Owner'", () => {
        describe("and the party routing strategy is set to 'Round Robin'", () => {
          describe('and there is only one user available', () => {
            describe('and one incoming call', () => {
              it('should not create a new party and should call the owner of the existing party', async () => {
                const { team } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
                const user1 = await createAUser({
                  ctx,
                  name: 'user1',
                  email: 'user1@domain.com',
                  status: DALTypes.UserStatus.AVAILABLE,
                });
                await createATeamMember({ teamId: team.id, userId: user1.id });
                const user2 = await createAUser({
                  ctx,
                  name: 'user2',
                  email: 'user2@domain.com',
                  status: DALTypes.UserStatus.AVAILABLE,
                });
                await createATeamMember({ teamId: team.id, userId: user2.id });
                const program = await loadProgramForIncomingCommByPhone(ctx, programPhoneNo);

                makeUsersSipEndpointsOnline([user1, user2]);

                // existing party
                const party = await createAParty({
                  userId: user2.id,
                  teams: [team.id],
                  ownerTeam: team.id,
                  assignedPropertyId: program.propertyId,
                });
                const existingPartyMember = await createAPartyMember(party.id, { fullName: 'User2' });
                await createAPersonContactInfo(existingPartyMember.personId, {
                  type: 'phone',
                  value: firstCallerPhoneNo,
                });

                const { text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                const parties = await loadParties(ctx);
                expect(parties.length).to.equal(1);
                expectToContainDialToUser(text, user2);
              });
            });
          });
        });
      });
    });

    describe('when a party exists for the caller', () => {
      describe("when the call routing strategy is set to 'Round Robing'", () => {
        describe("and the party routing strategy is set to 'Dispatcher'", () => {
          describe('and there is only one user available', () => {
            describe('and one incoming call', () => {
              it('should not create a new party and should call the available user even if it is not the owner', async () => {
                const { team } = await createTeam(DALTypes.CallRoutingStrategy.ROUND_ROBIN, DALTypes.PartyRoutingStrategy.DISPATCHER);
                const user1 = await createAUser({
                  ctx,
                  name: 'user1',
                  email: 'user1@domain.com',
                  status: DALTypes.UserStatus.AVAILABLE,
                });
                await createATeamMember({ teamId: team.id, userId: user1.id });
                const user2 = await createAUser({
                  ctx,
                  name: 'user2',
                  email: 'user2@domain.com',
                  status: DALTypes.UserStatus.UNAVAILABLE,
                });
                await createATeamMember({ teamId: team.id, userId: user2.id });
                const program = await loadProgramForIncomingCommByPhone(ctx, programPhoneNo);

                makeUsersSipEndpointsOnline([user1, user2]);

                // existing party
                const party = await createAParty({
                  userId: user2.id,
                  teams: [team.id],
                  ownerTeam: team.id,
                  assignedPropertyId: program.propertyId,
                });
                const existingPartyMember = await createAPartyMember(party.id, { fullName: 'User2' });
                await createAPersonContactInfo(existingPartyMember.personId, {
                  type: 'phone',
                  value: firstCallerPhoneNo,
                });

                const { text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
                const parties = await loadParties(ctx);
                expect(parties.length).to.equal(1);
                expectToContainDialToUser(text, user1);
              });
            });
          });
        });
      });
    });

    describe('when a party exists for the caller but in another team and different property', () => {
      it('should create a new party for the current team and the call should be routed to the current team', async () => {
        const team1 = await createATeam({
          name: 'team1',
          module: 'leasing',
          metadata: {
            callRoutingStrategy: DALTypes.CallRoutingStrategy.ROUND_ROBIN,
            partyRoutingStrategy: DALTypes.PartyRoutingStrategy.DISPATCHER,
          },
        });

        const user1 = await createAUser({
          ctx,
          name: 'user1',
          status: DALTypes.UserStatus.AVAILABLE,
        });

        await createATeamMember({ teamId: team1.id, userId: user1.id });

        const existingParty = await createAParty({
          userId: user1.id,
          teams: [team1.id],
          ownerTeam: team1.id,
        });
        const existingPartyMember = await createAPartyMember(existingParty.id, {
          fullName: 'john doe',
        });
        await createAPersonContactInfo(existingPartyMember.personId, {
          type: 'phone',
          value: firstCallerPhoneNo,
        });

        const team2 = await createATeam({
          name: 'team2',
          module: 'leasing',
          metadata: {
            callRoutingStrategy: DALTypes.CallRoutingStrategy.ROUND_ROBIN,
            partyRoutingStrategy: DALTypes.PartyRoutingStrategy.DISPATCHER,
          },
        });
        await createProgram(team2.id, secondProgramPhoneNo);

        const user2 = await createAUser({
          ctx,
          name: 'user2',
          status: DALTypes.UserStatus.AVAILABLE,
        });

        await createATeamMember({ teamId: team2.id, userId: user2.id });

        makeUsersSipEndpointsOnline([user1, user2]);

        const { text } = await makeRequest(firstCallerPhoneNo, secondProgramPhoneNo);
        const parties = await loadParties(ctx);
        expect(parties.length).to.equal(2);

        const createdParty = parties.find(p => p.id !== existingParty.id);
        expect(createdParty.teams).to.deep.equal([team2.id]);

        expectToContainDialToUser(text, user2);
      });
    });
  });

  describe("when the phone number belongs to a team and the call routing strategy is set to 'Call Center'", () => {
    describe('and no party exists for the caller', () => {
      it('a party should be created and assigned to the Call Center dispatcher and the call should be redirected to the Call Center', async () => {
        const { team } = await createTeam(DALTypes.CallRoutingStrategy.CALL_CENTER, DALTypes.PartyRoutingStrategy.DISPATCHER, callCenterPhoneNo);
        const dispatcher = await addDispatcherToTeam(team.id);
        const user1 = await createAUser({
          ctx,
          name: 'user1_name',
          email: 'user1@domain.com',
          status: DALTypes.UserStatus.NOT_AVAILABLE,
        });
        await createATeamMember({ teamId: team.id, userId: user1.id });

        makeUsersSipEndpointsOnline([dispatcher]);

        const { status, text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
        expect(status).to.equal(200);
        const parties = await loadParties(ctx);

        // a party is created and assigned to the team's dispatcher
        expect(parties.length).to.equal(1);
        expect(parties[0].userId).to.equal(dispatcher.id);

        // the call is redirected to the Call Center
        expect(text).to.contain('<Dial');
        expect(text).to.contain(`<Number>${callCenterPhoneNo}</Number>`);

        // Make sure CallerID is passed through to InContact
        expect(text).to.contain(`callerId="${firstCallerPhoneNo}"`);
      });
    });

    describe('when party exists for the caller and the party owner belongs to a Call Center team', () => {
      it('should not create a new party and the call should be redirected to the Call Center', async () => {
        const { team } = await createTeam(DALTypes.CallRoutingStrategy.CALL_CENTER, DALTypes.PartyRoutingStrategy.DISPATCHER, callCenterPhoneNo);
        const dispatcher = await addDispatcherToTeam(team.id);
        const user1 = await createAUser({
          ctx,
          name: 'user1_name',
          email: 'user1@domain.com',
          status: DALTypes.UserStatus.NOT_AVAILABLE,
        });
        await createATeamMember({ teamId: team.id, userId: user1.id });
        const program = await loadProgramForIncomingCommByPhone(ctx, programPhoneNo);

        makeUsersSipEndpointsOnline([dispatcher]);

        // existing party
        const party = await createAParty({
          userId: dispatcher.id,
          teams: [team.id],
          ownerTeam: team.id,
          assignedPropertyId: program.propertyId,
        });
        const existingPartyMember = await createAPartyMember(party.id, {
          fullName: 'John Doe',
        });
        await createAPersonContactInfo(existingPartyMember.personId, {
          type: 'phone',
          value: firstCallerPhoneNo,
        });

        const { status, text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
        expect(status).to.equal(200);
        const parties = await loadParties(ctx);

        // a new party is not created
        expect(parties.length).to.equal(1);

        // the call is redirected to the Call Center
        expect(text).to.contain('<Dial');
        expect(text).to.contain(`<Number>${callCenterPhoneNo}</Number>`);

        // Make sure CallerID is passed through to InContact
        expect(text).to.contain(`callerId="${firstCallerPhoneNo}"`);
      });
    });

    describe('when no party exists for the caller and number belongs to a program that has reached the end date', () => {
      it('should not create a new party and the call should be unsuccessfull', async () => {
        const { team } = await createTeam(DALTypes.CallRoutingStrategy.CALL_CENTER, DALTypes.PartyRoutingStrategy.DISPATCHER, callCenterPhoneNo);
        const dispatcher = await addDispatcherToTeam(team.id);
        const user1 = await createAUser({
          ctx,
          name: 'user1_name',
          email: 'user1@domain.com',
          status: DALTypes.UserStatus.AVAILABLE,
        });
        await createATeamMember({ teamId: team.id, userId: user1.id });
        const program = await loadProgramForIncomingCommByPhone(ctx, programPhoneNo);

        await makeProgramInactive(program.name);

        await detachProgramPhoneNumbers(ctx);

        makeUsersSipEndpointsOnline([dispatcher]);

        const programAfterDetach = await loadProgramForIncomingCommByPhone(ctx, programPhoneNo);

        expect(programAfterDetach).to.be.undefined;

        const { status, text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
        expect(status).to.equal(200);
        const parties = await loadParties(ctx);

        // no party was created because the number is not assigned to any program
        expect(parties.length).to.equal(0);

        // the call will receive the following Response
        /*
        <Response><Wait length="3"/><Speak language="en-US" voice="WOMAN">We are sorry.
         You have reached a number that has been disconnected or is no longer in service.
          If you feel that you have reached this recording on error,
           please check the number and try your call again.</Speak></Response>
      */
        expect(text).to.contain('You have reached a number that has been disconnected or is no longer in service');
      });
    });

    describe('when party exists for the caller and the party owner does not belong to the Call Center team anymore', () => {
      it('a new party should not be created and the party owner should be called', async () => {
        const { team: hubTeam } = await createTeam(
          DALTypes.CallRoutingStrategy.CALL_CENTER,
          DALTypes.PartyRoutingStrategy.DISPATCHER,
          callCenterPhoneNo,
          '12025550140',
        );
        const hubDispatcher = await addDispatcherToTeam(hubTeam.id, DALTypes.UserStatus.AVAILABLE, 'hub-dispatcher-email');
        const hubUser = await createAUser({
          ctx,
          name: 'hub_user_name',
          email: 'hub_user@domain.com',
          status: DALTypes.UserStatus.AVAILABLE,
        });
        await createATeamMember({ teamId: hubTeam.id, userId: hubUser.id });

        const { team: coveTeam } = await createTeam(DALTypes.CallRoutingStrategy.OWNER, DALTypes.PartyRoutingStrategy.DISPATCHER, callCenterPhoneNo);
        const coveDispatcher = await addDispatcherToTeam(coveTeam.id, DALTypes.UserStatus.AVAILABLE, 'cove-dispatcher-email');
        const coveUser = await createAUser({
          ctx,
          name: 'cove_user_name',
          email: 'cove_user@domain.com',
          status: DALTypes.UserStatus.AVAILABLE,
        });
        await createATeamMember({ teamId: coveTeam.id, userId: coveUser.id });
        const program = await loadProgramForIncomingCommByPhone(ctx, programPhoneNo);

        makeUsersSipEndpointsOnline([hubDispatcher, hubUser, coveDispatcher, coveUser]);

        // existing party
        const party = await createAParty({
          userId: coveUser.id,
          teams: [coveTeam.id],
          ownerTeam: coveTeam.id,
          collaborators: [hubDispatcher.id],
          assignedPropertyId: program.propertyId,
        });
        const existingPartyMember = await createAPartyMember(party.id, {
          fullName: 'John Doe',
        });
        await createAPersonContactInfo(existingPartyMember.personId, {
          type: 'phone',
          value: firstCallerPhoneNo,
        });

        const { status, text } = await makeRequest(firstCallerPhoneNo, programPhoneNo);
        expect(status).to.equal(200);
        const parties = await loadParties(ctx);

        // a new party is not created
        expect(parties.length).to.equal(1);

        // the party oowner should be called
        expectToContainDialToUser(text, coveUser);

        // Make sure CallerID is passed through to InContact
        expect(text).to.contain(`callerId="${firstCallerPhoneNo}"`);
      });
    });
    describe('when parties exists for the caller for different properties and the call has alias information', () => {
      it('a new party should not be created and only party owners of parties which match the alias should be callled', async () => {
        const { team: hubTeam } = await createTeam(
          DALTypes.CallRoutingStrategy.OWNER,
          DALTypes.PartyRoutingStrategy.DISPATCHER,
          callCenterPhoneNo,
          '12025550140',
        );
        const hubDispatcher = await addDispatcherToTeam(hubTeam.id, DALTypes.UserStatus.AVAILABLE, 'hub-dispatcher-email');
        const hubUser = await createAUser({
          ctx,
          name: 'hub_user_name',
          status: DALTypes.UserStatus.AVAILABLE,
        });
        await createATeamMember({ teamId: hubTeam.id, userId: hubUser.id });

        const secondUser = await createAUser({
          ctx,
          name: 'secondUser',
          status: DALTypes.UserStatus.AVAILABLE,
        });
        await createATeamMember({ teamId: hubTeam.id, userId: secondUser.id });

        const thirdUser = await createAUser({
          ctx,
          name: 'thirdUser',
          status: DALTypes.UserStatus.AVAILABLE,
        });
        await createATeamMember({ teamId: hubTeam.id, userId: thirdUser.id });

        makeUsersSipEndpointsOnline([hubDispatcher, hubUser, secondUser, thirdUser]);

        const property = await createAProperty();
        // existing pary
        const person = await createAPerson();
        const contactInfo = [
          {
            type: 'phone',
            value: firstCallerPhoneNo,
          },
        ];
        await createAPersonContactInfo(person.id, ...contactInfo);
        // 2 parties on the correct property
        await Promise.all(
          [secondUser, thirdUser].map(async user => {
            const party = await createAParty({
              userId: user.id,
              teams: [hubTeam.id],
              ownerTeam: hubTeam.id,
              assignedPropertyId: property.id,
            });
            return await createAPartyMember(party.id, {
              personId: person.id,
            });
          }),
        );
        // 2 parties on other properties - different Owner
        await Promise.all(
          [1, 2].map(async () => {
            const party = await createAParty({
              userId: hubUser.id,
              teams: [hubTeam.id],
              ownerTeam: hubTeam.id,
              assignedPropertyId: (await createAProperty()).id,
            });
            return await createAPartyMember(party.id, {
              personId: person.id,
            });
          }),
        );

        const programPhone = '12025550130';
        await createProgram(hubTeam.id, programPhone, property.id);
        const { status, text } = await makeRequest(firstCallerPhoneNo, programPhone);
        expect(status).to.equal(200);
        const parties = await loadParties(ctx);

        // a new party is not created
        expect(parties.length).to.equal(4);

        // the party oowner should be called
        [secondUser, thirdUser].forEach(user => {
          expectToContainDialToUser(text, user);
        });
        expect(text).to.not.contain(`<User>sip:${hubUser.sipEndpoints[0].username}@phone.plivo.com</User>`);

        // Make sure CallerID is passed through to InContact
        expect(text).to.contain(`callerId="${firstCallerPhoneNo}"`);
      });
    });
  });
});
