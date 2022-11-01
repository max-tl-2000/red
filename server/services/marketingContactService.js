/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import minBy from 'lodash/minBy';
import maxBy from 'lodash/maxBy';
import isEqual from 'lodash/isEqual';
import { mapSeries } from 'bluebird';
import omit from 'lodash/omit';
import loggerModule from '../../common/helpers/logger';
import {
  loadMarketingContactDataBySessionId,
  saveMarketingContactData,
  saveMarketingContactHistory,
  marketingSessionResolution as resolution,
  getLastMarketingContactHistoryEntry,
} from '../dal/marketingContactRepo';
import { getProgramReferrers, getProgramWithPropertyById, getProgramReferencesByParentProgramAndPropertyIds, loadPrograms } from '../dal/programsRepo';
import { getPropertiesByNames } from '../dal/propertyRepo';
import config from '../config';
import { formatTenantEmailDomain } from '../../common/helpers/utils';
import { getEmailIdentifierFromUuid } from '../../common/helpers/strings';
import { getProgramAfterConfigMatches } from './marketingPropertiesService';
import { runInTransaction } from '../database/factory';

const logger = loggerModule.child({ subType: 'marketingContact' });

const NO_REFERENCE_PROGRAM_FOR_PROPERTY = 'NO_REFERENCE_PROGRAM_FOR_PROPERTY';
const INVALID_PROPERTY = 'INVALID_PROPERTY';

const getSessionEmailIdentifier = ({ contact }) => contact.emailIdentifier.substring(0, contact.emailIdentifier.lastIndexOf('.'));

const getContactInformation = async (ctx, program, marketingSessionId) => {
  const domain = await formatTenantEmailDomain(ctx.tenantName, config.mail.emailDomain);
  const emailIdentifier = `${program.directEmailIdentifier}.${getEmailIdentifierFromUuid(marketingSessionId)}`;
  const email = `${emailIdentifier}@${domain}`;
  return { emailIdentifier, email, phone: program.directPhoneIdentifier };
};

const getSessionResolution = async (existingSessionData, matchedProgram, isDefaultProgramForSameProperty, newAssociatedProperties) => {
  if (!matchedProgram) {
    if (existingSessionData) return { resolution: resolution.EXISTING_SESSION_NO_PROGRAM_MATCHED };
    return { resolution: resolution.NO_EXISTING_SESSION_NO_PROGRAM_MATCHED };
  }
  if (!existingSessionData) return { resolution: resolution.NO_EXISTING_SESSION_NEW_PROGRAM_MATCHED, newSessionNeeded: true };

  if (!isEqual(newAssociatedProperties, existingSessionData.contact.associatedProperties)) {
    return { resolution: resolution.EXISTING_SESSION_ASSOCIATED_PROPERTIES_CHANGED, newSessionNeeded: true };
  }

  if (isDefaultProgramForSameProperty) return { resolution: resolution.EXISTING_SESSION_DEFAULT_PROGRAM_MATCHED };

  if (existingSessionData.programId !== matchedProgram.id) {
    return { resolution: resolution.EXISTING_SESSION_NEW_PROGRAM_MATCHED, newSessionNeeded: true };
  }

  if (
    matchedProgram.directEmailIdentifier !== getSessionEmailIdentifier(existingSessionData) ||
    matchedProgram.directPhoneIdentifier !== existingSessionData.contact.phone
  ) {
    return { resolution: resolution.EXISTING_SESSION_UPDATED_PROGRAM_MATCHED, newSessionNeeded: true };
  }

  return { resolution: resolution.EXISTING_SESSION_SAME_PROGRAM_MATCHED };
};

const getAssociatedProperties = async (ctx, program, propertyNames, marketingSessionId, dbProperties, programReferences) => {
  const associatedProperties = {};
  await mapSeries(propertyNames, async name => {
    const property = dbProperties.find(p => p.name === name);
    if (!property) {
      associatedProperties[name] = { error: '404', description: INVALID_PROPERTY };
      return;
    }
    const referenceProgram = programReferences.find(cr => cr.referenceProgramPropertyId === property.id);
    if (!referenceProgram) {
      associatedProperties[name] = { error: '404', description: NO_REFERENCE_PROGRAM_FOR_PROPERTY };
      return;
    }
    associatedProperties[name] = await getContactInformation(ctx, referenceProgram, marketingSessionId);
  });
  return associatedProperties;
};

const getProgramReferrer = async (ctx, referrerUrl, currentUrl) => {
  const allReferrers = await getProgramReferrers(ctx);
  const programReferrers = allReferrers.map(cr => ({ orderNumber: parseFloat(cr.order), ...cr }));
  const urlsMatch = r => RegExp(r.referrerUrl).test(referrerUrl) && RegExp(r.currentUrl).test(currentUrl);
  const matchingReferrers = programReferrers.filter(urlsMatch);

  return {
    fallbackReferrer: maxBy(programReferrers, 'orderNumber'),
    programReferrer: minBy(matchingReferrers, 'orderNumber'),
  };
};

const getMarketingContactResultFromSessionResolution = async (ctx, marketingSessionResolution, data) => {
  switch (marketingSessionResolution) {
    case resolution.NO_EXISTING_SESSION_NO_PROGRAM_MATCHED:
      return { error: 'PROGRAM_NOT_FOUND' };

    case resolution.EXISTING_SESSION_NO_PROGRAM_MATCHED:
    case resolution.EXISTING_SESSION_SAME_PROGRAM_MATCHED:
    case resolution.EXISTING_SESSION_DEFAULT_PROGRAM_MATCHED: {
      const existingSessionData = data.existingSessionData;
      return { marketingSessionId: data.marketingSessionId, ...existingSessionData.contact };
    }
    default: {
      let contact = await getContactInformation(ctx, data.program, data.marketingSessionId);
      if (data.properties && data.properties.length > 0) {
        const associatedProperties = await getAssociatedProperties(
          ctx,
          data.program,
          data.properties,
          data.marketingSessionId,
          data.dbProperties,
          data.programReferences,
        );
        contact = { ...contact, associatedProperties };
      }
      await saveMarketingContactData(ctx, { marketingSessionId: data.marketingSessionId, contact, programId: data.program.id });

      return { marketingSessionId: data.marketingSessionId, ...contact };
    }
  }
};

export const respondToMarketingContactRequest = async (outerCtx, requestData) => {
  logger.trace({ ctx: outerCtx, ...requestData }, 'handling marketingContact request');

  const { marketingSessionId: existingSessionId, referrerUrl, currentUrl, properties } = requestData;
  return await runInTransaction(async trx => {
    const ctx = { ...outerCtx, trx };

    const existingSessionData = existingSessionId && (await loadMarketingContactDataBySessionId(ctx, existingSessionId));

    if (existingSessionData) {
      const { requestData: previousRequestData } = await getLastMarketingContactHistoryEntry(ctx, existingSessionId);
      if (isEqual(requestData, previousRequestData)) {
        logger.trace({ ctx, requestData }, 'marketingContact request is the same as previous one, responding with the same data');
        return { marketingSessionId: existingSessionId, ...existingSessionData.contact };
      }
    }
    const { programReferrer, fallbackReferrer } = await getProgramReferrer(ctx, referrerUrl, currentUrl);

    const programWithProperty = programReferrer && (await getProgramWithPropertyById(ctx, programReferrer.programId));
    const propertyId = programWithProperty && programWithProperty.propertyId;
    let program = programWithProperty && omit(programWithProperty, ['propertyId']);

    const existingSessionProgram = (existingSessionData && (await getProgramWithPropertyById(ctx, existingSessionData.programId))) || {};
    const { propertyId: existingSessionPropertyId } = existingSessionProgram;
    const isDefaultProgramForSameProperty = programReferrer && programReferrer.isDefault && propertyId === existingSessionPropertyId;

    if (existingSessionData) {
      // if the request points to a fallback program ( eg. from a specific program property page, navigate to homepage, or \about) then keep existing session
      if (programReferrer?.programId === fallbackReferrer?.programId) {
        logger.trace(
          {
            ctx,
            requestData,
            programMatchedByReferrer: program,
          },
          'marketingContact request matched by referrer does not point to a specific property program, responding with the same data',
        );
        program = existingSessionProgram;
      } else {
        // if the matched referrer points to some specific program, then use that
        // if it points to a default referrer for that property, then try to reuse existing session info and match the new program according to that session
        // if no match is possible, then the default referrer will be used
        const shouldMatchProgramsByConfig = programReferrer?.isDefault;
        if (shouldMatchProgramsByConfig) {
          const allPrograms = await loadPrograms(ctx, { includeInactive: false });
          const programMatchedByConfig = getProgramAfterConfigMatches(allPrograms, existingSessionProgram, propertyId);
          if (programMatchedByConfig) {
            logger.trace({ ctx, programMatchedByRefferer: program, programMatchedByConfig, propertyId }, 'marketingSession new program matched by config');
            program = programMatchedByConfig;
          }
        }
      }
    }

    const dbProperties = properties ? await getPropertiesByNames(ctx, properties) : [];
    const programReferences = properties
      ? await getProgramReferencesByParentProgramAndPropertyIds(
          ctx,
          program.id,
          dbProperties.map(p => p.id),
        )
      : [];

    const newAssociatedProperties =
      existingSessionId && properties ? await getAssociatedProperties(ctx, program, properties, existingSessionId, dbProperties, programReferences) : undefined;

    const { resolution: marketingSessionResolution, newSessionNeeded } = await getSessionResolution(
      existingSessionData,
      program,
      isDefaultProgramForSameProperty,
      newAssociatedProperties,
    );
    logger.trace({ ctx, marketingSessionResolution, newSessionNeeded }, 'marketingSessionResolution');

    const marketingSessionId = newSessionNeeded ? newId() : existingSessionData && existingSessionId;

    await saveMarketingContactHistory(ctx, { marketingSessionId, requestData, marketingSessionResolution });

    return await getMarketingContactResultFromSessionResolution(ctx, marketingSessionResolution, {
      marketingSessionId,
      program,
      properties,
      dbProperties,
      programReferences,
      existingSessionData,
    });
  }, outerCtx);
};
