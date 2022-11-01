/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  testCtx as ctx,
  createATeam,
  createACommunicationEntry,
  createAUser,
  createATeamMember,
  createAParty,
  createATeamPropertyProgram,
  createAProperty,
  createATeamProperty,
  ivrKeys,
  ivrExternalNumber,
  createVoiceMessages,
} from '../../../testUtils/repoHelper';
import { postDigitsPressed } from '../../../testUtils/telephonyHelper';
import { getTelephonyConfigs } from '../../../helpers/tenantContextConfigs';
import { addCallToQueue, addCallQueueStats } from '../../../dal/callQueueRepo';
import { loadMessageById } from '../../../dal/communicationRepo';
import { addParamsToUrl } from '../../../../common/helpers/urlParams';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { setTelephonyOps } from '../../../services/telephony/providerApiOperations';
import { TransferTargetType } from '../../../services/telephony/enums';
import { getVoiceMessage, getHoldingMusic } from '../../../services/telephony/voiceMessages';
import { now } from '../../../../common/helpers/moment-utils';
import { setupQueueToWaitFor } from '../../../testUtils/apiHelper';

chai.use(sinonChai);
const expect = chai.expect;

const getVoiceMessageType = isCallQueueEnabled => (isCallQueueEnabled ? DALTypes.VoiceMessageType.CALL_QUEUE_WELCOME : DALTypes.VoiceMessageType.UNAVAILABLE);
const isEnabledText = isCallQueueEnabled => (isCallQueueEnabled ? 'is enabled' : 'is not enabled');

const setupMessageQueue = async (isCallQueueEnabled, commId) =>
  isCallQueueEnabled ? await setupQueueToWaitFor([msg => msg.commId === commId], ['calls']) : { task: Promise.resolve() };

const getExpectedVoicemailUrl = async (commId, teamId, target) => {
  const { transferToVoicemailUrl } = await getTelephonyConfigs(ctx);

  return addParamsToUrl(transferToVoicemailUrl, { commId, ...target, teamId, messageType: DALTypes.VoiceMessageType.VOICEMAIL });
};

const setupQueuedCall = async (isCallQueueEnabled, commId, teamId) => {
  if (!isCallQueueEnabled) return;
  await addCallToQueue(ctx, { commId, teamId });
  await addCallQueueStats(ctx, { communicationId: commId, entryTime: now() });
};

const expectHoldingMusic = async (isCallQueueEnabled, text, target) => {
  if (!isCallQueueEnabled) return;

  expect(text).to.contain('<Play');

  const playOccurences = text.match(/<Play/g) || [];
  expect(playOccurences).to.have.lengthOf(11);

  const loopOccurences = text.match(/loop="0"/g) || [];
  expect(loopOccurences).to.have.lengthOf(1);

  const holdingMusic = await getHoldingMusic(ctx, target);
  expect(text).to.contain(holdingMusic);
};

describe('/webhooks/digitsPressed', () => {
  [
    { isCallQueueEnabled: true, targetName: 'program' },
    { isCallQueueEnabled: false, targetName: 'program' },
    { isCallQueueEnabled: false, targetName: 'team member' },
    { isCallQueueEnabled: true, targetName: 'team' },
    { isCallQueueEnabled: false, targetName: 'team' },
  ].forEach(({ isCallQueueEnabled, targetName }) => {
    const voiceMessageType = getVoiceMessageType(isCallQueueEnabled);

    describe(`
        given a request for pressed digit during a call,
        when call queue ${isEnabledText(isCallQueueEnabled)}
        and call target is a ${targetName}
        `, () => {
      const setup = async () => {
        const { id: voiceMessageId, name: voiceMessage } = await createVoiceMessages(ctx, { withIvrMessages: true });

        const { id: teamId } = await createATeam({ voiceMessage });

        const { id: propertyId } = await createAProperty();
        await createATeamProperty(teamId, propertyId);

        const { programId } = await createATeamPropertyProgram({
          teamId,
          propertyId,
          directPhoneIdentifier: '12025550190',
          commDirection: DALTypes.CommunicationDirection.IN,
          voiceMessageId,
        });

        const user = await createAUser();
        const { id: teamMemberId } = await createATeamMember({
          teamId,
          userId: user.id,
          voiceMessageId,
        });
        const party = await createAParty();
        const { id: commId, messageId: callId } = await createACommunicationEntry({
          teams: [teamId],
          parties: [party.id],
        });

        await setupQueuedCall(isCallQueueEnabled, commId, teamId);
        const { task: messageQueueTask } = await setupMessageQueue(isCallQueueEnabled, commId);

        const getTarget = () => {
          switch (targetName) {
            case 'program':
              return { programId };
            case 'team member':
              return { teamMemberId };
            default:
              return { teamId };
          }
        };

        const target = getTarget();

        return { teamId, commId, callId, party, user, target, messageQueueTask };
      };

      describe('when the pressed digit is the digit configured for requesting callback', () => {
        it('should respond with 200 and ack message', async () => {
          const { teamId, commId, target, messageQueueTask } = await setup();

          const res = await postDigitsPressed().send({ Digits: ivrKeys.callback }).send({ commId }).send({ teamId }).send(target).send({ voiceMessageType });

          await messageQueueTask;

          expect(res.status).to.equal(200);
          expect(res.text).to.contain('<Speak');
          const { message: callBackMessage } = await getVoiceMessage(ctx, {
            ...target,
            messageType: DALTypes.VoiceMessageType.CALL_BACK_REQUEST_ACK,
          });
          expect(res.text).to.contain(callBackMessage);
        });
      });

      describe('when the pressed digit is the digit configured for requesting transfer to voicemail', () => {
        it('should respond with 200 and transfer to voicemail', async () => {
          const transferCall = sinon.spy();
          setTelephonyOps({ transferCall });

          const { teamId, commId, callId, target, messageQueueTask } = await setup();

          const res = await postDigitsPressed().send({ Digits: ivrKeys.voicemail }).send({ commId }).send({ teamId }).send(target).send({ voiceMessageType });

          await messageQueueTask;

          expect(res.status).to.equal(200);

          const { auth } = await getTelephonyConfigs(ctx);

          const url = await getExpectedVoicemailUrl(commId, teamId, target);

          expect(transferCall).to.have.been.calledOnce;
          expect(transferCall).to.have.been.calledWith(auth, { callId, alegUrl: url });
        });
      });

      describe('when the pressed digit is the digit configured for requesting transfer to external number', () => {
        it('should respond with 200 and transfer to number', async () => {
          const transferCall = sinon.spy();
          setTelephonyOps({ transferCall });

          const { teamId, commId, callId, target, messageQueueTask } = await setup();

          const res = await postDigitsPressed()
            .send({ Digits: ivrKeys.transferToNumber })
            .send({ commId })
            .send({ teamId })
            .send(target)
            .send({ voiceMessageType });

          await messageQueueTask;

          expect(res.status).to.equal(200);

          const conf = await getTelephonyConfigs(ctx);
          const url = addParamsToUrl(conf.answerUrl, {
            transferTargetType: TransferTargetType.EXTERNAL_PHONE,
            transferTarget: ivrExternalNumber,
            transferredCallDirection: DALTypes.CommunicationDirection.IN,
            commId,
          });

          expect(transferCall).to.have.been.calledOnce;
          expect(transferCall).to.have.been.calledWith(conf.auth, { callId, alegUrl: url });

          const { unread } = await loadMessageById(ctx, commId);
          expect(unread).to.equal(true);
        });
      });

      describe('when the pressed digit is not any of the configured digits', () => {
        it('should respond with 200 and GetDigits, Speak and Play instructions again', async () => {
          const { teamId, commId, target } = await setup();

          const res = await postDigitsPressed().send({ Digits: '2' }).send({ commId }).send({ teamId }).send(target).send({ voiceMessageType });

          expect(res.status).to.equal(200);

          expect(res.text).to.contain('<GetDigits');

          const { digitsPressedUrl } = await getTelephonyConfigs(ctx);

          expect(res.text.replace(/amp;/g, '')).to.contain(`action="${digitsPressedUrl}`);
          expect(res.text).to.contain('numDigits="1"');

          expect(res.text).to.contain('<Speak');
          const speakOccurences = res.text.match(/<Speak/g) || [];
          expect(speakOccurences).to.have.lengthOf(10);

          const { message } = await getVoiceMessage(ctx, { ...target, messageType: voiceMessageType });
          expect(res.text).to.contain(message);

          await expectHoldingMusic(isCallQueueEnabled, res.text, target);
        });
      });
    });
  });
});
