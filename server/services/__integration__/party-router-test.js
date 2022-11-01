/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import getUUID from 'uuid/v4';
import { mapSeries } from 'bluebird';
import app from '../../api/api';
import { setupConsumers } from '../../workers/consumer';
import { waitFor } from '../../testUtils/apiHelper';
import { tenant, chan, createResolverMatcher } from '../../testUtils/setupTestGlobalContext';
import {
  createAUser,
  createATeam,
  createATeamMember,
  testCtx as ctx,
  officeHoursAlwaysOff,
  createAProperty,
  createATeamPropertyProgram,
} from '../../testUtils/repoHelper';
import { setGetEmailDetailsFunction, setDeleteS3MailFunction } from '../../workers/communication/inboundEmailHandler';
import { updateTeam, getTeamBy } from '../../dal/teamsRepo';
import { CommTargetType } from '../routing/targetUtils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getPartyRoutingUserId } from '../routing/partyRouter';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';
import config from '../../config';

describe('/partyRouter', () => {
  const postEmailUrl = `/webhooks/email?api-token=${config.tokens.api}`;
  const messageId = getUUID().toString();
  let firstEmailDetails;
  let secondEmailDetails;
  let thirdEmailDetails;
  let fourthEmailDetails;
  let user1;
  let user2;
  let user3;
  let team;

  beforeEach(async () => {
    setDeleteS3MailFunction(() => true);

    user1 = await createAUser({ ctx, name: 'Aegon', email: 'aegon@bar.com', status: DALTypes.UserStatus.AVAILABLE });
    user2 = await createAUser({ ctx, name: 'Jon', email: 'jon@bar.com', status: DALTypes.UserStatus.AVAILABLE });
    user3 = await createAUser({ ctx, name: 'Stannis', email: 'stannis@bar.com', status: DALTypes.UserStatus.AVAILABLE });
    team = await createATeam({ name: 'testTeam', module: 'leasing' });

    await createATeamMember({ teamId: team.id, userId: user1.id });
    await createATeamMember({ teamId: team.id, userId: user2.id });
    // this will be the leasing dispatcher
    await createATeamMember({
      teamId: team.id,
      userId: user3.id,
      roles: {
        mainRoles: [MainRoleDefinition.LA.name],
        functionalRoles: [FunctionalRoleDefinition.LWA.name, FunctionalRoleDefinition.LD.name],
      },
    });

    const programIdentifier = 'program-identifier';
    const { id: propertyId } = await createAProperty();
    await createATeamPropertyProgram({
      teamId: team.id,
      propertyId,
      directEmailIdentifier: programIdentifier,
      commDirection: DALTypes.CommunicationDirection.IN,
    });

    firstEmailDetails = {
      event: 'inbound',
      msg: {
        emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
        from_email: 'vanbasten@test.com',
        from_name: 'vanbasten',
        text: 'first email',
        subject: 'first email',
        messageId,
      },
    };

    secondEmailDetails = {
      event: 'inbound',
      msg: {
        emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
        from_email: 'maldini@test.com',
        from_name: 'maldini',
        text: 'second email',
        subject: 'second email',
        messageId,
      },
    };

    thirdEmailDetails = {
      event: 'inbound',
      msg: {
        emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
        from_email: 'beckenbauer@test.com',
        from_name: 'beckenbauer',
        text: 'third email',
        subject: 'third email',
        messageId,
      },
    };

    fourthEmailDetails = {
      event: 'inbound',
      msg: {
        emails: [`${programIdentifier}@${tenant.name}.${config.mail.emailDomain}`],
        from_email: 'baresi@test.com',
        from_name: 'baresi',
        text: 'fourth email',
        subject: 'fourth email',
        messageId,
      },
    };
  });

  describe('when an invalid routing strategy is passed', () => {
    it('should default to first Dispatcher strategy', async () => {
      const targetContext = {
        id: team.id,
        type: CommTargetType.TEAM,
      };

      team.metadata.partyRoutingStrategy = 'invalidStrategy';
      const routedUserId = await getPartyRoutingUserId(ctx, { targetContext, team });
      expect(routedUserId).to.equal(user3.id);
    });
  });

  describe('Dispatcher routing', () => {
    beforeEach(async () => {
      team = await updateTeam(ctx, team.id, {
        metadata: {
          partyRoutingStrategy: DALTypes.PartyRoutingStrategy.DISPATCHER,
        },
      });
    });

    it('the dispatcher should always be assigned to the newly created party', async () => {
      let routedUserId;
      const targetContext = {
        id: team.id,
        type: CommTargetType.TEAM,
      };

      const dispatcherCheck = async () => {
        routedUserId = await getPartyRoutingUserId(ctx, { targetContext, team });
        expect(routedUserId).to.equal(user3.id);
      };

      await mapSeries([1, 2, 3], async () => await dispatcherCheck());
    });
  });

  describe('Round Robin routing', () => {
    beforeEach(async () => {
      team = await updateTeam(ctx, team.id, {
        metadata: {
          partyRoutingStrategy: DALTypes.PartyRoutingStrategy.ROUND_ROBIN,
        },
      });
    });

    it('when receiving multiple emails the Round Robin algorithm assigns the correct user to newly created party', async () => {
      let teamToTest;

      const conditions = [];
      [1, 2, 3, 4].reduce(acc => {
        const id = getUUID();
        const condition = msg => msg.Key === id;
        acc.push({ id, condition });
        return acc;
      }, conditions);

      const { resolvers, promises } = waitFor(conditions.map(x => x.condition));
      const matcher = createResolverMatcher(resolvers);
      await setupConsumers(chan(), matcher, ['mail']);

      // email 1
      setGetEmailDetailsFunction(() => ({
        ...firstEmailDetails,
        msg: {
          ...firstEmailDetails.msg,
          messageId: conditions[0].id,
        },
      }));

      await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: conditions[0].id }).expect(200);
      let res = await promises[0];
      expect(res).to.be.true;

      teamToTest = await getTeamBy(ctx, { name: 'testTeam' });
      expect(teamToTest.metadata.lastAssignedUser).to.equal(user1.id);

      // email 2
      setGetEmailDetailsFunction(() => ({
        ...secondEmailDetails,
        msg: {
          ...secondEmailDetails.msg,
          messageId: conditions[1].id,
        },
      }));

      await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: conditions[1].id }).expect(200);

      res = await promises[1];
      expect(res).to.be.true;

      teamToTest = await getTeamBy(ctx, { name: 'testTeam' });
      expect(teamToTest.metadata.lastAssignedUser).to.equal(user2.id);

      // email 3
      setGetEmailDetailsFunction(() => ({
        ...thirdEmailDetails,
        msg: {
          ...thirdEmailDetails.msg,
          messageId: conditions[2].id,
        },
      }));

      await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: conditions[2].id }).expect(200);

      res = await promises[2];
      expect(res).to.be.true;
      teamToTest = await getTeamBy(ctx, { name: 'testTeam' });
      expect(teamToTest.metadata.lastAssignedUser).to.equal(user3.id);

      // email 4
      setGetEmailDetailsFunction(() => ({
        ...fourthEmailDetails,
        msg: {
          ...fourthEmailDetails.msg,
          messageId: conditions[3].id,
        },
      }));

      await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: conditions[3].id }).expect(200);

      res = await promises[3];
      expect(res).to.be.true;

      teamToTest = await getTeamBy(ctx, { name: 'testTeam' });
      expect(teamToTest.metadata.lastAssignedUser).to.equal(user1.id);
    });

    it('the Round Robin will default to Dispatcher if there are no LA roles assigned', async () => {
      const testTeam = await createATeam({ name: 'a', module: 'leasing' });
      const pmUser = await createAUser({ ctx, name: 'PM', email: 'jonpm@bar.com', status: DALTypes.UserStatus.AVAILABLE });
      const dispatcherUser = await createAUser({ ctx, name: 'dispatcher', email: 'dispatcher@bar.com', status: DALTypes.UserStatus.NOT_AVAILABLE });

      await createATeamMember({
        teamId: testTeam.id,
        userId: pmUser.id,
        roles: {
          mainRoles: [MainRoleDefinition.PM.name],
        },
      });
      await createATeamMember({
        teamId: testTeam.id,
        userId: dispatcherUser.id,
        roles: {
          mainRoles: [MainRoleDefinition.LM.name],
          functionalRoles: [FunctionalRoleDefinition.LD.name],
        },
      });

      let routedUserId;
      const targetContext = {
        id: testTeam.id,
        type: CommTargetType.TEAM,
      };

      const dispatcherCheck = async () => {
        routedUserId = await getPartyRoutingUserId(ctx, { targetContext, team: testTeam });
        expect(routedUserId).to.equal(dispatcherUser.id);
      };

      await mapSeries([1, 2, 3], async () => await dispatcherCheck());
    });

    it('the Round Robin will default to Dispatcher if there are no LWA users available', async () => {
      const testTeam = await createATeam({ name: 'a', module: 'leasing' });
      const laUser = await createAUser({ ctx, name: 'agent', email: 'jonpm@bar.com', status: DALTypes.UserStatus.NOT_AVAILABLE });
      const dispatcherUser = await createAUser({ ctx, name: 'dispatcher', email: 'dispatcher@bar.com', status: DALTypes.UserStatus.NOT_AVAILABLE });

      await createATeamMember({
        teamId: testTeam.id,
        userId: laUser.id,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LWA.name],
        },
      });
      await createATeamMember({
        teamId: testTeam.id,
        userId: dispatcherUser.id,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LD.name],
        },
      });

      let routedUserId;
      const targetContext = {
        id: testTeam.id,
        type: CommTargetType.TEAM,
      };

      const dispatcherCheck = async () => {
        routedUserId = await getPartyRoutingUserId(ctx, { targetContext, team: testTeam });
        expect(routedUserId).to.equal(dispatcherUser.id);
      };

      await mapSeries([1, 2, 3], async () => await dispatcherCheck());
    });

    it('the Round Robin will default to Dispatcher if we are outside office hours ', async () => {
      const testTeam = await createATeam({ name: 'a', module: 'leasing', officeHours: officeHoursAlwaysOff });
      const laUser = await createAUser({ ctx, name: 'agent', email: 'jonpm@bar.com', status: DALTypes.UserStatus.AVAILABLE });
      const dispatcherUser = await createAUser({ ctx, name: 'dispatcher', email: 'dispatcher@bar.com', status: DALTypes.UserStatus.AVAILABLE });

      await createATeamMember({
        teamId: testTeam.id,
        userId: laUser.id,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LWA.name],
        },
      });
      await createATeamMember({
        teamId: testTeam.id,
        userId: dispatcherUser.id,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LD.name],
        },
      });

      let routedUserId;
      const targetContext = {
        id: testTeam.id,
        type: CommTargetType.TEAM,
      };

      const dispatcherCheck = async () => {
        routedUserId = await getPartyRoutingUserId(ctx, { targetContext, team: testTeam });
        expect(routedUserId).to.equal(dispatcherUser.id);
      };

      await mapSeries([1, 2, 3], async () => await dispatcherCheck());
    });

    it('the Round Robin will use only available LWA users and it will ignore the rest', async () => {
      let testTeam = await createATeam({ name: 'a', module: 'leasing' });
      const laUser = await createAUser({ ctx, name: 'agent', email: 'jonla@bar.com', status: DALTypes.UserStatus.AVAILABLE });
      const lmUser = await createAUser({ ctx, name: 'manager', email: 'jonlm@bar.com', status: DALTypes.UserStatus.AVAILABLE });
      const dispatcherUser = await createAUser({ ctx, name: 'dispatcher', email: 'dispatcher@bar.com', status: DALTypes.UserStatus.NOT_AVAILABLE });

      // LM available
      await createATeamMember({
        teamId: testTeam.id,
        userId: lmUser.id,
        roles: {
          mainRoles: [MainRoleDefinition.LM.name],
        },
      });
      // Available and LA (the only one to be used in round robin)
      await createATeamMember({
        teamId: testTeam.id,
        userId: laUser.id,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LWA.name],
        },
      });
      // LA unavailable
      await createATeamMember({
        teamId: testTeam.id,
        userId: dispatcherUser.id,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LD.name],
        },
      });

      let routedUserId;
      const targetContext = {
        id: testTeam.id,
        type: CommTargetType.TEAM,
      };

      const assignCheck = async () => {
        testTeam = await getTeamBy(ctx, { id: testTeam.id });
        routedUserId = await getPartyRoutingUserId(ctx, { targetContext, team: testTeam });
        expect(routedUserId).to.equal(laUser.id);
      };

      await mapSeries([1, 2, 3], async () => await assignCheck());
    });

    it('the Round Robin will not ignore the users that are marked as busy', async () => {
      let testTeam = await createATeam({ name: 'a', module: 'leasing' });
      const laUser1 = await createAUser({ ctx, name: 'user1', email: 'user1@bar.com', status: DALTypes.UserStatus.AVAILABLE });
      const laUser2 = await createAUser({ ctx, name: 'user2', email: 'user2@bar.com', status: DALTypes.UserStatus.NOT_AVAILABLE });
      const laUser3 = await createAUser({ ctx, name: 'user3', email: 'user3@bar.com', status: DALTypes.UserStatus.BUSY });

      await createATeamMember({
        teamId: testTeam.id,
        userId: laUser1.id,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LWA.name],
        },
      });

      await createATeamMember({
        teamId: testTeam.id,
        userId: laUser2.id,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LWA.name],
        },
      });

      await createATeamMember({
        teamId: testTeam.id,
        userId: laUser3.id,
        roles: {
          mainRoles: [MainRoleDefinition.LA.name],
          functionalRoles: [FunctionalRoleDefinition.LWA.name],
        },
      });

      let routedUserId;
      const targetContext = {
        id: testTeam.id,
        type: CommTargetType.TEAM,
      };

      // first round
      testTeam = await getTeamBy(ctx, { id: testTeam.id });
      routedUserId = await getPartyRoutingUserId(ctx, { targetContext, team: testTeam });
      expect(routedUserId).to.equal(laUser1.id);

      // second round
      testTeam = await getTeamBy(ctx, { id: testTeam.id });
      routedUserId = await getPartyRoutingUserId(ctx, { targetContext, team: testTeam });
      expect(routedUserId).to.equal(laUser3.id);

      // third round
      testTeam = await getTeamBy(ctx, { id: testTeam.id });
      routedUserId = await getPartyRoutingUserId(ctx, { targetContext, team: testTeam });
      expect(routedUserId).to.equal(laUser1.id);

      // fourth round
      testTeam = await getTeamBy(ctx, { id: testTeam.id });
      routedUserId = await getPartyRoutingUserId(ctx, { targetContext, team: testTeam });
      expect(routedUserId).to.equal(laUser3.id);
    });

    it('the Round Robin will ignore the LWA users that are inactive across all teams', async () => {
      const user4 = await createAUser({
        ctx,
        name: 'agent',
        email: 'user3@domain.com',
        status: DALTypes.UserStatus.AVAILABLE,
        isAdmin: false,
      });

      await createATeamMember({ teamId: team.id, userId: user4.id, inactive: true });
      let teamToTest;

      const conditions = [];
      [1, 2, 3, 4].reduce(acc => {
        const id = getUUID();
        const condition = msg => msg.Key === id;
        acc.push({ id, condition });
        return acc;
      }, conditions);

      const { resolvers, promises } = waitFor(conditions.map(x => x.condition));
      const matcher = createResolverMatcher(resolvers);
      await setupConsumers(chan(), matcher, ['mail']);

      // email 1
      setGetEmailDetailsFunction(() => ({
        ...firstEmailDetails,
        msg: {
          ...firstEmailDetails.msg,
          messageId: conditions[0].id,
        },
      }));

      await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: conditions[0].id }).expect(200);
      let res = await promises[0];
      expect(res).to.be.true;

      teamToTest = await getTeamBy(ctx, { name: 'testTeam' });
      expect(teamToTest.metadata.lastAssignedUser).to.equal(user1.id);

      // email 2
      setGetEmailDetailsFunction(() => ({
        ...secondEmailDetails,
        msg: {
          ...secondEmailDetails.msg,
          messageId: conditions[1].id,
        },
      }));

      await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: conditions[1].id }).expect(200);

      res = await promises[1];
      expect(res).to.be.true;

      teamToTest = await getTeamBy(ctx, { name: 'testTeam' });
      expect(teamToTest.metadata.lastAssignedUser).to.equal(user2.id);

      // email 3
      setGetEmailDetailsFunction(() => ({
        ...thirdEmailDetails,
        msg: {
          ...thirdEmailDetails.msg,
          messageId: conditions[2].id,
        },
      }));

      await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: conditions[2].id }).expect(200);

      res = await promises[2];
      expect(res).to.be.true;
      teamToTest = await getTeamBy(ctx, { name: 'testTeam' });
      expect(teamToTest.metadata.lastAssignedUser).to.equal(user3.id);

      // email 4
      setGetEmailDetailsFunction(() => ({
        ...fourthEmailDetails,
        msg: {
          ...fourthEmailDetails.msg,
          messageId: conditions[3].id,
        },
      }));

      await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: conditions[3].id }).expect(200);

      res = await promises[3];
      expect(res).to.be.true;

      teamToTest = await getTeamBy(ctx, { name: 'testTeam' });
      expect(teamToTest.metadata.lastAssignedUser).to.equal(user1.id);
    });

    it('the Round Robin will ignore the LWA users that are inactive at the team level', async () => {
      const user4 = await createAUser({
        ctx,
        name: 'agent',
        email: 'user4@domain.com',
        status: DALTypes.UserStatus.AVAILABLE,
        isAdmin: false,
      });

      await createATeamMember({
        teamId: team.id,
        userId: user4.id,
        roles: { mainRoles: [MainRoleDefinition.LA.name], functionalRoles: [FunctionalRoleDefinition.LWA.name] },
        inactive: true,
      });
      let teamToTest;

      const conditions = [];
      [1, 2, 3, 4].reduce(acc => {
        const id = getUUID();
        const condition = msg => msg.Key === id;
        acc.push({ id, condition });
        return acc;
      }, conditions);

      const { resolvers, promises } = waitFor(conditions.map(x => x.condition));
      const matcher = createResolverMatcher(resolvers);
      await setupConsumers(chan(), matcher, ['mail']);

      // email 1
      setGetEmailDetailsFunction(() => ({
        ...firstEmailDetails,
        msg: {
          ...firstEmailDetails.msg,
          messageId: conditions[0].id,
        },
      }));

      await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: conditions[0].id }).expect(200);
      let res = await promises[0];
      expect(res).to.be.true;

      teamToTest = await getTeamBy(ctx, { name: 'testTeam' });
      expect(teamToTest.metadata.lastAssignedUser).to.equal(user1.id);

      // email 2
      setGetEmailDetailsFunction(() => ({
        ...secondEmailDetails,
        msg: {
          ...secondEmailDetails.msg,
          messageId: conditions[1].id,
        },
      }));

      await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: conditions[1].id }).expect(200);

      res = await promises[1];
      expect(res).to.be.true;

      teamToTest = await getTeamBy(ctx, { name: 'testTeam' });
      expect(teamToTest.metadata.lastAssignedUser).to.equal(user2.id);

      // email 3
      setGetEmailDetailsFunction(() => ({
        ...thirdEmailDetails,
        msg: {
          ...thirdEmailDetails.msg,
          messageId: conditions[2].id,
        },
      }));

      await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: conditions[2].id }).expect(200);

      res = await promises[2];
      expect(res).to.be.true;
      teamToTest = await getTeamBy(ctx, { name: 'testTeam' });
      expect(teamToTest.metadata.lastAssignedUser).to.equal(user3.id);

      // email 4
      setGetEmailDetailsFunction(() => ({
        ...fourthEmailDetails,
        msg: {
          ...fourthEmailDetails.msg,
          messageId: conditions[3].id,
        },
      }));

      await request(app).post(postEmailUrl).send({ Bucket: 'test', Key: conditions[3].id }).expect(200);

      res = await promises[3];
      expect(res).to.be.true;

      teamToTest = await getTeamBy(ctx, { name: 'testTeam' });
      expect(teamToTest.metadata.lastAssignedUser).to.equal(user1.id);
    });
  });
});
