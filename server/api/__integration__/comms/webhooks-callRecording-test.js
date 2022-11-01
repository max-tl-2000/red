/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getTelephonyConfigs } from '../../../helpers/tenantContextConfigs';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { getAllComms } from '../../../dal/communicationRepo';
import { testCtx as ctx, createACommunicationEntry } from '../../../testUtils/repoHelper';
import { postCallRecording } from '../../../testUtils/telephonyHelper';
import { setTelephonyOps } from '../../../services/telephony/providerApiOperations';

chai.use(sinonChai);
const expect = chai.expect;

describe('given a request to callRecording', () => {
  it('shoud save recording details', async () => {
    const { id: commId } = await createACommunicationEntry();

    const res = await postCallRecording({ commId });

    expect(res.status).to.equal(200);
    const [commEntry] = await getAllComms(ctx);
    const { recordingUrl, recordingId, recordingDuration } = commEntry.message;

    expect(recordingUrl).to.equal('the-recording-url');
    expect(recordingId).to.equal('the-recording-id');
    expect(recordingDuration).to.equal('30');
  });

  describe('when voicemail is received from contact marked as spam', () => {
    it('shoud respond with 200', async () => {
      const { status } = await postCallRecording({ isSpam: true });
      expect(status).to.equal(200);
    });
  });

  describe('when recording duration is 0 seconds', () => {
    it('shoud not save recording details', async () => {
      const { id: commId } = await createACommunicationEntry();

      const res = await postCallRecording({ commId, RecordingDuration: '0' });

      expect(res.status).to.equal(200);
      const [commEntry] = await getAllComms(ctx);
      const { recordingUrl, recordingId, recordingDuration } = commEntry.message;

      expect(recordingUrl).to.not.be.ok;
      expect(recordingId).to.not.be.ok;
      expect(recordingDuration).to.not.be.ok;
    });
  });

  describe('when recording was stopped and removed', () => {
    it('shoud call provider deleteRecording', async () => {
      const deleteRecording = sinon.spy();
      setTelephonyOps({ deleteRecording });
      const { auth } = await getTelephonyConfigs({ tenant });

      const { id: commId } = await createACommunicationEntry({
        message: { recordingWasRemoved: true },
      });

      const { status } = await postCallRecording({ commId });

      expect(status).to.equal(200);

      expect(deleteRecording).to.have.been.calledOnce;
      expect(deleteRecording).to.have.been.calledWith(auth, { id: 'the-recording-id' });
    });
  });
});
