/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Promise from 'bluebird';
import fs from 'fs';
import path from 'path';
import newUUID from 'uuid/v4';
import { DALTypes } from '../../../../common/enums/DALTypes';

const readFile = Promise.promisify(fs.readFile);

export const requestDocumentSets = async ({ propertyId }) => {
  const filename = propertyId === '132664' ? 'serenityFormSets.xml' : 'coveFormSets.xml';
  const text = await readFile(path.join(__dirname, 'fakeResponses', filename), 'utf8');
  return text;
};

export const requestEnvelope = async ({ recipients }) => {
  const text = await readFile(path.join(__dirname, 'fakeResponses', 'createEnvelopeResponse.xml'), 'utf8');

  const envelopeId = newUUID();
  const statuses = recipients.reduce((acc, recipient, index) => {
    const order = index + 1;
    const clientUserId = `${recipient.memberType === DALTypes.MemberType.RESIDENT ? 'Resident' : 'Guarantor'}${order}`;

    const status = `&lt;RecipientStatus&gt;
                  &lt;Type&gt;Signer&lt;/Type&gt;
                  &lt;Email&gt;inofficesigner@docusign.com&lt;/Email&gt;
                  &lt;UserName&gt;${recipient.fullName}&lt;/UserName&gt;
                  &lt;Sent&gt;2017-03-16T03:00:43.613&lt;/Sent&gt;
                  &lt;DeclineReason xsi:nil="true"/&gt;
                  &lt;Status&gt;Sent&lt;/Status&gt;
                  &lt;ClientUserId&gt;${clientUserId}&lt;/ClientUserId&gt;
                  &lt;AccountStatus&gt;Active&lt;/AccountStatus&gt;
                  &lt;RecipientId&gt;${newUUID()}&lt;/RecipientId&gt;
                &lt;/RecipientStatus&gt;`;

    acc.push(status);
    return acc;
  }, []);
  const envelopeTokens = statuses.map(() => `<Token>${newUUID()}</Token>`);
  const envelopeStatuses = statuses.join(' ');

  const response = text
    .replace('RECIPIENTS_STATUSES_PLACEHOLDER', envelopeStatuses)
    .replace('COUNTERSIGNER_RECIPIENT_ID_PLACEHOLDER', newUUID())
    .replace('ENVELOPE_ID_PLACEHOLDER', envelopeId)
    .replace('TOKENS_PLACEHOLDER', envelopeTokens);
  return response;
};

let wasLeaseCountersigned = false;
export const setWasLeaseCountersigned = wasCountersigned => (wasLeaseCountersigned = wasCountersigned);

const injectDataIntoSignatureResponse = (request, responseFile, verb, recipient) => {
  const urlRegex = RegExp('Url>(.*?)<\\/Url>', 'g');
  const urlRegexMatches = urlRegex.exec(request);
  const signatureCompletedCallbackURL = urlRegexMatches[1];

  const fakeResponse = responseFile
    .replace('{signatureCompletedCallbackURL}', signatureCompletedCallbackURL)
    .replace('{signerName}', recipient.fullName)
    .replace('{email}', recipient.email || '')
    .replace('{verb}', verb);
  return fakeResponse;
};

export const requestCounterSignerToken = async ({ request, recipient }) => {
  const responseFilename = wasLeaseCountersigned ? 'getCounterSignerResponseAfterSign.xml' : 'getCounterSignerResponse.xml';
  const responseFile = await readFile(path.join(__dirname, 'fakeResponses', responseFilename), 'utf8');

  if (!wasLeaseCountersigned) {
    return injectDataIntoSignatureResponse(request, responseFile, 'countersign', recipient);
  }

  return responseFile;
};

export const requestSignerTokens = async ({ request, recipient }) => {
  const fakeResponseFile = await readFile(path.join(__dirname, 'fakeResponses', 'getSignerTokens.xml'), 'utf8');
  return injectDataIntoSignatureResponse(request, fakeResponseFile, 'sign', recipient);
};

export const requestSignedDocument = async () => {
  const text = await readFile(path.join(__dirname, 'fakeResponses', 'getSignedLeaseDocumentsResponse.xml'), 'utf8');
  return text;
};

export const requestEnvelopeStatus = async ({
  clientUserId = 'Resident1',
  recipientStatus = 'SENT',
  recipient,
  email = 'countersigner@docusign.com',
  userName = 'Alice Altimes1',
}) => {
  const recipientFullName = recipient && recipient.fullName ? recipient.fullName : '';
  const text = await readFile(path.join(__dirname, 'fakeResponses', 'getEnvelopeStatusResponse.xml'), 'utf8');
  let fakeResponse;

  if (clientUserId.startsWith('Resident') || clientUserId.startsWith('Guarantor')) {
    fakeResponse = text
      .replace('{recipient_status}', recipientStatus)
      .replace('{client_user_id}', clientUserId)
      .replace('RandomName', recipientFullName)
      .replace('{COUNTERSIGNER_NAME}', userName)
      .replace('{COUNTERSIGNER_STATUS}', 'SENT')
      .replace('{COUNTERSIGNER_EMAIL}', email);
  } else {
    fakeResponse = text
      .replace('{recipient_status}', 'SIGNED')
      .replace('{client_user_id}', 'Resident1')
      .replace('RandomName', recipientFullName)
      .replace('{COUNTERSIGNER_NAME}', userName)
      .replace('{COUNTERSIGNER_STATUS}', recipientStatus)
      .replace('{COUNTERSIGNER_EMAIL}', email);
  }

  return fakeResponse;
};
