/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import diff from 'deep-diff';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../../common/enums/activityLogTypes';
import { getQuoteById } from '../quotes';
import { logEntity } from '../activityLogService';
import { getShortFormatRentableItem } from '../../helpers/inventory';
import { getFormattedLeaseChange, getFormattedDocumentChange, getFormattedGlobalFieldsChange } from '../../helpers/activityLogUtils';
import { DALTypes } from '../../../common/enums/DALTypes';

import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'leaseActivityLogService' });

export const addLeaseActivityLog = async (ctx, lease, activityType, personName = null, originalLease = null, signMethod = null) => {
  const { quoteId } = lease;
  const quote = await getQuoteById(ctx, quoteId);
  const { inventoryId } = quote;

  let leaseTerm;
  if (lease.baselineData.quote) {
    leaseTerm = lease.baselineData.quote.leaseTerm;
  } else {
    const selectedLeaseTerm = quote.leaseTerms.find(l => l.id === lease.leaseTermId);
    leaseTerm = selectedLeaseTerm && `${selectedLeaseTerm.termLength} ${selectedLeaseTerm.period}s`;
  }

  try {
    const baseActivityLogDetails = {
      leaseId: lease.id,
      partyId: lease.partyId,
      leasedUnit: await getShortFormatRentableItem(ctx, inventoryId),
      leaseTerm,
      createdByType: ctx.authUser ? DALTypes.CreatedByType.USER : DALTypes.CreatedByType.SYSTEM,
    };

    let specificLogDetails;
    let skipLog = false;
    switch (activityType) {
      case ACTIVITY_TYPES.NEW:
        specificLogDetails = {
          quote: quoteId,
        };
        break;
      case ACTIVITY_TYPES.EMAIL:
        specificLogDetails = {
          to: personName,
        };
        break;
      case ACTIVITY_TYPES.EXECUTE:
        specificLogDetails = {
          by: personName,
        };
        break;
      case ACTIVITY_TYPES.SIGN:
      case ACTIVITY_TYPES.COUNTERSIGN:
        specificLogDetails = {
          by: personName,
          signMethod,
        };
        break;
      case ACTIVITY_TYPES.IN_OFFICE_SIGNATURE:
        specificLogDetails = {
          for: personName,
        };
        break;
      case ACTIVITY_TYPES.UPDATE: {
        const leaseData = lease && lease.leaseData.documents;
        const originalLeaseData = originalLease && originalLease.leaseData.documents;
        if (!leaseData || !originalLeaseData) {
          skipLog = true;
          break;
        }

        const leaseChanges = diff(originalLease.baselineData.publishedLease, lease.baselineData.publishedLease);

        if (leaseChanges) {
          const leaseFormattedChanges = leaseChanges.map(c => getFormattedLeaseChange(c, lease));
          const documentsChanges = diff(originalLease.leaseData.documents, lease.leaseData.documents);
          const globalFieldsChanges = lease.leaseData.globalFields ? diff(originalLease.leaseData.globalFields, lease.leaseData.globalFields) : null;
          if (!documentsChanges && !globalFieldsChanges) {
            throw new Error(`Expected documentsChanges in leaseChanges but got ${documentsChanges} and ${globalFieldsChanges}`);
          }
          const documentsFormattedChanges = !globalFieldsChanges ? documentsChanges?.map(c => getFormattedDocumentChange(c, lease)) || [] : [];
          const globalFieldsFormattedChanges = globalFieldsChanges?.map(c => getFormattedGlobalFieldsChange(c)).filter(v => v) || [];
          specificLogDetails = {
            leaseEdits: [...leaseFormattedChanges, ...documentsFormattedChanges, ...globalFieldsFormattedChanges],
          };
        } else skipLog = true;
        break;
      }
      default:
        break;
    }

    !skipLog && (await logEntity(ctx, { entity: { ...baseActivityLogDetails, ...specificLogDetails }, activityType, component: COMPONENT_TYPES.LEASE }));
  } catch (error) {
    logger.error({ ctx, error, leaseId: lease.id, partyId: lease.partyId }, 'saving activity log failed');
  }
};
