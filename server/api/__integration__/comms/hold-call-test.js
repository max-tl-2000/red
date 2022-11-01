/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import request from 'supertest';
import newId from 'uuid/v4';
import app from '../../api';
import config from '../../../config';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { getTelephonyConfigs } from '../../../helpers/tenantContextConfigs';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { setTelephonyOps } from '../../../services/telephony/providerApiOperations';
import { createACommunicationEntry, createVoiceMessages, createATeam } from '../../../testUtils/repoHelper';
import { getCallDetailsByCommId } from '../../../dal/callDetailsRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';

chai.use(sinonChai);
const expect = chai.expect;

describe('API/communications/phone/:commId/holdCall', () => {
  describe('given a request to hold a call', () => {
    let ops;
    let ctx;

    beforeEach(() => {
      ops = { holdCall: sinon.spy(() => ({})) };
      ctx = { tenantId: tenant.id };
      setTelephonyOps(ops);
    });

    describe('when the call id is not a uuid', () => {
      it('responds with status code 400 and INVALID_CALL_ID token', async () => {
        const res = await request(app).post('/communications/phone/123/holdCall').set(getAuthHeader());

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('INCORRECT_CALL_ID');
      });
    });

    describe("when the call doesn't exist", () => {
      it('responds with status code 404 and CALL_NOT_FOUND token', async () => {
        const res = await request(app).post(`/communications/phone/${newId()}/holdCall`).set(getAuthHeader());

        expect(res.status).to.equal(404);
        expect(res.body.token).to.equal('CALL_NOT_FOUND');
      });
    });

    it('should call the holdCall provider function with aleg for incomming call', async () => {
      const { name: voiceMessage, holdingMusic } = await createVoiceMessages();

      const { id: teamId } = await createATeam({ voiceMessage });
      const { auth } = await getTelephonyConfigs({ tenant });

      const { id, messageId: callId } = await createACommunicationEntry({ teams: [teamId] });
      const holdingMusicUrl = `${config.telephony.audioAssetsUrl}/${holdingMusic}`;

      const { status } = await request(app).post(`/communications/phone/${id}/holdCall`).set(getAuthHeader());

      expect(status).to.equal(200);

      expect(ops.holdCall).to.have.been.calledOnce;
      expect(ops.holdCall).to.have.been.calledWith(auth, { callId, legs: 'aleg', mix: false, holdingMusicUrl, loop: true });
    });

    it('should call the holdCall provider function with bleg for outgoing call', async () => {
      const { name: voiceMessage, holdingMusic } = await createVoiceMessages();

      const { id: teamId } = await createATeam({ voiceMessage });
      const { auth } = await getTelephonyConfigs({ tenant });

      const { id, messageId: callId } = await createACommunicationEntry({ teams: [teamId], direction: DALTypes.CommunicationDirection.OUT });
      const holdingMusicUrl = `${config.telephony.audioAssetsUrl}/${holdingMusic}`;

      const { status } = await request(app).post(`/communications/phone/${id}/holdCall`).set(getAuthHeader());

      expect(status).to.equal(200);

      expect(ops.holdCall).to.have.been.calledOnce;
      expect(ops.holdCall).to.have.been.calledWith(auth, { callId, legs: 'bleg', mix: false, holdingMusicUrl, loop: true });
    });

    it('should add on hold info to communication entry', async () => {
      const { name: voiceMessage } = await createVoiceMessages();

      const { id: teamId } = await createATeam({ voiceMessage });
      const { id } = await createACommunicationEntry({ teams: [teamId] });

      const { status, body } = await request(app).post(`/communications/phone/${id}/holdCall`).set(getAuthHeader());
      expect(status).to.equal(200);
      expect(body.details).to.be.ok;
      expect(body.details.holdStartTime).to.be.ok;

      const callDetails = await getCallDetailsByCommId(ctx, id);

      expect(callDetails).to.be.ok;
      expect(callDetails.details).to.be.ok;
      expect(callDetails.details.holdStartTime).to.be.ok;
    });
  });
});
