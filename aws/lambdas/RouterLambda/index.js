/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const http = require('http');
const https = require('https');
const url = require('url');
const version = '1.0.1'; // eslint-disable-line
const apiToken = '{service-api-token}'; // needs to be manually edited in prod
const apiPath = `/api/webhooks/email?api-token=${apiToken}`;

// -----------------------------
// This section is the same code as the RouterLambda.
// Please make sure that both lambdas are updated when modifying this code

const baseDomain = 'reva.tech';
const productionEnv = 'prod';
const localEnv = 'local';

const isRedirectStatusCode = statusCode => [301, 302].includes(statusCode);

function getLocalHostname(sender, tenant) {
  // this is only needed for dev purposes
  const userMap = {
    'cucumber-1': 'cucumber-1',
    'cucumber-2': 'cucumber-2',
    'cucumber-3': 'cucumber-3',
    'cucumber-4': 'cucumber-4',
    'cucumber-5': 'cucumber-5',
    'cucumber-6': 'cucumber-6',
    'cucumber-7': 'cucumber-7',
    'cucumber-8': 'cucumber-8',
    'cucumber-9': 'cucumber-9',
    'cucumber-10': 'cucumber-10',
    'cucumber-11': 'cucumber-11',
    'cucumber-12': 'cucumber-12',
    'cucumber-13': 'cucumber-13',
    'cucumber-14': 'cucumber-14',
    'cucumber-15': 'cucumber-15',
    'cucumber-16': 'cucumber-16',
    'cucumber-17': 'cucumber-17',
    'cucumber-18': 'cucumber-18',
    'cucumber-19': 'cucumber-19',
    'cucumber-20': 'cucumber-20',
  };

  // This code was to extract the name of the tenant using the email id.
  const emailParts = sender.split(/[@]+/);

  // Note that this is used so that we can test bounce, so if you use an address like christophe_bounce@reva.tech, it will bounce
  const recipient = emailParts.shift().split(/\+/)[0];
  const name = recipient.split(/_/)[0];

  // userMap is used when receiving an email other than reva, and the tenant can not be retrieved from the emailId ({emailId}@reva.tech or a user owned email {emailId}@gmail.com).
  // Then we use the tenant name. This means that the developer needs to create a local tenant with his first name (equivalent to emailId)...
  return userMap[name] || userMap[tenant] || 'cucumber-1';
}

const getCloudEnvHostname = (isProdEmail, tenant, env) => {
  if (isProdEmail) return `${tenant}.${baseDomain}`;
  return `${tenant}.${env}.env.${baseDomain}`;
};

// Recipient: destination email, Sender: source email
function getEnvSpecificData(recipientEmail, sender) {
  const emailParts = recipientEmail.split(/[@]+/);
  const recipient = emailParts.shift(); // eslint-disable-line
  const emailPartsArr = emailParts.toString().split('.');
  const isProdEmail = emailPartsArr.length <= 4;
  const tenant = emailPartsArr.shift();
  const env = isProdEmail ? productionEnv : emailPartsArr.shift();
  const bucket = `red-${env}-emails`;
  const hostname = env === localEnv ? getLocalHostname(sender, tenant) : getCloudEnvHostname(isProdEmail, tenant, env);

  return {
    bucket,
    hostname,
    mailApiPath: apiPath,
    tenant,
    env,
  };
}

function callMailEndpoint(hostname, mailApiPath, params, context) {
  const options = {
    host: hostname,
    path: mailApiPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };

  const protocol = params.env === localEnv ? http : https;
  if (protocol === http) {
    options.port = 3030;
  }
  console.log(`Calling: ${JSON.stringify(options, null, 2)}`);

  const body = JSON.stringify(params);
  console.log(body);

  const req = protocol.request(options, res => {
    console.log(`Result code: ${res.statusCode}`);
    if (res.statusCode === 200) {
      console.log('Successfully processed HTTP response');
      context.succeed('MailEndpoint call succeeded');
    } else if (isRedirectStatusCode(res.statusCode)) {
      const redirectedLocation = res.headers.location || '';

      if (!redirectedLocation) {
        throw new Error(`No location to redirect found ${JSON.stringify(res.headers)}`);
      }

      const redirectUrl = url.parse(redirectedLocation);
      const { hostname: redirectHostname, path: redirectMailApiPath } = redirectUrl;
      callMailEndpoint(redirectHostname, redirectMailApiPath, params, context);
    } else {
      throw new Error(`Request failed with: ${res.statusCode} - ${res.statusMessage} - ${body}`);
    }
  });
  req.on('error', context.fail);
  req.write(body);
  req.end();
}

// -----------------------------

exports.handler = function handleSESevent(event, context) {
  const [eventRecord] = event.Records;
  const { ses } = eventRecord;
  if (!ses) {
      console.error(`Received SES event with no SES field! ${JSON.stringify({ event, context })}`);
      throw new Error('Cannot process with no ses field!');
  }
  const { mail, receipt } = ses;
  if (!mail || !receipt) {
      console.error(`Received SES event with missing mail/receipt field! ${JSON.stringify({ event, context })}`);
      throw new Error('Cannot process with malformed event!');
  }

  console.log(`Received event - MessageId: ${mail.messageId} - Source: ${mail.source} - Recipients: ${receipt.recipients.join(', ')}`);

  const data = getEnvSpecificData(receipt.recipients[0], mail.source);
  const params = {
    Bucket: data.bucket,
    Key: mail.messageId,
    tenant: data.tenant,
    env: data.env,
  };
  callMailEndpoint(data.hostname, data.mailApiPath, params, context);
};

exports.getEnvSpecificData = function forTesting(env, source) {
  return getEnvSpecificData(env, source);
};
