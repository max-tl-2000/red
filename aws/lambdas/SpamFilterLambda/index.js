/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';

const AWS = require('aws-sdk');

const isMessageToNoreply = emailAddress => emailAddress.includes('noreply@') || emailAddress.includes('no-reply@') || emailAddress.includes('mailer-daemon@');
const isSESMailerDaemon = emailAddress => emailAddress.toLowerCase().includes('mailer-daemon@amazonses.com');

function getMailDomain(email) {
  const emailParts = email.split(/[@]+/);
  emailParts.shift();
  return emailParts.toString();
}

exports.handler = function handleSESevent(event, context, callback) {
  console.log('Spam filter starting');

  const sesNotification = event.Records[0].ses;
  const messageId = sesNotification.mail.messageId;
  const receipt = sesNotification.receipt;
  const messageTo = receipt.recipients[0];
  const mailEnv = getMailDomain(messageTo);
  const isMailToNoreply = isMessageToNoreply(messageTo);

  console.log(`Processing message: ${messageId} from ${sesNotification.mail.source} to ${JSON.stringify(receipt.recipients)}`);

  if (receipt.spfVerdict.status === 'FAIL') {
    console.log(`spfVerdict failed: ${messageId} from ${sesNotification.mail.source}`);
  }

  // Check if any spam check failed
  if (
    // receipt.spfVerdict.status === 'FAIL' ||     Michael disabled on 4/19 per discussion with Josh
    // receipt.dkimVerdict.status === 'FAIL' ||    Christophe disabled on 09/08/2022 per discussion with Josh
    receipt.spamVerdict.status === 'FAIL' ||
    receipt.virusVerdict.status === 'FAIL' ||
    isMailToNoreply
  ) {
    console.log(`Detected spam: ${messageId} from ${sesNotification.mail.source}`);

    const sendBounceParams = {
      BounceSender: `mailer-daemon@${mailEnv}`,
      Explanation: 'The address you had written to is not actively receiving emails, or the email content was detected as potential spam. Please contact your leasing agent.',
      OriginalMessageId: messageId,
      MessageDsn: {
        ReportingMta: `dns; ${mailEnv}`,
        ArrivalDate: new Date(),
        ExtensionFields: [],
      },
      BouncedRecipientInfoList: [],
    };

    for (let i = 0; i < receipt.recipients.length; i++) {
      const recipient = receipt.recipients[i];
      sendBounceParams.BouncedRecipientInfoList.push({
        Recipient: recipient,
        BounceType: 'ContentRejected',
      });
    }

    const checks = {
      dkimVerdict: receipt.dkimVerdict.status,
      spamVerdict: receipt.spamVerdict.status,
      virusVerdict: receipt.virusVerdict.status,
      isMailToNoreply,
    };

    console.log('Bouncing message with parameters: ', JSON.stringify({ sendBounceParams, messageId, receipt, mail: sesNotification.mail, checks }, null, 2));

    new AWS.SES().sendBounce(sendBounceParams, (err, data) => {
      console.log(JSON.stringify(data, null, 2));
      if (err) {
        console.log(`An error occurred while sending bounce for message: ${data.MessageId}`, err);
      } else {
        console.log(`Bounce for message ${messageId} sent, bounce message ID: ${data.MessageId}`);
      }
      callback(null, { disposition: 'STOP_RULE_SET' });
    });
  } else if (isSESMailerDaemon(sesNotification.mail.commonHeaders.from[0])) {
    // TEMP: just to avoid filling the queues with bad delivery messages
    // this else branch needs to be removed when we will handle these messages in app
    console.log('SES Mailer Daemon mail -> Stopping mail', messageId);
    callback(null, { disposition: 'STOP_RULE_SET' });
  } else {
    console.log('Accepting message:', messageId);
    callback(null, null);
  }
};

exports.getMailDomain = function forTesting(email) {
  return getMailDomain(email);
};

exports.isMessageToNoreply = function forTesting(emailAddress) {
  return isMessageToNoreply(emailAddress);
};

exports.isSESMailerDaemon = function forTesting(emailAddress) {
  return isSESMailerDaemon(emailAddress);
};
