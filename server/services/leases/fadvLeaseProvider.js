/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import xml2js from 'xml2js';
import uniq from 'lodash/uniq';
import loggerModule from '../../../common/helpers/logger';
import config from '../../config';
import {
  getFormSetsListRequest,
  createEnvelopeRequest,
  getCounterSignerTokenRequest,
  getSignedDocumentRequest,
  getSignerTokensRequest,
  getEnvelopeStatusRequest,
} from './fadv/requestTemplates';
import {
  saveLeaseSubmission,
  updateLeaseSubmission,
  getExternalPropertyIdForLease,
  insertOrUpdateLeaseTemplate,
  getFirstLeaseSignatureByEnvelopeId,
} from '../../dal/leaseRepo';
import { loadPartyMemberById } from '../../dal/partyRepo';

import { getServiceRequestor } from './fadv/serviceRequestor';
import LeaseProvider from './leaseProvider';
import { LeaseProviderName } from '../../../common/enums/enums';

// TODO: move this into common?
import { getFadvCredentials } from '../../../rentapp/server/helpers/base-fadv-helper';
import { runInTransaction } from '../../database/factory';

const logger = loggerModule.child({ subType: 'leaseServiceProvider' });

const parseXmlResult = (msg, explicitArray = true) => {
  const parser = new xml2js.Parser({ explicitArray, trim: true });
  return new Promise((resolve, reject) => {
    parser.parseString(msg, (error, result) => {
      if (error) {
        return reject(error);
      }

      return resolve(result);
    });
  });
};

const getRequestConfig = async (ctx, propertyId) => {
  const { userName, password, originatorId } = await getFadvCredentials(ctx);

  return {
    userName,
    password,
    originatorId,
    propertyId,
    marketingSource: propertyId,
  };
};

const handleErrorResponse = response => {
  if (response.ErrorCode) {
    throw new Error(`Fadv returned an error: ${response.ErrorCode} with the description: ${response.ErrorDescription}`);
  }
};

const normalizeDocumentSets = (content = []) => {
  const transformed = content.reduce(
    (acc, { FormSetId, FormSetName, FormSetOrder, FormList }) => {
      const forms = (FormList || {}).Form || [];

      acc.sets[FormSetId] = {
        setName: FormSetName,
        formSetOrder: FormSetOrder,
        documents: forms.map(form => form.FormLink),
      };

      acc.documents = forms.reduce((docs, { FormId, FormDisplayName, FormFieldsList, FormLink }) => {
        const fields = (FormFieldsList || {}).Field || [];
        const formFields = Array.isArray(fields) ? fields : [fields];
        const docFields = uniq(formFields.map(field => field.TabLabel.trim()));
        docs[FormLink] = {
          displayName: FormDisplayName,
          formId: FormId,
          fields: docFields.reduce((accFields, fieldId) => {
            const field = formFields.find(x => x.TabLabel.trim() === fieldId);
            accFields[fieldId] = {
              displayName: field.Name,
              tabLabel: fieldId,
              mandatory: field.TemplateRequired === 'True',
              type: field.CustomTabType,
            };
            return accFields;
          }, {}),
        };
        return docs;
      }, {});

      return acc;
    },
    { sets: {} },
  );
  return transformed;
};

export default class FadvLeaseProvider extends LeaseProvider {
  constructor() {
    super();
    this.providerName = LeaseProviderName.FADV;
  }

  getFormSetsList = async (ctx, property) => {
    const { id: propertyId, externalId } = property;
    logger.trace({ ctx, property }, 'Fetching lease forms');
    const { endpointPath } = config.fadv.contract;
    return await runInTransaction(async innerTrx => {
      const innerCtx = { ...ctx, trx: innerTrx };

      const configData = await getRequestConfig(innerCtx, externalId);

      const request = getFormSetsListRequest(configData);
      const { hostname, requestor } = await getServiceRequestor(innerCtx);

      const template = { propertyId, request, templateData: {} };
      const { id } = await insertOrUpdateLeaseTemplate(innerCtx, template);

      const res = await requestor.requestDocumentSets({
        hostname,
        endpointPath,
        request,
        propertyId: externalId,
      });

      await insertOrUpdateLeaseTemplate(innerCtx, { id, propertyId, response: res });

      const contents = (await parseXmlResult(res, false)) || {};

      const soapEnvelope = contents['soap:Envelope'] || {};
      const soapBody = soapEnvelope['soap:Body'] || {};

      const { GetFormSetsListResponse = {} } = soapBody;
      const { GetFormSetsListResult = {} } = GetFormSetsListResponse;
      const { ResidentFormApi = {} } = GetFormSetsListResult;
      const { Response = {} } = ResidentFormApi;
      const { FormSetsList = {} } = Response;
      const { FormSet: formSets } = FormSetsList;

      if (!formSets) {
        // hopefully this will produce a more informative error message than a simple TypeError message
        // since this should be catch by the surrounding try/catch block
        throw new Error('Missing FormSet prop. Probably missing lease templates or a template refresh error');
      }

      const templateData = normalizeDocumentSets(Array.isArray(formSets) ? formSets : [formSets]);
      await insertOrUpdateLeaseTemplate(innerCtx, { id, propertyId, templateData });
    }, ctx).catch(error => {
      logger.error({ ctx, error, property }, 'failed to get form sets list from FADV');
      throw new Error(error);
    });
  };

  createEnvelope = async (ctx, leaseId, recipients, host, documents, counterSignerName, globalFields = {}) => {
    try {
      const { propertyName } = await getExternalPropertyIdForLease(ctx, leaseId);
      logger.trace({ ctx, leaseId, host, counterSignerName, fadvPropertyId: propertyName, recipients, globalFields }, 'Creating lease envelope (FADV)');
      const { endpointPath } = config.fadv.contract;
      const configData = await getRequestConfig(ctx, propertyName);

      const { method: type, request } = createEnvelopeRequest(configData, documents, recipients, counterSignerName, ctx.tenantId, host);
      const leaseSubmission = {
        leaseId,
        request,
        type,
      };
      const { id } = await saveLeaseSubmission(ctx, leaseSubmission);
      const { hostname, requestor } = await getServiceRequestor(ctx);

      const response = await requestor.requestEnvelope({
        hostname,
        endpointPath,
        request,
        tenantId: ctx.tenantId,
        host,
        leaseId,
        recipients,
      });
      await updateLeaseSubmission(ctx, { id, response });

      const contents = await parseXmlResult(response);

      const result = contents['soap:Envelope']['soap:Body'][0].CreateEnvelopeResponse[0].CreateEnvelopeResult[0].ResidentFormApi[0].Response[0];

      handleErrorResponse(result);

      const parsedResult = await parseXmlResult(result._);
      await updateLeaseSubmission(ctx, { id, parsed_response: parsedResult });

      const envelopeId = parsedResult.EnvelopeStatus.EnvelopeID[0]._;
      const statuses = parsedResult.EnvelopeStatus.RecipientStatuses[0].RecipientStatus.map(rawStatus => {
        const status = rawStatus.Status[0];
        const clientUserId = rawStatus.ClientUserId[0];
        const recipientId = rawStatus.RecipientId[0];
        const userName = rawStatus.UserName[0];
        const email = rawStatus.Email[0];
        const token = `https://${host}/leases/${envelopeId}/sign/${clientUserId}`;

        return {
          clientUserId,
          recipientId,
          status,
          token,
          counterSigner: clientUserId.includes('CounterSigner'),
          userName,
          email,
        };
      });
      return { statuses, envelopeId };
    } catch (error) {
      logger.error({ ctx, error, leaseId }, 'failed to create envelope');
      throw new Error(error);
    }
  };

  getCounterSignerToken = async (ctx, leaseId, envelopeId, clientUserId, counterSignerName, counterSignerEmail, host, counterSignerId, leaseExecuted) => {
    try {
      const { propertyName } = await getExternalPropertyIdForLease(ctx, leaseId);

      logger.trace(
        { ctx, leaseId, envelopeId, clientUserId, counterSignerName, counterSignerEmail, host, counterSignerId, leaseExecuted },
        'Fetching countersigner token',
      );
      const { endpointPath } = config.fadv.contract;
      const header = await getRequestConfig(ctx, propertyName);

      const { method: type, request } = await getCounterSignerTokenRequest(ctx, {
        header,
        envelopeId,
        clientUserId,
        counterSignerName,
        counterSignerEmail,
        host,
        counterSignerId,
        leaseExecuted,
        leaseId,
      });
      const leaseSubmission = {
        leaseId,
        request,
        type,
        clientUserId,
      };
      const { id } = await saveLeaseSubmission(ctx, leaseSubmission);
      const { hostname, requestor } = await getServiceRequestor(ctx);

      const response = await requestor.requestCounterSignerToken({
        hostname,
        endpointPath,
        request,
        host,
        recipient: { fullName: counterSignerName },
      });

      await updateLeaseSubmission(ctx, { id, response, envelopeId });

      const contents = await parseXmlResult(response);
      const result = contents['soap:Envelope']['soap:Body'][0].GetCounterSignerTokenResponse[0].GetCounterSignerTokenResult[0].ResidentFormApi[0].Response[0];

      handleErrorResponse(result);

      return result.CounterToken[0];
    } catch (error) {
      logger.error({ ctx, error, leaseId, envelopeId, clientUserId }, 'failed to get the counter signer token');
      throw new Error(error);
    }
  };

  // FADV response format
  // Note: This can be removed after we have a complete working flow.
  // "DocumentPDFs": {
  //   "$": {
  //     "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
  //     "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance"
  //   },
  //   "EnvelopeId": [
  //     {
  //       "_": "ad00ea17-4f92-442b-a47c-a92d34343e5e",
  //       "$": {
  //         "xmlns": "http://www.docusign.net/API/3.0"
  //       }
  //     }
  //   ],
  //   "DocumentPDF": [
  //     {
  //       "$": {
  //         "xmlns": "http://www.docusign.net/API/3.0"
  //       },
  //       "Name": [
  //         "BECAUSE WE CARE"
  //       ],
  //       "PDFBytes": [
  //         "JVBERi0xLjQKJfv8/f4KMiAwIG9iago8PAovTW9kRGF0ZSAoRDoyMDE3MDMxNzEzMTYxOSkKL0..."
  //       ]
  //     },
  //     {
  //       "$": {
  //         "xmlns": "http://www.docusign.net/API/3.0"
  //       },
  //       "Name": [
  //         "Summary"
  //       ],
  //       "PDFBytes": [
  //         "JVBERi0xLjQKJfv8/f4KNyA..."
  //       ]
  //     }
  //   ]
  // }
  getSignedDocuments = async (ctx, leaseId, envelopeId) => {
    try {
      const { propertyName } = await getExternalPropertyIdForLease(ctx, leaseId);
      logger.trace({ ctx, leaseId, envelopeId }, 'Fetching signed documents');
      const { endpointPath } = config.fadv.contract;
      const configData = await getRequestConfig(ctx, propertyName);

      const { method: type, request } = getSignedDocumentRequest(configData, envelopeId);
      const { hostname, requestor } = await getServiceRequestor(ctx);
      const leaseSubmission = {
        leaseId,
        request,
        type,
      };
      const { id } = await saveLeaseSubmission(ctx, leaseSubmission);

      const response = await requestor.requestSignedDocument({
        hostname,
        endpointPath,
        request,
      });

      if ((response || '').includes('base64Binary')) {
        await updateLeaseSubmission(ctx, { id, response: 'signed document fetched', envelopeId });
      } else {
        await updateLeaseSubmission(ctx, { id, response: 'failed to fetch the signed document', envelopeId });
      }

      const contents = await parseXmlResult(response);

      const result = contents['soap:Envelope']['soap:Body'][0].RequestDocumentResponse[0].RequestDocumentResult[0].ResidentFormApi[0].Response[0];

      handleErrorResponse(result);

      const resultJson = await parseXmlResult(result);

      handleErrorResponse(resultJson);

      if (resultJson.base64Binary) {
        await updateLeaseSubmission(ctx, { id, parsed_response: { fetched: true }, envelopeId });
        return { pdfBytes: resultJson.base64Binary };
      }
      return { error: 'failed to fetch the document' };
    } catch (error) {
      logger.error({ ctx, error, leaseId, envelopeId }, 'failed to get the signed document');
      throw new Error(error);
    }
  };

  getLeaseConfirmationUrl = async (ctx, { leaseId, envelopeId, clientUserId, recipient, host, signerId, inOfficeSignature }) => {
    try {
      const { propertyName } = await getExternalPropertyIdForLease(ctx, leaseId);
      logger.trace({ ctx, propertyName, leaseId, envelopeId, clientUserId, host, recipient, signerId, inOfficeSignature }, 'Get completedUrl');
      const header = await getRequestConfig(ctx, propertyName);

      const { completedUrl } = await getSignerTokensRequest(ctx, {
        header,
        envelopeId,
        clientUserId,
        recipient,
        host,
        signerId,
        inOfficeSignature,
        leaseId,
      });

      return completedUrl;
    } catch (error) {
      logger.error({ error, ctx, leaseId, envelopeId, clientUserId }, 'failed to get the completedUrl');
      throw new Error(error);
    }
  };

  getSignerToken = async (ctx, leaseId, envelopeId, clientUserId, recipient, host, signerId, inOfficeSignature) => {
    try {
      const { propertyName } = await getExternalPropertyIdForLease(ctx, leaseId);
      logger.trace({ ctx, leaseId, envelopeId, clientUserId, host, signerId, inOfficeSignature }, 'Get signer tokens  lease envelope');
      const { endpointPath } = config.fadv.contract;
      const header = await getRequestConfig(ctx, propertyName);

      const { method: type, request } = await getSignerTokensRequest(ctx, {
        header,
        envelopeId,
        clientUserId,
        recipient,
        host,
        signerId,
        inOfficeSignature,
        leaseId,
      });

      const leaseSubmission = {
        leaseId,
        request,
        type,
        clientUserId,
      };
      const { id } = await saveLeaseSubmission(ctx, leaseSubmission);
      const { hostname, requestor } = await getServiceRequestor(ctx);

      const response = await requestor.requestSignerTokens({
        hostname,
        endpointPath,
        request,
        tenantId: ctx.tenantId,
        host,
        leaseId,
        recipient,
      });

      await updateLeaseSubmission(ctx, { id, response, envelopeId });

      const contents = (await parseXmlResult(response)) || {};

      const soapEnvelope = contents['soap:Envelope'] || {};
      const soapBody = soapEnvelope['soap:Body'];

      // to help debug cases where the response came but we failed to parse it
      // http://prod-logs.corp.reva.tech/app/kibana#/doc/logstash-*/logstash-2017.10.08/logs/?id=AV795hWlT8W4yj3ac1iv
      if (!soapBody) {
        const err = new Error('SOAP_BODY_NOT_FOUND');

        logger.error({ err, ctx, leaseId, envelopeId, clientUserId, response }, 'Soap body not found');
        throw err;
      }

      const jsonResponse = contents['soap:Envelope']['soap:Body'][0].GetSignerTokenResponse[0].GetSignerTokenResult[0].ResidentFormApi[0].Response[0];

      handleErrorResponse(jsonResponse);

      const token = jsonResponse.Token[0];

      return token;
    } catch (error) {
      logger.error({ error, ctx, leaseId, envelopeId, clientUserId }, 'failed to get signer tokens');
      throw new Error(error);
    }
  };

  getEnvelopeStatus = async (ctx, leaseId, envelopeId, requestorData = {}) => {
    try {
      const { propertyName } = await getExternalPropertyIdForLease(ctx, leaseId);
      logger.trace({ ctx, leaseId, envelopeId, requestorData, fadvPropertyId: propertyName }, 'Get envelope status');
      const { endpointPath } = config.fadv.contract;
      const configData = await getRequestConfig(ctx, propertyName);

      const { method: type, request } = getEnvelopeStatusRequest(configData, envelopeId);
      const leaseSubmission = {
        leaseId,
        request,
        type,
      };
      const { id } = await saveLeaseSubmission(ctx, leaseSubmission);
      const { hostname, requestor } = await getServiceRequestor(ctx);

      const signature = await getFirstLeaseSignatureByEnvelopeId(ctx, envelopeId);
      let recipient;

      if (signature) {
        const [partyMember] = await loadPartyMemberById(ctx, signature.partyMemberId);

        if (!partyMember) throw new Error(`Excpected at least one partyMember instead got ${partyMember}`);
        recipient = {
          fullName: partyMember?.fullName || signature.metadata.userName,
        };
      }

      const response = await requestor.requestEnvelopeStatus({
        hostname,
        endpointPath,
        request,
        tenantId: ctx.tenantId,
        leaseId,
        envelopeId,
        recipient,
        ...requestorData,
      });

      await updateLeaseSubmission(ctx, { id, response, envelopeId });

      const contents = await parseXmlResult(response);

      const result = contents['soap:Envelope']['soap:Body'][0].GetEnvelopeStatusResponse[0].GetEnvelopeStatusResult[0].ResidentFormApi[0].Response[0];

      handleErrorResponse(result);

      const parsedResult = await parseXmlResult(result);
      await updateLeaseSubmission(ctx, { id, parsed_response: parsedResult, envelopeId });

      handleErrorResponse(parsedResult);

      const statuses = parsedResult.EnvelopeStatus.RecipientStatuses[0].RecipientStatus.map(status => ({
        clientUserId: status.ClientUserId[0],
        recipientStatus: status.Status[0].toUpperCase(),
        userName: status.UserName[0],
        email: status.Email[0],
      }));

      return statuses;
    } catch (error) {
      logger.error({ error, ctx, leaseId, envelopeId }, 'failed to get envelope status');
      throw new Error(error);
    }
  };

  voidLease = () => {};

  syncSignatureStatuses = () => {};

  syncSignatureStatusesAfterSigningIfNeeded = () => {};

  executeLease = async (ctx, revaLeaseId, envelopeId, signerId) => {
    logger.warn({ ctx, revaLeaseId, envelopeId, signerId }, 'FADV provider was requested to execute lease, which is unsupported ');
    // FADV/DS does not have a way for us to programatically execute leases
    return false;
  };
}
