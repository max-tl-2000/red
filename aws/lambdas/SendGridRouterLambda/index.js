/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const http = require('http');
const https = require('https');
const url = require('url');
const version = '1.0.0'; // eslint-disable-line
const apiToken = '{service-api-token}'; // needs to be manually edited in prod
const apiPath = `/api/webhooks/sendGridStats?api-token=${apiToken}`;

const baseDomain = 'reva.tech';
const productionEnv = 'prod';

const isRedirectStatusCode = statusCode => [301, 302].includes(statusCode);

const isLocalEnv = (cloudEnv, domain) => {
  const localDomain = 'local.env.reva.tech';
  return cloudEnv.startsWith('cucumber') || domain === localDomain;
};

const getLocalHostname = cloudEnv => {
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

  return userMap[cloudEnv] || 'cucumber-1';
};

const getCloudEnvHostname = (isProdEnv, tenantName, domain) => {
  if (isProdEnv) return `${tenantName}.${baseDomain}`;

  return `${tenantName}.${domain}`;
};

const getEnvSpecificData = message => {
  const domain = message.revaDomain;
  const tenantName = message.tenantName;
  const cloudEnv = message.cloudEnv;
  const isProdEnv = cloudEnv === productionEnv;
  const hostname = isLocalEnv(cloudEnv, domain) ? getLocalHostname(cloudEnv) : getCloudEnvHostname(isProdEnv, tenantName, domain);

  return {
    hostname,
    statsApiPath: apiPath,
    tenantName,
    cloudEnv,
    domain,
  };
};

const callSendGridStatsEndpoint = (hostname, statsApiPath, params, context, iterations) => {
  const options = {
    host: hostname,
    path: statsApiPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };

  const protocol = isLocalEnv(params.env, params.domain) ? http : https;
  if (protocol === http) {
    options.port = 3030;
  }
  console.log(`Calling: ${JSON.stringify(options, null, 2)}`);

  const body = JSON.stringify(params);
  console.log('body: ', body);

  const req = protocol.request(options, res => {
    console.log(`Result code: ${res.statusCode}`);
    if (res.statusCode === 200) {
      console.log('Successfully processed HTTP response');
      context.succeed('Stats Endpoint call succeeded');
    } else if (isRedirectStatusCode(res.statusCode)) {
      if (iterations <= 3) {
        iterations++;
        const redirectedLocation = res.headers.location || '';

        if (!redirectedLocation) {
          throw new Error(`No location to redirect found ${JSON.stringify(res.headers)}`);
        }

        const redirectUrl = url.parse(redirectedLocation);
        const { hostname: redirectHostname, path: redirectStatsApiPath } = redirectUrl;
        callSendGridStatsEndpoint(redirectHostname, redirectStatsApiPath, params, context, iterations);
      } else {
        context.succeed('Maximum number of redirects reached. Will return success');
      }
    } else {
      throw new Error(`Request failed with: ${res.statusCode} - ${res.statusMessage} - ${body}`);
    }
  });
  req.on('error', context.fail);
  req.write(body);
  req.end();
};

exports.handler = (event, context) => {
  // eslint-disable-next-line prefer-const
  let iterations = 0; // we will use this to limit the number of redirects

  console.log('Received event:', JSON.stringify(event, null, 2));
  const tenants = new Set(event.map(ev => ev.tenantId));

  tenants.forEach(tenant => {
    const firstMessage = event.find(ev => ev.tenantId === tenant);
    const domainData = getEnvSpecificData(firstMessage);

    const params = {
      tenant: domainData.tenantName,
      env: domainData.cloudEnv,
      domain: domainData.domain,
      event: event.filter(ev => ev.tenantId === tenant),
    };

    callSendGridStatsEndpoint(domainData.hostname, domainData.statsApiPath, params, context, iterations);
  });
};

exports.getEnvSpecificData = function forTesting(message) {
  return getEnvSpecificData(message);
};
