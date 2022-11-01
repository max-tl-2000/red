/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import app from '../../../../server/api/api';
import { read } from '../../../../common/helpers/xfs';
import config from '../../../../server/config';
import '../../../../server/testUtils/setupTestGlobalContext';
// to test manually:
// curl --insecure -v -H 'Content-type: text/xml' -o $OUTPUT_FILE -d @sampleResponse.xml "https://rp.reva.tech/api/webhooks/screeningResponse?tenant=application&env=${CLOUD_ENV}&api-token=XXX"

const SCENARIO_FILE = 'rentapp/server/screening/fadv/__integration__/fixtures/scenario-ann-bob-no-background-report.xml';

describe('/webhooks/screeningResponse', () => {
  describe('POST', () => {
    describe('Given a valid request', () => {
      it('will return 200', async () => {
        const xmlString = await read(SCENARIO_FILE, { encoding: 'utf8' });

        // env is only used by reverse proxy, but since it is parameters are propagated, they are
        // included here to make sure it doesn't break anything
        await request(app)
          .post(`/webhooks/screeningResponse?tenant=application&env=IGNORE&api-token=${config.fadvCommon.apiToken}`)
          .set('Content-Type', 'text/xml')
          .send(xmlString)
          .expect(200);
      });
    });
  });

  // TODO: confirm message posted to queue?
  // TODO: negative tests, esp other tenants, and check if Content-type: text/xml necessary?
});
