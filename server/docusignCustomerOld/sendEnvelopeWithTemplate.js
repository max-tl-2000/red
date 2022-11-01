/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/**
 * Reva sendEnvelopeWithTemplate.js based on:
 * @file
 * Example 009: Send envelope using a template
 * @author DocuSign
 */

import loggerInstance from '../../common/helpers/logger';

const logger = loggerInstance.child({ subType: 'sendEnvelopeWithTemplate' });

const docusign = require('docusign-esign');
const dsConfig = require('./dsConfig').config;
const dsJwtAuth = require('./dsJwtAuth');
const eg009UseTemplate = exports;
const minimumBufferMin = 3;
/**
 * Send deferral contract envelope
 */
exports.createLeaseDeferralEnvelope = async (ctx, args) => {
  // Step 1. Check the token
  // At this point we should have a good token. But we
  // double-check here to enable a better UX to the user.
  await dsJwtAuth.checkToken(minimumBufferMin);

  // Step 2. Call the worker method
  const envelopeArgs = {
    templateId: dsConfig.templateId,
    ...args,
    counterSignerDescriptor: args.countersignerAgent,
  };
  const templateArgs = {
    accessToken: dsJwtAuth.accessToken,
    basePath: dsJwtAuth.basePath,
    envelopeArgs,
    accountId: dsJwtAuth.accountId,
  };
  logger.trace({ ctx, templateArgs }, 'createLeaseDeferralEnvelope');

  let results = null;
  try {
    results = await eg009UseTemplate.worker(templateArgs);
  } catch (err) {
    logger.error({ ctx, err }, 'createLeaseDeferralEnvelope Error');
    throw err;
  }
  if (results) {
    const ret = { envelopeId: results.envelopeId };
    return ret;
  }

  return null;
};

/**
 * Creates envelope from the template
 * @function
 * @param {Object} args object
 * @returns {Envelope} An envelope definition
 * @private
 */
function makeEnvelope(args) {
  // Data for this method
  // args.signerEmail
  // args.signerName
  // args.ccEmail
  // args.ccName
  // args.templateId

  // The envelope has two recipients.
  // recipient 1 - signer
  // recipient 2 - cc

  // create the envelope definition
  const env = new docusign.EnvelopeDefinition();
  env.templateId = args.templateId;

  const tabData = {
    tabs: {
      textTabs: [],
    },
  };
  Object.entries(args).forEach(([tabLabel, value]) => tabData.tabs.textTabs.push({ tabLabel: tabLabel.toUpperCase(), value }));

  const residents = [
    {
      name: args.residentName01,
      email: args.residentName01Email,
      roleName: 'Resident1',
    },
    {
      name: args.residentName02,
      email: args.residentName02Email,
      roleName: 'Resident2',
    },
    {
      name: args.residentName03,
      email: args.residentName03Email,
      roleName: 'Resident3',
    },
    {
      name: args.residentName04,
      email: args.residentName04Email,
      roleName: 'Resident4',
    },
    {
      name: args.residentName05,
      email: args.residentName05Email,
      roleName: 'Resident5',
    },
    {
      name: args.residentName06,
      email: args.residentName06Email,
      roleName: 'Resident6',
    },
  ].filter(r => r.name && r.email);

  const counterSigner = {
    name: args.countersignerAgent,
    email: args.countersignerAgentEmail,
    roleName: 'CounterSigner1',
  };

  // Create template role elements to connect the signer and cc recipients
  // to the template
  // We're setting the parameters via the object creation
  const signers = [...residents, counterSigner].map(signer => ({
    ...docusign.TemplateRole.constructFromObject(signer),
    ...tabData,
  }));

  // Add the TemplateRole objects to the envelope object
  env.templateRoles = signers;
  env.status = 'sent'; // We want the envelope to be sent

  return env;
}

/**
 * This function does the work of creating the envelope
 * @param {object} args object
 */
// ***DS.snippet.0.start
eg009UseTemplate.worker = async args => {
  // Data for this method
  // args.basePath
  // args.accessToken
  // args.accountId

  const dsApiClient = new docusign.ApiClient();
  dsApiClient.setBasePath(dsJwtAuth.basePath);
  dsApiClient.addDefaultHeader('Authorization', `Bearer ${args.accessToken}`);
  const envelopesApi = new docusign.EnvelopesApi(dsApiClient);

  // Step 1. Make the envelope request body
  const envelope = makeEnvelope(args.envelopeArgs);

  // Step 2. call Envelopes::create API method
  // Exceptions will be caught by the calling function
  const results = await envelopesApi.createEnvelope(args.accountId, { envelopeDefinition: envelope });

  return results;
};
