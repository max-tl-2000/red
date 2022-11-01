/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { clean } from '../consumer';
import { createRabbitMQConnection } from '../../common/pubsubConn';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'AMQP' });

describe('/AMQP integration', () => {
  let currentChan;

  beforeEach(async () => {
    try {
      const { chan } = await createRabbitMQConnection();
      await clean(currentChan);
      currentChan = chan;
    } catch (ex) {
      logger.error({ error: ex }, 'AMQP beforeEach error');
    }
  });

  afterEach(async () => {
    await clean(currentChan);
  });

  describe('sending&receive a message', () => {
    it('with valid message type enqueues it', async () => {
      const testData = {
        type: 'in',
        msg: 'testing AMPQ',
      };
      const exchangeName = 'test_exchange';
      const queueName = 'test_queue_message_type';
      const messageType = 'test_message_type';

      await currentChan.assertExchange(exchangeName, 'topic', {
        durable: true,
      });
      await currentChan.assertQueue(queueName, { durable: true });
      currentChan.bindQueue(queueName, exchangeName, messageType);

      const sent = await currentChan.publish(exchangeName, messageType, Buffer.from(JSON.stringify(testData)), { persistent: true });
      expect(sent).to.deep.equal(true);

      let rejector;
      let resolver;
      const promise = new Promise((resolve, reject) => {
        resolver = resolve;
        rejector = reject;
      });

      const { consumerTag } = await currentChan.consume(
        queueName,
        msg => {
          const payload = JSON.parse(msg.content);
          expect(payload).to.deep.equal(testData);

          try {
            currentChan.ack(msg);
            resolver();
          } catch (e) {
            currentChan.nack(msg, false, false); // Dead Lettered nack(msg, allUpTo=false, requeue=false)
            rejector();
          }
        },
        { noAck: false },
      );
      await promise;
      currentChan.cancel(consumerTag);
    });
  });
});
