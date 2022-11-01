/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { createAUser, createATeam, createATeamMember, createATeamPropertyProgram, createAProperty } from '../../testUtils/repoHelper';
import { getCommunicationContext } from '../routing/communicationContextProcessor.js';
import { CommTargetType } from '../routing/targetUtils';
import { DALTypes } from '../../../common/enums/DALTypes';

describe('communication target processor ', () => {
  const ctx = { tenantId: tenant.id };
  let leasingTeam1;
  let leasingTeam2;
  let residentTeam1;
  let user1;
  let user2;
  let teamMember1;
  let teamMember2;
  let teamPropertyProgram;
  let teamPropertyProgram3;
  const programEmailIdentifier = 'program-identifier';
  const programEmailIdentifier2 = 'program-identifier-2';
  const programEmailIdentifier3 = 'program-identifier-3';
  const programPhoneIdentifier = '12025550190';
  const programPhoneIdentifier2 = '12025550191';
  const programPhoneIdentifier3 = '12025550192';

  beforeEach(async () => {
    leasingTeam1 = await createATeam({ name: 'leasingTeam1', module: 'leasing' });
    leasingTeam2 = await createATeam({ name: 'leasingTeam2', module: 'leasing' });
    residentTeam1 = await createATeam({ name: 'residentTeam1', module: 'residentServices' });

    const { id: propertyId } = await createAProperty();
    teamPropertyProgram = await createATeamPropertyProgram({
      teamId: leasingTeam1.id,
      propertyId,
      directEmailIdentifier: programEmailIdentifier,
      directPhoneIdentifier: programPhoneIdentifier,
      commDirection: DALTypes.CommunicationDirection.IN,
    });

    const { id: propertyId2 } = await createAProperty();
    await createATeamPropertyProgram({
      teamId: leasingTeam2.id,
      propertyId: propertyId2,
      directEmailIdentifier: programEmailIdentifier2,
      directPhoneIdentifier: programPhoneIdentifier2,
      commDirection: DALTypes.CommunicationDirection.IN,
    });

    const { id: propertyId3 } = await createAProperty();
    teamPropertyProgram3 = await createATeamPropertyProgram({
      teamId: residentTeam1.id,
      propertyId: propertyId3,
      directEmailIdentifier: programEmailIdentifier3,
      directPhoneIdentifier: programPhoneIdentifier3,
      commDirection: DALTypes.CommunicationDirection.IN,
    });

    user1 = await createAUser({ ctx, name: 'User1', email: 'user1+test@domain.com', status: DALTypes.UserStatus.AVAILABLE });
    user2 = await createAUser({ ctx, name: 'U2er2', email: 'user2+test@domain.com', status: DALTypes.UserStatus.AVAILABLE });

    teamMember1 = await createATeamMember({
      teamId: leasingTeam1.id,
      userId: user1.id,
      outsideDedicatedEmails: ['member1_outsideEmail@gmail.com'],
      directPhoneIdentifier: '12025550180',
    });
    teamMember2 = await createATeamMember({ teamId: leasingTeam2.id, userId: user2.id, directPhoneIdentifier: '12025550181' });
  });
  describe('channel is email', () => {
    describe('when we have no valid targets', () => {
      it('should throw an error', async () => {
        const commData = {
          messageData: {
            to: ['badTarget@asd.com'],
            cc: [],
          },
        };
        let wasExceptionThrown = false;
        try {
          await getCommunicationContext(ctx, commData);
        } catch (ex) {
          wasExceptionThrown = true;
        }
        expect(wasExceptionThrown).to.be.true;
      });
    });
    describe('when we have one and only one program target', () => {
      it('should set the target to the program', async () => {
        const commData = {
          messageData: {
            to: [`${programEmailIdentifier}@tenant.reva.tech`],
            cc: [],
            from: 'ads@asd.com',
            text: '',
          },
          channel: DALTypes.CommunicationMessageType.EMAIL,
        };
        const commContext = await getCommunicationContext(ctx, commData);
        expect(commContext.targetContext.type).to.equal(CommTargetType.PROGRAM);
        expect(commContext.targetContext.id).to.equal(teamPropertyProgram.programId);
      });
    });
    describe('when we have one and only one TEAM MEMBER target', () => {
      it('should set the target to the user', async () => {
        const commData = {
          messageData: {
            to: [`${teamMember1.directEmailIdentifier}@tenant.reva.tech`],
            cc: [],
            from: 'asd@asd.com',
            text: '',
          },
          channel: DALTypes.CommunicationMessageType.EMAIL,
        };
        const commContext = await getCommunicationContext(ctx, commData);
        expect(commContext.targetContext.type).to.equal(CommTargetType.TEAM_MEMBER);
        expect(commContext.targetContext.id).to.equal(teamMember1.id);
      });
    });

    describe('when we have multiple program targets but only one in the TO', () => {
      it('should set the target to the correct program', async () => {
        const commData = {
          messageData: {
            to: [`${programEmailIdentifier3}@tenant.reva.tech`],
            cc: [`${programEmailIdentifier}@tenant.reva.tech`, `${programEmailIdentifier2}@tenant.reva.tech`],
            from: 'asd@asdd.com',
            text: '',
          },
          channel: DALTypes.CommunicationMessageType.EMAIL,
        };
        const commContext = await getCommunicationContext(ctx, commData);
        expect(commContext.targetContext.type).to.equal(CommTargetType.PROGRAM);
        expect(commContext.targetContext.id).to.equal(teamPropertyProgram3.programId);
      });
    });

    describe('when we have multiple program targets in TO and CC', () => {
      it('should set the target to first program address', async () => {
        const commData = {
          messageData: {
            to: [`${programEmailIdentifier3}@tenant.reva.tech`, `${programEmailIdentifier2}@tenant.reva.tech`],
            cc: [`${programEmailIdentifier}@tenant.reva.tech`, `${programEmailIdentifier2}@tenant.reva.tech`],
            from: 'asd@asd.com',
            text: '',
          },
          channel: DALTypes.CommunicationMessageType.EMAIL,
        };
        const commContext = await getCommunicationContext(ctx, commData);
        expect(commContext.targetContext.type).to.equal(CommTargetType.PROGRAM);
        expect(commContext.targetContext.id).to.equal(teamPropertyProgram3.programId);
      });
    });

    describe('when we have one and only one TEAM MEMBER target in TO and a single program target in CC', () => {
      it('should set the target to the team member', async () => {
        const commData = {
          messageData: {
            to: [`${teamMember1.directEmailIdentifier}@tenant.reva.tech`],
            cc: [`${programEmailIdentifier}@tenant.reva.tech`],
            from: 'asd@asd.com',
            text: '',
          },
          channel: DALTypes.CommunicationMessageType.EMAIL,
        };
        const commContext = await getCommunicationContext(ctx, commData);
        expect(commContext.targetContext.type).to.equal(CommTargetType.TEAM_MEMBER);
        expect(commContext.targetContext.id).to.equal(teamMember1.id);
      });
    });

    describe('when we have multiple program targets in CC but none in TO', () => {
      it('should set the target to the first program', async () => {
        const commData = {
          messageData: {
            to: [`${teamMember1.directEmailIdentifier}@tenant.reva.tech`],
            cc: [`${programEmailIdentifier}@tenant.reva.tech`, `${programEmailIdentifier2}@tenant.reva.tech`],
            from: 'asd@asd.com',
            text: '',
          },
          channel: DALTypes.CommunicationMessageType.EMAIL,
        };
        const commContext = await getCommunicationContext(ctx, commData);
        expect(commContext.targetContext.type).to.equal(CommTargetType.PROGRAM);
        expect(commContext.targetContext.id).to.equal(teamPropertyProgram.programId);
      });
    });

    describe('when we have multiple NON-program targets but we have multiple team member targets', () => {
      it('should set the target to the first team member', async () => {
        const commData = {
          messageData: {
            to: [`${teamMember1.directEmailIdentifier}@tenant.reva.tech`, `${teamMember2.directEmailIdentifier}@tenant.reva.tech`],
            cc: [`${teamMember2.directEmailIdentifier}@tenant.reva.tech`],
            from: 'asd@asd.com',
            text: '',
          },
          channel: DALTypes.CommunicationMessageType.EMAIL,
        };
        const commContext = await getCommunicationContext(ctx, commData);
        expect(commContext.targetContext.type).to.equal(CommTargetType.TEAM_MEMBER);
        expect(commContext.targetContext.id).to.equal(teamMember1.id);
      });
    });

    describe('forwarding rule for program', () => {
      const forwardedOriginaSource = 'originalSource@gmail.com';

      const getTestData = async () => {
        const outsideEmail = 'outside@gmail.com';
        const programEmailId = 'program-identifier-id';

        const { id: propertyId } = await createAProperty();
        const { programId } = await createATeamPropertyProgram({
          teamId: leasingTeam1.id,
          propertyId,
          directEmailIdentifier: programEmailId,
          outsideDedicatedEmails: [outsideEmail],
          commDirection: DALTypes.CommunicationDirection.IN,
        });

        return {
          outsideEmail,
          programDirectIdentifier: programEmailId,
          programId,
        };
      };

      describe('manually forwarded from an outside dedicated email address', () => {
        it('it should set the correct target and from address', async () => {
          const { outsideEmail, programDirectIdentifier, programId } = await getTestData();

          const forwardedMessageText = `
  ---------- Forwarded message ----------\nFrom: Darius Baba <${forwardedOriginaSource}>\nDate: Fri, Sep 2, 2016 at 3:24 PM\nSubject: test\nTo: Darius Baba <darius@craftingsoftware.com>\n\n\ntest\n
  `;
          const commData = {
            messageData: {
              to: [`${programDirectIdentifier}@tenant.reva.tech`],
              cc: [],
              from: outsideEmail,
              text: forwardedMessageText,
            },
            channel: DALTypes.CommunicationMessageType.EMAIL,
          };
          const commContext = await getCommunicationContext(ctx, commData);
          expect(commContext.targetContext.type).to.equal(CommTargetType.PROGRAM);
          expect(commContext.targetContext.id).to.equal(programId);
          expect(commContext.senderContext.from).to.equal(forwardedOriginaSource);
        });
      });
      describe('automatically forwarded from an outside dedicated email address, email has headers', () => {
        it('it should set the correct target and from address', async () => {
          const { outsideEmail, programDirectIdentifier, programId } = await getTestData();

          const headers = {
            'x-forwarded-to': programDirectIdentifier,
          };
          const commData = {
            messageData: {
              to: [outsideEmail],
              cc: [],
              headers,
              from: forwardedOriginaSource,
            },
            channel: DALTypes.CommunicationMessageType.EMAIL,
          };
          const commContext = await getCommunicationContext(ctx, commData);
          expect(commContext.targetContext.type).to.equal(CommTargetType.PROGRAM);
          expect(commContext.targetContext.id).to.equal(programId);
          expect(commContext.senderContext.from).to.equal(forwardedOriginaSource);
        });
      });
      describe('automatically forwarded from an outside dedicated email address, email has no headers', () => {
        it('it should set the correct target and from address', async () => {
          const { outsideEmail, programId } = await getTestData();

          const commData = {
            messageData: {
              to: [outsideEmail],
              cc: [],
              from: forwardedOriginaSource,
            },
            channel: DALTypes.CommunicationMessageType.EMAIL,
          };
          const commContext = await getCommunicationContext(ctx, commData);
          expect(commContext.targetContext.type).to.equal(CommTargetType.PROGRAM);
          expect(commContext.targetContext.id).to.equal(programId);
          expect(commContext.senderContext.from).to.equal(forwardedOriginaSource);
        });
      });
    });

    describe('forwarding rule for team member', () => {
      describe('manually forwarded from an outside dedicated email address', () => {
        it('it should set the correct target and from address', async () => {
          const forwardedOriginaSource = 'originalSource@gmail.com';
          const forwardedMessageText = `
      ---------- Forwarded message ----------\nFrom: Darius Baba <${forwardedOriginaSource}>\nDate: Fri, Sep 2, 2016 at 3:24 PM\nSubject: test\nTo: Darius Baba <darius@craftingsoftware.com>\n\n\ntest\n
      `;
          const commData = {
            messageData: {
              to: [`${teamMember1.directEmailIdentifier}@tenant.reva.tech`],
              cc: [],
              from: teamMember1.outsideDedicatedEmails[0],
              text: forwardedMessageText,
            },
            channel: DALTypes.CommunicationMessageType.EMAIL,
          };
          const commContext = await getCommunicationContext(ctx, commData);
          expect(commContext.targetContext.type).to.equal(CommTargetType.TEAM_MEMBER);
          expect(commContext.targetContext.id).to.equal(teamMember1.id);
          expect(commContext.senderContext.from).to.equal(forwardedOriginaSource);
        });
      });
      describe('automatically forwarded from an outside dedicated email address, email has headers', () => {
        it('it should set the correct target and from address', async () => {
          const sourceAddress = 'originalSource@gmail.com';
          const headers = {
            'x-forwarded-to': `${teamMember1.directEmailIdentifier}@tenant.reva.tech`,
          };
          const commData = {
            messageData: {
              to: [teamMember1.outsideDedicatedEmails[0]],
              cc: [],
              headers,
              from: sourceAddress,
            },
            channel: DALTypes.CommunicationMessageType.EMAIL,
          };
          const commContext = await getCommunicationContext(ctx, commData);
          expect(commContext.targetContext.type).to.equal(CommTargetType.TEAM_MEMBER);
          expect(commContext.targetContext.id).to.equal(teamMember1.id);
          expect(commContext.senderContext.from).to.equal(sourceAddress);
        });
      });
      describe('automatically forwarded from an outside dedicated email address, email has no headers', () => {
        it('it should set the correct traget and from address', async () => {
          const sourceAddress = 'originalSource@gmail.com';
          const commData = {
            messageData: {
              to: [teamMember1.outsideDedicatedEmails[0]],
              cc: [],
              from: sourceAddress,
            },
            channel: DALTypes.CommunicationMessageType.EMAIL,
          };
          const commContext = await getCommunicationContext(ctx, commData);
          expect(commContext.targetContext.type).to.equal(CommTargetType.TEAM_MEMBER);
          expect(commContext.targetContext.id).to.equal(teamMember1.id);
          expect(commContext.senderContext.from).to.equal(sourceAddress);
        });
      });
    });
  });

  describe('channel is phone', () => {
    describe('when we have no valid targets', () => {
      it('should throw an error', async () => {
        const commData = {
          messageData: {
            to: ['16504375709'],
            cc: [],
            text: '',
            from: '123',
          },
          channel: DALTypes.CommunicationMessageType.SMS,
        };
        let wasExceptionThrown = false;
        try {
          await getCommunicationContext(ctx, commData);
        } catch (ex) {
          wasExceptionThrown = true;
        }
        expect(wasExceptionThrown).to.be.true;
      });
    });
    describe('when we have one and only one program target', () => {
      it('should set the target to the program', async () => {
        const commData = {
          messageData: {
            to: [programPhoneIdentifier],
            cc: [],
            text: '',
            from: '123',
          },
          channel: DALTypes.CommunicationMessageType.SMS,
        };
        const commContext = await getCommunicationContext(ctx, commData);
        expect(commContext.targetContext.type).to.equal(CommTargetType.PROGRAM);
        expect(commContext.targetContext.id).to.equal(teamPropertyProgram.programId);
      });
    });
    describe('when we have one and only one INDIVIDUAL target', () => {
      it('should set the target to the correct team member', async () => {
        const commData = {
          messageData: {
            to: [teamMember1.directPhoneIdentifier],
            cc: [],
            text: '',
            from: '123',
          },
          channel: DALTypes.CommunicationMessageType.SMS,
        };
        const commContext = await getCommunicationContext(ctx, commData);
        expect(commContext.targetContext.type).to.equal(CommTargetType.TEAM_MEMBER);
        expect(commContext.targetContext.id).to.equal(teamMember1.id);
      });
    });
    describe('when we have multiple program targets but only one in the TO', () => {
      it('should set the target to the correct program', async () => {
        const commData = {
          messageData: {
            to: [programPhoneIdentifier3],
            cc: [programPhoneIdentifier, programPhoneIdentifier2],
            text: '',
            from: '123',
          },
          channel: DALTypes.CommunicationMessageType.SMS,
        };
        const commContext = await getCommunicationContext(ctx, commData);
        expect(commContext.targetContext.type).to.equal(CommTargetType.PROGRAM);
        expect(commContext.targetContext.id).to.equal(teamPropertyProgram3.programId);
      });
    });
    describe('when we have multiple program targets in TO and CC', () => {
      it('should set the target to first program', async () => {
        const commData = {
          messageData: {
            to: [programPhoneIdentifier3, programPhoneIdentifier2],
            cc: [programPhoneIdentifier, programPhoneIdentifier2],
            text: '',
            from: '123',
          },
          channel: DALTypes.CommunicationMessageType.SMS,
        };
        const commContext = await getCommunicationContext(ctx, commData);
        expect(commContext.targetContext.type).to.equal(CommTargetType.PROGRAM);
        expect(commContext.targetContext.id).to.equal(teamPropertyProgram3.programId);
      });
    });
    describe('when we have multiple program targets in CC but none in TO', () => {
      it('should set the target to the first program', async () => {
        const commData = {
          messageData: {
            to: [teamMember1.directPhoneIdentifier],
            cc: [programPhoneIdentifier, programPhoneIdentifier2],
            text: '',
            from: '123',
          },
          channel: DALTypes.CommunicationMessageType.SMS,
        };
        const commContext = await getCommunicationContext(ctx, commData);
        expect(commContext.targetContext.type).to.equal(CommTargetType.PROGRAM);
        expect(commContext.targetContext.id).to.equal(teamPropertyProgram.programId);
      });
    });
    describe('when we have multiple NON - program targets but we have multiple Individual targets', () => {
      it('should set the target to the first team member', async () => {
        const commData = {
          messageData: {
            to: [teamMember1.directPhoneIdentifier, teamMember2.directPhoneIdentifier],
            cc: [teamMember2.directPhoneIdentifier],
            text: '',
            from: '123',
          },
          channel: DALTypes.CommunicationMessageType.SMS,
        };
        const commContext = await getCommunicationContext(ctx, commData);
        expect(commContext.targetContext.type).to.equal(CommTargetType.TEAM_MEMBER);
        expect(commContext.targetContext.id).to.equal(teamMember1.id);
      });
    });
  });
});
