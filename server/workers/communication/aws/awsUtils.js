/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import AWS from 'aws-sdk';
import { simpleParser } from 'mailparser';
import Promise from 'bluebird';
import MailComposer from 'nodemailer/lib/mail-composer';
import fs from 'fs';
import cheerio from 'cheerio';
import newUUID from 'uuid/v4';
import config from '../../../config';
import loggerModule from '../../../../common/helpers/logger';
import { NoRetryError } from '../../../common/errors';
import { sanitize } from './sanitizeHTML';
import { getCommByS3Key } from '../../../dal/communicationRepo';

import { EMAIL_ADDRESS, UNICODE_NULL } from '../../../../common/regex';
import { parseMessageId } from '../../../../common/helpers/emailParser';
import { assert } from '../../../../common/assert';

const logger = loggerModule.child({ subType: 'aws' });
const ses = new AWS.SES(config.aws);

const tryGetReceivedForValue = receivedHeader => {
  if (!receivedHeader.length) return '';
  const [sesReceivedStep] = receivedHeader;
  const matches = sesReceivedStep.match(EMAIL_ADDRESS);
  return matches && matches.length ? matches[0] : '';
};

const getEmailText = (text, receivedHtml) => {
  if (text) return text;
  if (!receivedHtml) return '';

  try {
    const $ = cheerio.load(`<div class="__cheerio_root__">${receivedHtml}</div>`);
    return $('.__cheerio_root__').text();
  } catch (err) {
    logger.error({ err }, 'error trying to get text version from html version');
    return '';
  }
};

const getEmailTargetDetails = (field = {}) => {
  const { value = [] } = field;
  if (!value.length) return { emails: [] };
  const { name, address } = value[0] || {};
  return {
    name,
    address: (address || '').toLowerCase(),
    emails: value.map(email => (email.address || '').toLowerCase()),
  };
};

const mapToObject = strMap => {
  const obj = Object.create(null);
  for (const [k, v] of strMap) {
    // We don’t escape the key '__proto__'
    // which can cause problems on older engines
    obj[k] = v;
  }
  return obj;
};

const mimeMessageHTMLTextFilter = text => (text || '').replace(UNICODE_NULL, '');

export const parseEmailFromMimeMessage = async (ctx, mimeMessage) => {
  assert(mimeMessage, "parseEmailFromMimeMessage was refactored to incude ctx but calling function was not");
  try {
    logger.info({ ctx, messageLength: mimeMessage.length }, 'parseEmailFromMimeMessage creating parser')
    const mailObject = await simpleParser(mimeMessage);
    logger.info({ messageLength: mimeMessage.length }, 'Back from constructing simpleParser');

    const receivedHtml = sanitize(mailObject.html || '', mimeMessageHTMLTextFilter);

    const fromDetails = getEmailTargetDetails(mailObject.from);
    const toDetails = getEmailTargetDetails(mailObject.to);
    const ccDetails = getEmailTargetDetails(mailObject.cc);
    const headers = mapToObject(mailObject.headers);
    const receivedFor = tryGetReceivedForValue(headers.received || []);
    const inReplyTo = parseMessageId(mailObject.inReplyTo);
    const messageId = parseMessageId(mailObject.messageId) || newUUID();

    return {
      event: 'inbound',
      msg: {
        text: getEmailText(mailObject.text, receivedHtml),
        html: receivedHtml,
        headers,
        subject: mailObject.subject,
        from_email: fromDetails.address,
        from_name: fromDetails.name,
        emails: toDetails.emails,
        cc: ccDetails.emails,
        inReplyTo,
        messageId,
        references: mailObject.references,
        replyTo: mailObject.replyTo && mailObject.replyTo.text,
        receivedFor,
        returnPath: headers['return-path'],
      },
      attachments: mailObject.attachments,
    };
  } catch (err) {
    logger.error({ err }, 'error parsing iconming email');
    throw err;
  }
};

export const parseEmail = (ctx, buffer) => {
  assert(buffer, "parseEmail was refactored to include ctx but calling function was not");
  logger.info({ ctx, bufferLength: buffer.length }, 'converting buffer to string')
  const mimeMessage = buffer.toString('utf8', 0, buffer.length);
  logger.info({ ctx, bufferLength: buffer.length }, 'back from converting buffer to string')
  return parseEmailFromMimeMessage(ctx, mimeMessage);
};

const retrieveEmailFromS3 = async (ctx, params) => {
  assert(params, "retrieveEmailFromS3 was refactored to incude ctx but calling function was not");
  const { Bucket, Key, tenant } = params;

  const s3 = new AWS.S3(config.aws);
  try {
    logger.info({ ctx, s3Key: Key }, "calling getObject");
    const emailObj = await s3.getObject({ Bucket, Key }).promise();
    logger.info({ ctx, s3Key: Key, emailObjLength: emailObj.length }, "calling buffer.from");
    const ret = Buffer.from(emailObj.Body);
    logger.info({ ctx, s3Key: Key, bodyLength: ret.length}, "back from calling buffer.from");
    return ret;
  } catch (e) {
    const existingCommMessage = await getCommByS3Key(tenant, Key);

    if (!existingCommMessage) {
      const message = `Error getting object ${Key} from bucket ${Bucket}.
          Make sure they exist and your bucket is in the same region as this function.`;
      logger.error({ ctx }, message);
      throw new NoRetryError(e);
    } else {
      logger.warn({ ctx }, `Email with ${Key} from bucket ${Bucket} was already processed`);
      return {
        alreadyProcessed: true,
      };
    }
  }
};

export const deleteS3Mail = async (ctx, params) => {
  assert(params, "deleteS3Mail was refactored to incude ctx but calling function was not");
  try {
    const s3 = new AWS.S3(config.aws);
    const { Bucket, Key } = params;
    logger.trace({ ctx, params }, 'Removing email from S3');
    await s3.deleteObject({ Bucket, Key }).promise();
    logger.debug({ ctx, params }, 'Mail removed from S3 bucket');
  } catch (error) {
    logger.warn({ ctx, error, params }, 'Unable to clean mail in S3');
  }
};

export const getS3Mail = async (ctx, params) => {
  assert(params, "getS3Mail was refactored to incude ctx but calling function was not");
  logger.trace({ ctx, params }, 'Fetching email from S3');
  const email = await retrieveEmailFromS3(ctx, params);
  logger.trace({ ctx, params }, 'Back from fetching email from S3');
  if (email.alreadyProcessed) return email;

  logger.trace({ ctx, params }, 'Parsing email');
  const parsedEmail = await parseEmail(ctx, email);
  logger.trace({ ctx, params }, 'Back from parsing email');
  return parsedEmail;
};

const deleteMessageFiles = async (ctx, message) => {
  assert(message, "deleteMessageFiles was refactored to incude ctx but calling function was not");
  const unlink = Promise.promisify(fs.unlink);
  if (message.files) {
    try {
      await Promise.all(message.files.map(f => unlink(f.path)));
    } catch (error) {
      logger.warn({ ctx, error, meesageFiles: JSON.stringify(message.files) }, 'Error deleting message file');
    }
  }
};

export const sendMailAws = async (ctx, message) => {
  const mailOptions = {
    from: message.from,
    to: message.to,
    replyTo: message.replyTo || message.from,
    text: message.text,
    html: message.html,
    subject: message.subject || 'Reva',
  };
  if (message.messageId) {
    mailOptions.messageId = message.messageId;
  }
  if (message.replyMessageId) {
    mailOptions.inReplyTo = message.replyMessageId;
  }

  if (message.files) {
    mailOptions.attachments = message.files.map(a => ({
      filename: a.originalName,
      path: a.path,
      ...a.additional,
    }));
  }

  const { to, from, subject } = message;

  logger.trace({ ctx, from, to, subject }, 'sendMail');

  return new Promise((resolve, reject) => {
    try {
      const mail = new MailComposer(mailOptions);
      mail.compile().build((err, mimeMessage) => {
        if (err) {
          logger.error({ ctx, err }, 'Error while composing outbound email');
          reject(err);
        }
        return ses
          .sendRawEmail({ RawMessage: { Data: mimeMessage } })
          .promise()
          .then(async res => {
            // TODO: save message ID if needed
            logger.info({ ctx, messageId: res.MessageId }, `Email message delivered, ID=${res.MessageId}`);
            await deleteMessageFiles(ctx, message);
            resolve(res);
          })
          .catch(error => {
            logger.error({ ctx, error }, 'A SES error occurred');
            reject(error);
          });
      });
    } catch (ex) {
      logger.error({ ctx, ex }, 'Error while compiling outbound email - MailComposer');
      reject(ex);
    }
  });
};
