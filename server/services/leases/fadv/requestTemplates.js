/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import escape from 'lodash/escape';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { createJWTToken } from '../../../../common/server/jwt-helpers';
import { sendUrltoShortener } from '../../urlShortener';
import trim from '../../../../common/helpers/trim';

const createEnvelope = (method, body) => `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
    <soapenv:Header/>
    <soapenv:Body>
        <tem:${method}>
            <tem:xml>
                <![CDATA[${body}]]>
            </tem:xml>
        </tem:${method}>
    </soapenv:Body>
    </soapenv:Envelope>`;

const getRequestHeader = (method, propertyId, marketingSource, originatorId, userName, password) => `
   <PropertyID>
        <Identification IDType="Property ID">
            <IDValue>${propertyId}</IDValue>
        </Identification>
        <MarketingName>${escape(marketingSource)}</MarketingName>
    </PropertyID>
    <RequestType>${method}</RequestType>
    <OriginatorID>${originatorId}</OriginatorID>
    <UserName>${escape(userName)}</UserName>
    <UserPassword>${escape(password)}</UserPassword>`;

const getBody = (requestHeader, requestBody = '') => `
    <ResidentFormApi xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="ResidentFormApi1_0.xsd">
    <Request>
         ${requestHeader}
         ${requestBody}
    </Request>
    </ResidentFormApi>`;

export const getFormSetsListRequest = ({ propertyId, marketingSource, originatorId, userName, password }) => {
  const method = DALTypes.FADVCallMethod.GET_FORMSETS_LIST;
  const header = getRequestHeader(method, propertyId, marketingSource, originatorId, userName, password);
  const requestBody = '<BypassCache>false</BypassCache>';
  const body = getBody(header, requestBody);
  return createEnvelope(method, body);
};

const serializeFormFields = fields => {
  const formFields = Object.keys(fields || {}).map(fieldId => {
    const { tabLabel, value, formattedValue } = fields[fieldId];
    return value ? `<Field><TabLabel>${tabLabel}</TabLabel><value>${escape(trim(formattedValue || value))}</value></Field>` : '';
  });
  return formFields.join('');
};

const serializeForms = documents => {
  const forms = Object.keys(documents)
    .sort((a, b) => documents[a].sortOrder - documents[b].sortOrder)
    .map(docId => {
      const { formId, displayName, fields } = documents[docId];
      const formFields = Object.keys(fields || {}).length > 0 ? `<FormFieldsList>${serializeFormFields(fields)}</FormFieldsList>` : '';
      return `<Form>
                <FormId>${formId}</FormId>
                <FormDisplayName>${displayName}</FormDisplayName>
                <FormLink>${docId}</FormLink>
                ${formFields}
            </Form>`;
    });
  return forms.join('');
};

const serializeRecipients = recipients => {
  const nodes = recipients.map((recipient, index) => {
    const order = index + 1;
    return `<Recipient>
        <ID>${recipient.id}</ID>
        <SignerName>${escape(trim(recipient.fullName))}</SignerName>
        <Email>${recipient.contactInfo.defaultEmail}</Email>
        <Type>InPerson</Type>
        <DeliveryMethod>Email</DeliveryMethod>
        <RoutingOrder>${order}</RoutingOrder>
        <RoleName>${recipient.memberType === DALTypes.MemberType.RESIDENT ? 'Resident' : 'Guarantor'}${order}</RoleName>
     </Recipient>`;
  });
  return nodes.join('');
};

export const createEnvelopeRequest = (
  { propertyId, marketingSource, originatorId, userName, password },
  documents,
  recipients,
  counterSignerName,
  tenantId,
  host,
) => {
  const method = DALTypes.FADVCallMethod.CREATE_ENVELOPE;
  const header = getRequestHeader(method, propertyId, marketingSource, originatorId, userName, password);
  const requestBody = `
                ${serializeForms(documents)}
                <Recipients>${serializeRecipients(recipients)}</Recipients>
                <EnvelopeInfo>
                    <Subject>Reva Leasing</Subject>
                    <EmailBlurb>Reva Leasing</EmailBlurb>
                    <SigningLocation>InPerson</SigningLocation>
                    <Url>https://${host}/signatureConfirmation</Url>
                    <CounterSignerUserName>${escape(trim(counterSignerName))}</CounterSignerUserName>
                    <TenatId>${tenantId}</TenatId>
                    <DeclinedUrl>https://${host}/signatureConfirmation</DeclinedUrl>
                </EnvelopeInfo>`;

  const body = getBody(header, requestBody);
  return { method, request: createEnvelope(method, body) };
};

const IN_OFFICE_SIGNATURE = DALTypes.FADVCallMethod.IN_OFFICE;
export const getCounterSignerTokenRequest = async (
  ctx,
  {
    header: { propertyId, marketingSource, originatorId, userName, password },
    envelopeId,
    clientUserId,
    counterSignerName,
    counterSignerEmail,
    host,
    counterSignerId,
    leaseExecuted,
    leaseId,
  },
) => {
  const getUrlToken = action =>
    createJWTToken(
      {
        leaseId,
        envelopeId,
        clientUserId,
        action,
        signerId: counterSignerId,
        signatureType: IN_OFFICE_SIGNATURE,
        view: leaseExecuted,
      },
      { expiresIn: '7d' },
    );

  const method = DALTypes.FADVCallMethod.GET_COUNTERSIGNER_TOKEN;
  const header = getRequestHeader(method, propertyId, marketingSource, originatorId, userName, password);

  const url = `https://${host}/signatureConfirmation/${getUrlToken(DALTypes.LeaseStatusEvent.COMPLETED)}`;
  const declinedUrl = `https://${host}/signatureConfirmation/${getUrlToken(DALTypes.LeaseStatusEvent.DECLINED)}`;

  const [shortenedUrl, shortenedDeclinedUrl] = await sendUrltoShortener(ctx, [url, declinedUrl]);

  const counterSigner = leaseExecuted
    ? ''
    : `<CounterSignerUserName>${trim(counterSignerName)}</CounterSignerUserName>
       <CounterSignerEmail>${trim(counterSignerEmail)}</CounterSignerEmail>`;
  const requestBody = `<EnvelopeID>${envelopeId}</EnvelopeID>
                       <Url>${shortenedUrl}</Url>
                       <DeclinedUrl>${shortenedDeclinedUrl}</DeclinedUrl>
                       ${counterSigner}`;
  const body = getBody(header, requestBody);
  return { method, request: createEnvelope(method, body), completedUrl: shortenedUrl };
};

export const getSignerTokensRequest = async (
  ctx,
  {
    header: { propertyId, marketingSource, originatorId, userName, password },
    envelopeId,
    clientUserId,
    recipient,
    host,
    signerId,
    inOfficeSignature,
    leaseId,
  },
) => {
  const method = DALTypes.FADVCallMethod.GET_SIGNER_TOKEN;
  const header = getRequestHeader(method, propertyId, marketingSource, originatorId, userName, password);
  const signatureType = inOfficeSignature ? IN_OFFICE_SIGNATURE : 'email';

  const getUrlToken = action =>
    createJWTToken(
      {
        leaseId,
        envelopeId,
        clientUserId,
        action,
        signerId,
        signatureType,
      },
      { expiresIn: '7d' },
    );
  const url = `https://${host}/signatureConfirmation/${getUrlToken(DALTypes.LeaseStatusEvent.COMPLETED)}`;
  const declinedUrl = `https://${host}/signatureConfirmation/${getUrlToken(DALTypes.LeaseStatusEvent.DECLINED)}`;

  const [shortenedUrl, shortenedDeclinedUrl] = await sendUrltoShortener(ctx, [url, declinedUrl]);
  const requestBody = `<EnvelopeID>${envelopeId}</EnvelopeID>
                       <Url>${shortenedUrl}</Url>
                       <DeclinedUrl>${shortenedDeclinedUrl}</DeclinedUrl>
                       <Recipients>
                          <Recipient>
                            <SignerName>${escape(trim(recipient.fullName))}</SignerName>
                            <Email>${escape(trim(recipient.email))}</Email>
                          </Recipient>
                       </Recipients>`;
  const body = getBody(header, requestBody);
  return { method, request: createEnvelope(method, body), completedUrl: shortenedUrl };
};

export const getSignedDocumentRequest = ({ propertyId, marketingSource, originatorId, userName, password }, envelopeId) => {
  const method = DALTypes.FADVCallMethod.REQUEST_DOCUMENT;
  const header = getRequestHeader(method, propertyId, marketingSource, originatorId, userName, password);
  const requestBody = `<EnvelopeID>${envelopeId}</EnvelopeID>
                       <IsMerge>true</IsMerge>`;
  const body = getBody(header, requestBody);
  return { method, request: createEnvelope(method, body) };
};

export const getEnvelopeStatusRequest = ({ propertyId, marketingSource, originatorId, userName, password }, envelopeId) => {
  const method = DALTypes.FADVCallMethod.GET_ENVELOPE_STATUS;
  const header = getRequestHeader(method, propertyId, marketingSource, originatorId, userName, password);
  const requestBody = `<EnvelopeID>${envelopeId}</EnvelopeID>`;
  const body = getBody(header, requestBody);
  return { method, request: createEnvelope(method, body) };
};
