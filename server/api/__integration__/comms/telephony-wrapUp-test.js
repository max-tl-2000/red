/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import newId from 'uuid/v4';
import { testCtx as ctx, createATeam, createAUser, createATeamMember, createACommunicationEntry } from '../../../testUtils/repoHelper';
import { post, postPostDialBasic } from '../../../testUtils/telephonyHelper';
import { loadUserById } from '../../../services/users';
import { addCallToQueue } from '../../../dal/callQueueRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { setTelephonyOps } from '../../../services/telephony/providerApiOperations';
import { DialStatus } from '../../../services/telephony/enums';
import { SimpleScheduler } from '../../../../common/scheduler';

chai.use(sinonChai);
const expect = chai.expect;

const createTestTeam = async wrapUpDelay =>
  await createATeam({
    phone: '12025550196',
    metadata: {
      callQueue: {
        enabled: false,
      },
      call: {
        wrapUpDelayAfterCallEnds: wrapUpDelay, // in seconds
      },
      callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY,
    },
  });

describe('call wrap-up delay', () => {
  const { setScheduler, clearScheduler } = require('../../../services/telephony/userAvailability');
  let scheduler;

  beforeEach(() => {
    scheduler = new SimpleScheduler();
    setScheduler(scheduler);
  });

  afterEach(() => {
    clearScheduler();
  });

  describe('when 2 agents are called and one of them answers', () => {
    beforeEach(() => setTelephonyOps({ getLiveCalls: () => [] }));

    it('should keep the answering agent busy for a while and make all the others available immediately', async () => {
      const team = await createTestTeam(60);

      const { id: user1Id } = await createAUser({
        metadata: { status: DALTypes.UserStatus.BUSY },
      });
      const { id: user2Id } = await createAUser({
        metadata: { status: DALTypes.UserStatus.BUSY },
      });
      const receiversEndpointsByUserId = { [user1Id]: [], [user2Id]: [] };
      const { id: commId } = await createACommunicationEntry({
        message: { receiversEndpointsByUserId },
        userId: user1Id,
        teams: [team.id],
      });

      await createATeamMember({ teamId: team.id, userId: user1Id });
      await createATeamMember({ teamId: team.id, userId: user2Id });

      const res = await postPostDialBasic().send({ DialRingStatus: true }).send({ commId }).send({ DialStatus: DialStatus.COMPLETED });

      expect(res.status).to.equal(200);

      const answeringUser = await loadUserById(ctx, user1Id);
      const otherUser = await loadUserById(ctx, user2Id);

      expect(answeringUser.metadata.status).to.equal(DALTypes.UserStatus.BUSY);
      expect(otherUser.metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);

      await scheduler.flush();
    });

    it('should make the answering agent Available after the wrapUpDelayAfterCallEnds interval', async () => {
      const team = await createTestTeam(0.1);
      const { id: user1Id } = await createAUser({
        metadata: { status: DALTypes.UserStatus.BUSY },
      });
      const { id: user2Id } = await createAUser({
        metadata: { status: DALTypes.UserStatus.BUSY },
      });

      const receiversEndpointsByUserId = { [user1Id]: [], [user2Id]: [] };
      const { id: commId } = await createACommunicationEntry({
        message: { receiversEndpointsByUserId },
        userId: user1Id,
        teams: [team.id],
      });

      await createATeamMember({ teamId: team.id, userId: user1Id });
      await createATeamMember({ teamId: team.id, userId: user2Id });

      const res = await postPostDialBasic().send({ DialRingStatus: true }).send({ commId }).send({ DialStatus: DialStatus.COMPLETED });

      expect(res.status).to.equal(200);

      const otherUser = await loadUserById(ctx, user2Id);

      expect(otherUser.metadata.status).to.equal(DALTypes.UserStatus.AVAILABLE);

      await scheduler.flush();

      const answeringUser = await loadUserById(ctx, user1Id);
      expect(answeringUser.metadata.status).to.equal(
        DALTypes.UserStatus.AVAILABLE,
        'answering user should be Available after the wrapUp call interval has passed',
      );
    });
  });

  describe('when wrap up time expires and user is involved in a call triggerred for call queue', () => {
    it('should not mark the user available', async () => {
      const team = await createTestTeam(0.3);
      const { id: userId } = await createAUser({ metadata: { status: DALTypes.UserStatus.BUSY } });
      const { id: commId } = await createACommunicationEntry({ userId, teams: [team.id] });

      await createATeamMember({ teamId: team.id, userId });

      const firedCallToAgent = newId();
      const getLiveCalls = sinon.spy(() => [{ id: firedCallToAgent }]);
      setTelephonyOps({ getLiveCalls });

      const queuedCall = await createACommunicationEntry();
      const firedCallsToAgents = { [userId]: [firedCallToAgent] };
      await addCallToQueue(ctx, { commId: queuedCall.id, teamId: team.id, firedCallsToAgents });

      const { status } = await post('conferenceCallback').send({ ConferenceAction: 'exit' }).send({ commId });

      expect(status).to.equal(200);
      await scheduler.flush();

      const answeringUser = await loadUserById(ctx, userId);
      expect(answeringUser.metadata.status).to.equal(
        DALTypes.UserStatus.BUSY,
        'answering user should not be available after the wrapUp call interval when involved in a new call triggerred for queue',
      );
    });
  });
});
