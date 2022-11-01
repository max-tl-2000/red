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
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { getTelephonyConfigs } from '../../../helpers/tenantContextConfigs';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { setTelephonyOps } from '../../../services/telephony/providerApiOperations';
import { createACommunicationEntry } from '../../../testUtils/repoHelper';

chai.use(sinonChai);
const expect = chai.expect;

describe('API/communications/phone/:commId/stopRecording', () => {
  describe('given a request to stop a call recording', () => {
    let ops;
    beforeEach(() => {
      ops = { stopRecording: sinon.spy(() => ({})), deleteRecording: sinon.spy() };
      setTelephonyOps(ops);
    });

    describe('when the call id is not a uuid', () => {
      it('responds with status code 400 and INVALID_CALL_ID token', async () => {
        const res = await request(app).post('/communications/phone/123/stopRecording').set(getAuthHeader());

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('INCORRECT_CALL_ID');
      });
    });

    describe("when the call doesn't exist", () => {
      it('responds with status code 404 and CALL_NOT_FOUND token', async () => {
        const res = await request(app).post(`/communications/phone/${newId()}/stopRecording`).set(getAuthHeader());

        expect(res.status).to.equal(404);
        expect(res.body.token).to.equal('CALL_NOT_FOUND');
      });
    });

    it('should call the stopRecording provider function', async () => {
      const { auth } = await getTelephonyConfigs({ tenant });

      const { id, messageId: callId } = await createACommunicationEntry({
        message: { recordingId: 'the-recording-id' },
      });

      const { status } = await request(app).post(`/communications/phone/${id}/stopRecording`).set(getAuthHeader());

      expect(status).to.equal(200);

      expect(ops.stopRecording).to.have.been.calledOnce;
      expect(ops.stopRecording).to.have.been.calledWith(auth, { callId });
    });

    it('should remove recording info from communication entry', async () => {
      const { id } = await createACommunicationEntry({
        message: {
          recordingUrl: 'aurl',
          recordingId: 'an ID',
          recordingDuration: '10',
          isRecorded: true,
        },
      });

      const { status, body } = await request(app).post(`/communications/phone/${id}/stopRecording`).set(getAuthHeader());

      expect(status).to.equal(200);

      expect(body.message).to.deep.equal({
        recordingUrl: '',
        recordingId: '',
        recordingDuration: '',
        isRecorded: false,
        recordingWasRemoved: true,
      });
    });

    describe('when the call is not active anymore', () => {
      it('should mark the record as removed', async () => {
        ops = { stopRecording: sinon.spy(() => ({ notFound: true })) };
        setTelephonyOps(ops);

        const { id } = await createACommunicationEntry({
          message: {
            recordingUrl: 'aurl',
            recordingId: 'an ID',
            recordingDuration: '10',
            isRecorded: true,
          },
        });

        const { status, body } = await request(app).post(`/communications/phone/${id}/stopRecording`).set(getAuthHeader());

        expect(status).to.equal(200);

        expect(body.message).to.deep.equal({
          recordingUrl: '',
          recordingId: '',
          recordingDuration: '',
          isRecorded: false,
          recordingWasRemoved: true,
        });
      });
    });
  });
});
