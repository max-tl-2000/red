/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { VIEW_MODEL_TYPES } from './enums';
import { formatPersonLegalName } from './helpers/person';
import { getPartyByIdQuery } from '../../dal/partyRepo';
import { getActiveLeaseWorkflowDataByPartyId } from '../../dal/activeLeaseWorkflowRepo';
import config from '../../config';
import { formatTenantEmailDomain } from '../../../common/helpers/utils';
import { formatMoney, Currency } from '../../../common/money-formatter';

export const viewModelType = VIEW_MODEL_TYPES.OBJECT;

export const getContextQuery = (ctx, { partyId }) => getPartyByIdQuery(ctx, partyId).toString();

export const prerequisites = party => {
  const { applications, ...rest } = party || {};

  const residingMembersNames = (applications || []).map(({ applicationData }) => formatPersonLegalName(applicationData));

  return {
    ...rest,
    residingMembersNames,
  };
};

const formatAmount = amount => formatMoney({ amount, currency: Currency.USD.code }).result;

const formatChargeAmount = charge => {
  const { quantity, amount } = charge;
  if (quantity < 2) return formatAmount(amount);

  const price = amount / quantity;
  const formattedPrice = formatAmount(price);
  return `${quantity} x ${formattedPrice}`;
};

export const tokensMapping = {
  'residingMembers.legalName': ({ residingMembersNames }) => residingMembersNames.join(', '),
  'residingMembers.count': ({ residingMembersNames }) => residingMembersNames.length,
  activeLease: async (party, { ctx }) => {
    if (!party.seedPartyId) return { recurringCharges: [] };

    const { recurringCharges = [] } = (await getActiveLeaseWorkflowDataByPartyId(ctx, party.seedPartyId)) || {};
    return {
      recurringCharges: recurringCharges.map(charge => ({
        ...charge,
        amount: formatChargeAmount(charge),
        totalAmount: formatAmount(charge.amount),
      })),
    };
  },
  inReplyToEmail: ({ emailIdentifier }, { ctx }) => {
    const tenantName = ctx.tenantName;
    const emailDomain = formatTenantEmailDomain(tenantName, config.mail.emailDomain);

    return emailDomain ? `${emailIdentifier}@${emailDomain}` : null;
  },
};
