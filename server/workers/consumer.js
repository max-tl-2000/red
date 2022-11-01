/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import ipc from 'node-ipc';
import Promise from 'bluebird';
import uniq from 'lodash/uniq';
import path from 'path';
import { createRabbitMQConnection } from '../common/pubsubConn';
import config from './config';
import loggerModule from '../../common/helpers/logger';
import { initI18N } from '../../common/server/i18n';
import { createRecurringWorkerConfig, setOnWorkerConfigAdded, setOnWorkerConfigRemoved, TENANT_QUEUE_SUFFIX } from './tasks/recurringJobs';
import {
  APP_EXCHANGE,
  HEADER_MESSAGE_ID,
  HEADER_ORIGINALLY_SENT,
  HEADER_TENANT_ID,
  HEADER_REQUEST_ID,
  HEADER_ORIGINAL_REQUEST_IDS,
  HEADER_DOCUMENT_VERSION,
  DELAYED_APP_EXCHANGE,
  TASKS_MESSAGE_TYPE,
  EXPORT_MESSAGE_TYPE,
} from '../helpers/message-constants';
import { setupRecurringJobHandlers } from './tasks/recurringJobHandlers';
import { getTenant } from '../services/tenantService';
import { NoRetryError } from '../common/errors';
import { isUuid } from '../common/utils';
import { removeToken } from '../../common/helpers/strings';
import { now } from '../../common/helpers/moment-utils';
import { updateRecurringJobStatus } from '../dal/jobsRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { LOG_MESSAGE_MAX_LENGTH } from '../../common/enums/enums';
import sleep from '../../common/helpers/sleep';
import { isRecurringJobActive } from '../services/jobs';
import { createDBKnexInstanceWithCollector } from '../database/knex-query-collector';

const logger = loggerModule.child({ subType: 'AMQP/Consumer' });
const THRESHOLD_TO_CHECK_FOR_NO_MORE_MESSAGES = 1000; // 1 sec
const boundConsumers = {};
let channelStarted = false;
let lastMessageReceived = now();
let noOfRetries = config.noOfFastRetries;
let stopProcessingRequested = false;
let noOfMessagesBeingProcessed = 0;

const range = noOfItems => Array.from(new Array(noOfItems).keys());

export const DEAD_LETTER_QUEUE_SUFFIX = '_dead_letter_queue';
export const RETRY_QUEUE_SUFFIX = '_retry_queue';
export const getEnvQueueName = queueName => `${config.cloudEnv}_${config.env}_${queueName}`;

// used to detect idle activity in integration tests
export const getTimeLastMessageReceived = () => lastMessageReceived;

// converts content from Buffer to string for logging
const reformatMsg = msg => {
  const { content, ...rest } = msg; // eslint-disable-line
  let newContent = content instanceof Buffer ? content.toString('ascii') : content;
  const shouldTruncate = newContent.length > LOG_MESSAGE_MAX_LENGTH;
  if (shouldTruncate) {
    newContent = newContent.substring(0, LOG_MESSAGE_MAX_LENGTH).concat('...');
  }
  return { content: removeToken(newContent), ...rest };
};

const getDeadLetterQueueOptions = ttl => {
  let options = { durable: true };
  if (ttl) {
    options = {
      ...options,
      deadLetterExchange: APP_EXCHANGE,
      messageTtl: ttl,
    };
  }
  return options;
};

const bindDeadLetterQueue = async (chan, { deadLetterExchange, queue, topics, suffix, ttl }) => {
  // declare one dead letter queue per active queue
  const retryQueue = `${queue}${suffix}`;
  await chan.assertQueue(retryQueue, getDeadLetterQueueOptions(ttl));

  logger.trace(`Binding queue=${retryQueue} to exchange=${deadLetterExchange} for topics='${topics}' with TTL=${ttl}`);
  await Promise.all(topics.map(async topic => await chan.bindQueue(retryQueue, deadLetterExchange, topic)));
};

const bind = async (chan, queue, topics) => {
  await bindDeadLetterQueue(chan, {
    deadLetterExchange: config.RETRY_EXCHANGE,
    queue,
    topics,
    suffix: RETRY_QUEUE_SUFFIX,
    ttl: config.messageRetryDelay,
  });
  await bindDeadLetterQueue(chan, {
    deadLetterExchange: config.DEAD_LETTER_EXCHANGE,
    queue,
    topics,
    suffix: DEAD_LETTER_QUEUE_SUFFIX,
  });

  await chan.assertQueue(queue, {
    durable: true,
    deadLetterExchange: config.DEAD_LETTER_EXCHANGE,
  });

  logger.trace({ queue, APP_EXCHANGE, topics }, 'Binding queue');
  await Promise.all(topics.map(async topic => await chan.bindQueue(queue, APP_EXCHANGE, topic)));
};

const consumerIsNotBound = (queue, consumerTag) => {
  const consumers = boundConsumers || {};
  const found = consumers?.[queue]?.find(x => x === consumerTag);
  return !found;
};

const handleFailedMsg = async ({ chan, msg, retryCount, tenantId, queue, originallySentDate, jobId, shouldAddMsgToDLQ }) => {
  if (channelStarted) {
    const msgId = msg.properties.headers[HEADER_MESSAGE_ID];
    const reqId = msg.properties.headers[HEADER_REQUEST_ID];

    const logCtx = {
      tenantId,
      reqId,
      msgId,
      originallySentDate,
      jobId,
    };

    const { routingKey, consumerTag } = msg.fields;
    const formattedMessage = reformatMsg(msg);
    if (retryCount % config.failedMessageLoggedAfter === 0) {
      logger.error(
        {
          ...logCtx,
          consumerTag,
          retryCount,
          amqpMessage: formattedMessage,
          queue,
        },
        'handling failed message',
      );
    }

    if (tenantId && isUuid(tenantId) && !(await getTenant({ tenantId }))) {
      logger.warn({ ...logCtx, consumerTag, queue }, 'Message received for tenant which appears to have been deleted.  Will discard.');
      await chan.ack(msg);
    } else if (retryCount < noOfRetries) {
      logger.warn({ ...logCtx, consumerTag, queue }, 'Publishing failed msg to RETRY_EXCHANGE');
      const res = await chan.publish(config.RETRY_EXCHANGE, routingKey, msg.content, {
        persistent: true,
        headers: {
          ...msg.properties.headers,
          retryCount: retryCount + 1,
          HEADER_ORIGINALLY_SENT: originallySentDate,
        },
      });
      logger.warn({ ...logCtx, consumerTag, resStatus: res, queue }, 'Published msg to RETRY_EXCHANGE');
      await chan.ack(msg);
    } else if (!shouldAddMsgToDLQ) {
      logger.error(
        { ...logCtx, consumerTag, queue, amqpMessageContent: formattedMessage.content },
        'Failed MRI export message, will not publish the message to DEAD_LETTER_EXCHANGE',
      );
      await chan.ack(msg);
    } else {
      logger.warn({ ...logCtx, consumerTag, queue, amqpMessageContent: formattedMessage.content }, 'Publishing msg to DEAD_LETTER_EXCHANGE');
      await chan.nack(msg, false, false);
      logger.warn({ ...logCtx, consumerTag, queue, amqpMessageContent: formattedMessage.content }, 'Published msg to DEAD_LETTER_EXCHANGE');

      if (jobId) {
        await updateRecurringJobStatus({ tenantId }, jobId, DALTypes.JobStatus.IDLE);
      }
    }
  }
};

const shouldNotProcessOnDemandCompleteOrCancelMsgTasks = async (ctx, payload, routingKey, logCtx) => {
  const onDemandDecisionsMsgs = [TASKS_MESSAGE_TYPE.COMPLETE_ON_DEMAND, TASKS_MESSAGE_TYPE.CANCEL_ON_DEMAND];
  const onDemandTasksToIgnore = [DALTypes.TaskNames.INTRODUCE_YOURSELF, DALTypes.TaskNames.FOLLOWUP_PARTY];
  const { tenantId } = ctx;
  const { tasks = [] } = payload;

  const isOnDemandDecisionMsgAndIsTaskToIgnore = tenantId && onDemandDecisionsMsgs.includes(routingKey) && onDemandTasksToIgnore.some(t => tasks.includes(t));

  if (!isOnDemandDecisionMsgAndIsTaskToIgnore) return false;

  const isJobActive = await isRecurringJobActive(ctx, DALTypes.Jobs.TasksFollowupParty);

  !isJobActive &&
    logger.trace(logCtx({ jobName: DALTypes.Jobs.TasksFollowupParty, isRecurringJobActive: isJobActive }), 'Skipping on demand complete/cancel msg');

  return !isJobActive;
};

const consume = async (chan, queue, topics, consumerNo, resolver) => {
  logger.info({ queue, consumerNo }, 'Starting consumer');

  const tag = await chan.consume(
    queue,
    async msg => {
      if (msg === null) return;
      lastMessageReceived = now();

      const { exchange, routingKey, consumerTag, redelivered } = msg.fields;
      const retryCount = msg.properties.headers.retryCount || 0;
      const msgId = msg.properties.headers[HEADER_MESSAGE_ID];
      const originallySentDate = msg.properties.headers[HEADER_ORIGINALLY_SENT];
      let tenantId = msg.properties.headers[HEADER_TENANT_ID];
      const reqId = msg.properties.headers[HEADER_REQUEST_ID];
      const originalRequestIds = msg.properties.headers[HEADER_ORIGINAL_REQUEST_IDS];
      const documentVersion = msg.properties.headers[HEADER_DOCUMENT_VERSION];
      const shouldAddMsgToDLQ = routingKey !== EXPORT_MESSAGE_TYPE.EXPORT_TO_MRI;

      const logCtx = addedFields => ({
        tenantId,
        chanIndex: chan.chanIndex,
        routingKey,
        exchange,
        reqId,
        originalRequestIds,
        documentVersion,
        msgId,
        consumerNo,
        amqpMessage: reformatMsg(msg),
        originallySentDate,
        ...addedFields,
      });

      let handlerSucceeded = false;
      let payload = msg.content;

      let collector;
      let dbKnex;
      let ctx;

      try {
        logger.trace(logCtx({ retryCount }), 'Received msg');

        noOfMessagesBeingProcessed++;

        stopProcessingRequested && logger.trace(logCtx({ retryCount }), 'Stop consuming messages requested.');

        payload = JSON.parse(msg.content);
        tenantId = tenantId || payload.tenantId || (payload.ctx && payload.ctx.tenantId) || '';

        if (await shouldNotProcessOnDemandCompleteOrCancelMsgTasks({ tenantId }, payload, routingKey, logCtx)) {
          await chan.ack(msg);
          handlerSucceeded = false;
          resolver && resolver.completeWaiterForMsg(payload, handlerSucceeded, msg);
          noOfMessagesBeingProcessed--;
          return;
        }

        if (redelivered === true) {
          logger.trace(logCtx({ redelivered: true }), 'Reject redelivered message, possible network split.');
          await handleFailedMsg({
            chan,
            msg,
            noOfRetries,
            tenantId,
            queue,
            originallySentDate,
            jobId: payload.jobId,
            shouldAddMsgToDLQ,
          });
          handlerSucceeded = false;
          resolver && resolver.completeWaiterForMsg(payload, handlerSucceeded, msg);
          noOfMessagesBeingProcessed--;
          return;
        }

        const tenant = tenantId && isUuid(tenantId) ? await getTenant({ tenantId }, tenantId) : {};

        if (!tenant) {
          if (channelStarted) {
            logger.warn({ tenantId, consumerTag }, 'Message received for tenant which appears to have been deleted. Will discard.');

            if (consumerIsNotBound(queue, consumerTag)) {
              logger.trace(logCtx({ consumerTag }), 'Received msg for an unbound consumer.');
            } else {
              await chan.ack(msg);
            }
          }
          handlerSucceeded = false;
          resolver && resolver.completeWaiterForMsg(payload, handlerSucceeded, msg);
          noOfMessagesBeingProcessed--;
          return;
        }

        const handler = topics[routingKey];
        if (!handler) throw new Error(`no handler found for ${routingKey}`);

        ctx = { routingKey, reqId, msgId, retryCount, tenantId, tenantName: tenant.name, originalRequestIds, documentVersion };

        if (config?.dbProfiling?.enabled) {
          const { dbKnex: dbKnexInstance, collector: queriesCollector } = createDBKnexInstanceWithCollector(config.dbProfiling);
          collector = queriesCollector;
          dbKnex = ctx.dbKnex = dbKnexInstance;
        }

        const { processed, retry = true } = await handler({ msgCtx: ctx, routingKey, reqId, msgId, consumerNo, ...payload }, msg);

        logger.trace(logCtx({ processed }), 'handler has completed');
        if (processed === true) {
          if (channelStarted) {
            logger.trace(logCtx({ processed }), '========ACK msg=====');
            if (consumerIsNotBound(queue, consumerTag)) {
              logger.trace(logCtx({ consumerTag }), 'Received msg for an unbound consumer.');
            } else {
              await chan.ack(msg);
              handlerSucceeded = true;
            }
          }

          // means that the message is for a recurring job, it got processed and we need to mark it as done.
          if (payload.jobId) {
            await updateRecurringJobStatus({ ...ctx, tenantId }, payload.jobId, DALTypes.JobStatus.IDLE);
          }
        } else {
          await handleFailedMsg({
            chan,
            msg,
            retryCount: retry === true ? retryCount : noOfRetries,
            tenantId,
            queue,
            originallySentDate,
            jobId: payload.jobId,
            shouldAddMsgToDLQ,
          });
        }
        resolver && resolver.completeWaiterForMsg(payload, handlerSucceeded, msg);
        noOfMessagesBeingProcessed--;
      } catch (error) {
        logger.error(logCtx({ error, retryCount }), 'consumer caught error');
        if (error instanceof NoRetryError) {
          logger.error({ noRetryError: error, routingKey, consumerTag }, 'Error thrown is not retryable');
          if (channelStarted) {
            if (consumerIsNotBound(queue, consumerTag)) {
              logger.trace(logCtx({ consumerTag }), 'Received msg for an unbound consumer.');
            } else if (!shouldAddMsgToDLQ) {
              logger.error(
                { noRetryError: error, routingKey, consumerTag },
                'Failed MRI export message, will not publish the message to DEAD_LETTER_EXCHANGE - no retry error',
              );
              await chan.ack(msg);
            } else {
              logger.error({ noRetryError: error, routingKey, consumerTag }, 'Message will be moved to dead letter queue');
              await chan.nack(msg, false, false);
            }
          }
          resolver && resolver.completeWaiterForMsg(payload, handlerSucceeded, msg, error);
          noOfMessagesBeingProcessed--;
          return;
        }
        await handleFailedMsg({
          chan,
          msg,
          retryCount,
          tenantId,
          queue,
          originallySentDate,
          jobId: payload.jobId,
          shouldAddMsgToDLQ,
        });
        resolver && resolver.completeWaiterForMsg(payload, handlerSucceeded, msg, error);
        noOfMessagesBeingProcessed--;
        return;
      } finally {
        if (dbKnex && collector) {
          let report = collector.generateReport(dbKnex);
          logger.debug({ ctx, report }, 'db queries report');
          ctx.dbKnex = dbKnex = null;
          report = null;
        }
      }
    },
    { noAck: false },
  );
  return tag;
};

const cleanDeadLetterQueue = async (queue, chan, deleteTenantQueues, retryQueueName, ttl) => {
  const retryQueue = `${queue}${retryQueueName}`;
  await chan.assertQueue(retryQueue, getDeadLetterQueueOptions(ttl));

  await chan.purgeQueue(retryQueue);
  if (deleteTenantQueues && retryQueue.includes(TENANT_QUEUE_SUFFIX)) {
    await chan.deleteQueue(retryQueue);
  }
};

const clearConsumerTags = queue => (boundConsumers[queue] = []);

const stopConsuming = async (queue, chan, clearTags = true) => {
  const tags = boundConsumers[queue] || [];
  await Promise.all(tags.map(tag => chan.cancel(tag)));
  clearTags && clearConsumerTags(queue);
};

const cleanQueue = async (queue, chan, deleteTenantQueues) => {
  logger.trace({ queue }, 'cleanQueue - start');
  await stopConsuming(queue, chan);

  logger.trace({ queue }, 'cleanQueue - assert');
  await chan.assertQueue(queue, {
    durable: true,
    deadLetterExchange: config.DEAD_LETTER_EXCHANGE,
  });
  logger.trace({ queue }, 'cleanQueue - purge');
  await chan.purgeQueue(queue);

  if (deleteTenantQueues && queue.includes(TENANT_QUEUE_SUFFIX)) {
    await chan.deleteQueue(queue);
    delete boundConsumers[queue];
  }

  await cleanDeadLetterQueue(queue, chan, deleteTenantQueues, RETRY_QUEUE_SUFFIX, config.messageRetryDelay);
  await cleanDeadLetterQueue(queue, chan, deleteTenantQueues, DEAD_LETTER_QUEUE_SUFFIX);
  logger.trace({ queue }, 'cleanQueue - done');
  return queue;
};

const setupConsumer = async (workerConfig, chan, bindConsumers, resolver) => {
  const topics = Object.keys(workerConfig.topics);
  const queueName = getEnvQueueName(workerConfig.queue);

  logger.trace(`Setting up ${queueName}`);
  await bind(chan, queueName, topics);

  if (bindConsumers) {
    const consumers = range(workerConfig.noOfConsumers || config.defaultConsumersPerQueue);
    const tags = await Promise.all(consumers.map(index => consume(chan, queueName, workerConfig.topics, index, resolver)));
    boundConsumers[queueName] = tags.map(t => t.consumerTag);
  }

  workerConfig.initialPublish && (await workerConfig.initialPublish());
  return workerConfig;
};

const getConfigsForWorkersToBeSetup = async workerKeysToBeStarted => {
  if (workerKeysToBeStarted.length === 0) {
    const recurringWorkersConfig = await createRecurringWorkerConfig();
    const allConfigs = { ...config.workerConfig, ...recurringWorkersConfig };
    return Object.keys(allConfigs).map(key => allConfigs[key]);
  }

  let recurringWorkersConfig;
  const lazyLoadRecurringWorkersConfig = async () => {
    recurringWorkersConfig = recurringWorkersConfig || (await createRecurringWorkerConfig());
    return recurringWorkersConfig;
  };

  return await Promise.reduce(
    workerKeysToBeStarted,
    async (acc, key) => {
      let conf = config.workerConfig[key];
      if (conf) return [conf, ...acc];

      const rwc = await lazyLoadRecurringWorkersConfig();
      conf = rwc[key];
      if (conf) return [conf, ...acc];
      return acc;
    },
    [],
  );
};

export const setupConsumers = async (chan, resolver, workerKeysToBeStarted = [], bindConsumers = true, noOfMsgRetries = 0) => {
  channelStarted = true;
  noOfRetries = noOfMsgRetries;
  chan.prefetch(1);
  await chan.assertExchange(DELAYED_APP_EXCHANGE, 'x-delayed-message', { arguments: { 'x-delayed-type': 'fanout' } });
  await chan.assertExchange(APP_EXCHANGE, 'topic', { durable: true });
  await chan.assertExchange(config.RETRY_EXCHANGE, 'topic', { durable: true });
  await chan.assertExchange(config.DEAD_LETTER_EXCHANGE, 'topic', {
    durable: true,
  });
  await chan.bindExchange(APP_EXCHANGE, DELAYED_APP_EXCHANGE);

  const cfgs = await getConfigsForWorkersToBeSetup(workerKeysToBeStarted);
  await Promise.all(cfgs.map(conf => setupConsumer(conf, chan, bindConsumers, resolver)));

  setOnWorkerConfigAdded(async ({ name, conf }) => {
    logger.debug({ name, conf, workerKeysToBeStarted }, 'workerConfigAdded');
    if (workerKeysToBeStarted.length > 0 && !workerKeysToBeStarted.includes(name)) {
      return Promise.resolve();
    }

    return await setupConsumer(conf, chan, bindConsumers, resolver);
  });
  setOnWorkerConfigRemoved(queue => cleanQueue(getEnvQueueName(queue), chan, true));
};

export const stopConsumingMessages = async (conn, chan) => {
  logger.info({ noOfMessagesBeingProcessed }, 'stop message processing requested');

  const clearTags = false;
  stopProcessingRequested = true;
  const allQueues = uniq([...Object.keys(boundConsumers), ...Object.keys(config.workerConfig).map(k => getEnvQueueName(config.workerConfig[k].queue))]);
  await Promise.all(allQueues.map(queue => stopConsuming(queue, chan, clearTags)));
  logger.info({ noOfMessagesBeingProcessed }, 'finished stopping consumers');

  while (noOfMessagesBeingProcessed > 0) {
    logger.info({ noOfMessagesBeingProcessed }, 'waiting for message processing to complete');
    await sleep(THRESHOLD_TO_CHECK_FOR_NO_MORE_MESSAGES);
  }

  await Promise.all(allQueues.map(queue => clearConsumerTags(queue)));

  logger.info({ noOfMessagesBeingProcessed }, 'finished waiting for all messages to complete');
};

const listenToControlEvents = (conn, chan) => {
  ipc.config.id = 'worker';

  ipc.serve('/tmp/worker.socket', () =>
    ipc.server.on('shutdown', async (ipcMsg, socket) => {
      if (ipcMsg?.event === 'SIGTERM') {
        logger.trace({ ipcMsg }, 'service shutdown message');

        await stopConsumingMessages(conn, chan);

        ipc.server.emit(socket, 'shutdown', { event: 'SIGTERM', result: 'SUCCESS' });
      }
    }),
  );

  ipc.server.start();
};

export const startConsumers = async (bindConsumers = true, skipRecurringJobs) => {
  try {
    const { conn, chan } = await createRabbitMQConnection();
    conn.on('error', error => {
      if (error.message !== 'Connection closing') {
        logger.error({ error }, 'conn error');
      }
    });

    conn.on('close', () => {
      logger.trace('reconnecting');
      return setTimeout(() => startConsumers(bindConsumers, skipRecurringJobs), 1000);
    });

    logger.info('connected');

    await setupConsumers(chan, undefined, [], bindConsumers, config.noOfFastRetries);

    if (!skipRecurringJobs) setupRecurringJobHandlers();

    listenToControlEvents(conn, chan);
    return chan; // eslint-disable-line
  } catch (error) {
    logger.error({ error }, 'startConsumers AMQP error');
    return setTimeout(() => startConsumers(bindConsumers, skipRecurringJobs), 1000); // eslint-disable-line consistent-return
  }
};

export const clean = async (chan, deleteTenantQueues) => {
  if (!chan) return;
  logger.trace({ deleteTenantQueues }, 'Starting to clean AMQP connection');

  try {
    channelStarted = false;
    // TODO: for some reason, we must clean all queues, not just bound ones...
    const allQueues = uniq([...Object.keys(boundConsumers), ...Object.keys(config.workerConfig).map(k => getEnvQueueName(config.workerConfig[k].queue))]);

    await Promise.all(allQueues.map(queue => cleanQueue(queue, chan, deleteTenantQueues)));
    await chan.nackAll();
  } catch (error) {
    logger.error({ error }, 'AMQP clean error');
  }
};

// IMPORTANT. this is a temporary solution until a more robust solution is found
// the problem is that the right language to use for translations can only be
// determined from the context of the request.
// The main problem so far is that our client code imports the t function directly
// from the i18next module, which is a singleton. In the client side there are not issues
// doing this but in the server side the right language is defined at the request level
// so it is not possible to simply import { t } from 'i18next'. The code that does that
// will return undefined as the result of calling `t` with any key.
// There are several solutions to fix this problem
// 1. Load only english for now, and let the client code remain as it is
// 2. Refactor the code that needs the translations to not require them, make all the translation related code
//    part of a single function so it can be easily reused from both server and client side.
// 3. Use vm.runInNewContext to inject the right language so `import { t }` works trasnparently
//
// the current code implements solution #1

export const initLanguages = async () => {
  await initI18N({
    logger,
    namespaceDir: path.resolve(__dirname, '../../trans/en/'),
    loadPath: path.resolve(__dirname, '../../trans/{{lng}}/{{ns}}.yml'),
  });
};
