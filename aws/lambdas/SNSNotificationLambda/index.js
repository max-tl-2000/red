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
const apiPath = `/api/webhooks/email/status?api-token=${apiToken}`;

// -----------------------------
// This section is the same code as the RouterLambda.
// Please make sure that both lambdas are updated when modifying this code

const baseDomain = 'reva.tech';
const productionEnv = 'prod';
const noReplyEmail = 'noreply';

const isRedirectStatusCode = statusCode => [301, 302].includes(statusCode);

function isLocalEnv(env) {
  return env === 'local' || env.includes('cucumber');
}

function getLocalHostname(source, env) {
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

  const emailParts = source.split(/[@]+/);

  // Note that this is used so that we can test bounce, so if you use an address like christophe_bounce@reva.tech, it will bounce
  const recipient = emailParts.shift().split(/\+/)[0];
  const name = recipient.split(/_/)[0];
  const hostname = userMap[name];
  return hostname || userMap[env] || 'cucumber-1';
}

const getCloudEnvHostname = (isProdEmail, tenant, env) => {
  if (isProdEmail) return `${tenant}.${baseDomain}`;
  return `${tenant}.${env}.env.${baseDomain}`;
};

function getEnvSpecificData(domain, source) {
  const emailParts = domain.split(/[@]+/);
  const recipient = emailParts.shift(); // eslint-disable-line
  const emailPartsArr = emailParts.toString().split('.');
  const isProdEmail = emailPartsArr.length <= 4;
  const tenant = emailPartsArr.shift();
  const env = isProdEmail ? productionEnv : emailPartsArr.shift();
  const bucket = `red-${env}-emails`;
  const hostname = isLocalEnv(env) ? getLocalHostname(source, env) : getCloudEnvHostname(isProdEmail, tenant, env);

  return {
    bucket,
    hostname,
    mailApiPath: apiPath,
    tenant,
    env,
    recipient,
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

  const protocol = isLocalEnv(params.env) ? http : https;
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

exports.handler = function handleEvent(event, context) {
  console.log('Received event:', JSON.stringify(event, null, 2));
  const JSONmessage = event.Records[0].Sns.Message;
  const message = JSON.parse(JSONmessage);
  const eventType = message.notificationType;
  const params = {
    messageId: message.mail.messageId,
    type: eventType,
    email: message.mail.source,
  };
  if (eventType === 'Bounce') {
    const bouncedRecipients = [];
    for (let i = 0; i < message.bounce.bouncedRecipients.length; i++) {
      bouncedRecipients.push(message.bounce.bouncedRecipients[i].emailAddress);
    }
    params.recipients = bouncedRecipients;
  }

  if (eventType === 'Delivery') {
    params.recipients = message.delivery.recipients;
  }
  const source = message.mail.source.match(/\<(.*)\>/);
  const domainData = getEnvSpecificData(source ? source[1] : message.mail.source, params.recipients[0]);
  params.tenant = domainData.tenant;
  params.env = domainData.env;

  if (domainData.recipient !== noReplyEmail) {
    callMailEndpoint(domainData.hostname, domainData.mailApiPath, params, context);
  }
};

exports.getEnvSpecificData = function forTesting(domain, source) {
  return getEnvSpecificData(domain, source);
};
