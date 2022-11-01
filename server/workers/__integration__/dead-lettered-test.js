/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import { waitFor } from '../../testUtils/apiHelper';
import { setupConsumers, getEnvQueueName, DEAD_LETTER_QUEUE_SUFFIX, RETRY_QUEUE_SUFFIX } from '../consumer';
import { chan, createResolverMatcher } from '../../testUtils/setupTestGlobalContext';
import { sendMessage } from '../../services/pubsub';
import { APP_EXCHANGE } from '../../helpers/message-constants';
import { setGetEmailDetailsFunction } from '../communication/inboundEmailHandler';
import timedOut from '../../../common/helpers/sleep';

describe('/deadLetteredMessages', () => {
  beforeEach(() => {
    setGetEmailDetailsFunction(() => {
      throw new Error('Should go to dead letter');
    });
  });

  let conn;
  const setupQueueForMessage = async (msgId, expectedRetries = 3) => {
    conn = chan();
    const condition = (payload, processed, msg) => {
      const retryCount = msg.properties.headers.retryCount || 0;
      return payload.Key === msgId && (processed || retryCount === expectedRetries);
    };
    const { resolvers, promises } = waitFor([condition]);
    const matcher = createResolverMatcher(resolvers);
    await setupConsumers(conn, matcher, ['mail'], true, 3);

    return { task: Promise.all(promises) };
  };

  describe('given a request to process a wrongly formatted email', () => {
    it('the message is retried at least 3 times before being moved to dead letter queue', async () => {
      const msg = {
        Bucket: 'test',
        Key: getUUID().toString(),
      };
      const { task } = await setupQueueForMessage(msg.Key, 3);
      await sendMessage({
        exchange: APP_EXCHANGE,
        key: 'comm_inbound_email',
        message: msg,
      });

      const res = await task;
      expect(res.every(p => p)).to.be.true;

      // give time to the message to be routed by dead letter exchange
      await timedOut(300);

      const deadLetterMsg = await conn.get(`${getEnvQueueName('mail_queue')}${DEAD_LETTER_QUEUE_SUFFIX}`, { noAck: true });
      expect(JSON.parse(deadLetterMsg.content)).to.deep.equal(msg);

      const retryMsg = await conn.get(`${getEnvQueueName('mail_queue')}${RETRY_QUEUE_SUFFIX}`, { noAck: true });
      expect(retryMsg).to.be.false;
    });
  });
});
