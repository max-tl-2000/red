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
import { now } from '../../../../common/helpers/moment-utils';
import { createACommunicationEntry } from '../../../testUtils/repoHelper';
import { getCallDetailsByCommId, saveCallDetails } from '../../../dal/callDetailsRepo';

chai.use(sinonChai);
const expect = chai.expect;

describe('API/communications/phone/:commId/unholdCall', () => {
  describe('given a request to unholdCall a call', () => {
    let ops;
    let ctx;

    beforeEach(() => {
      ops = { unholdCall: sinon.spy(() => ({})) };
      ctx = { tenantId: tenant.id };
      setTelephonyOps(ops);
    });

    describe('when the call id is not a uuid', () => {
      it('responds with status code 400 and INVALID_CALL_ID token', async () => {
        const res = await request(app).post('/communications/phone/123/unholdCall').set(getAuthHeader());

        expect(res.status).to.equal(400);
        expect(res.body.token).to.equal('INCORRECT_CALL_ID');
      });
    });

    describe("when the call doesn't exist", () => {
      it('responds with status code 404 and CALL_NOT_FOUND token', async () => {
        const res = await request(app).post(`/communications/phone/${newId()}/unholdCall`).set(getAuthHeader());

        expect(res.status).to.equal(404);
        expect(res.body.token).to.equal('CALL_NOT_FOUND');
      });
    });

    it('should call the unholdCall provider function', async () => {
      const { auth } = await getTelephonyConfigs({ tenant });

      const { id, messageId: callId } = await createACommunicationEntry({});

      const { status } = await request(app).post(`/communications/phone/${id}/unholdCall`).set(getAuthHeader());

      expect(status).to.equal(200);

      expect(ops.unholdCall).to.have.been.calledOnce;
      expect(ops.unholdCall).to.have.been.calledWith(auth, { callId });
    });

    it('should add on unholdCall info to communication entry', async () => {
      const { id } = await createACommunicationEntry({});

      const holdStartTime = now({ timezone: 'UTC' }).add(-3, 'seconds').toISOString();
      await saveCallDetails(ctx, { commId: id, details: { holdStartTime } });

      const { status, body } = await request(app).post(`/communications/phone/${id}/unholdCall`).set(getAuthHeader());
      expect(status).to.equal(200);

      expect(body.details).to.be.ok;
      expect(body.details.holdEndTime).to.be.ok;
      expect(body.details.holdDuration).to.be.ok;

      const callDetails = await getCallDetailsByCommId(ctx, id);

      expect(callDetails).to.be.ok;
      expect(callDetails.details).to.be.ok;
      expect(callDetails.details.holdEndTime).to.be.ok;
      expect(callDetails.details.holdDuration).to.be.ok;
    });
  });
});
