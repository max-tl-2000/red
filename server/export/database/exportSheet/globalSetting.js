/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenantData } from '../../../dal/tenantsRepo';
import { buildDataPumpFormat } from '../../helpers/export';

const buildGlobalSettings = settings => [
  {
    'communications\ndefaultEmailSignature': settings?.communications?.defaultEmailSignature,
    'communications\ncontactUsLink': settings?.communications?.contactUsLink,
    'communications\nfooterNotice': settings?.communications?.footerNotice,
    'communications\nfooterCopyright': settings?.communications?.footerCopyright,
    'preferences\nhidePropertyLifestyles': settings?.preferences?.hidePropertyLifestyles,
    'screening\noriginatorId': settings?.screening?.originatorId,
    'screening\nusername': settings?.screening?.username,
    'screening\npassword': settings?.screening?.password,
    'quote\nallowBaseRentAdjustmentFlag': settings?.quote?.allowBaseRentAdjustmentFlag,
    'communicationOverrides\ncustomerEmails': settings?.communicationOverrides?.customerEmails,
    'communicationOverrides\nemployeeEmails': settings?.communicationOverrides?.employeeEmails,
    'export\noneToManys': settings?.export?.oneToManys,
    'export\nskipSameDayLeases': settings?.export?.skipSameDayLeases,
    'features\nenableMergeParty': settings?.features?.enableMergeParty,
    'features\nduplicatePersonNotification': settings?.features?.duplicatePersonNotification,
    'features\nexportLeaseViaFtp': settings?.features?.exportLeaseViaFtp,
    'features\nenableExternalCalendarIntegration': settings?.features?.enableExternalCalendarIntegration,
    'features\nenableHoneypotTrap': settings?.features?.enableHoneypotTrap,
    'features\nenableRenewals': settings?.features?.enableRenewals,
    'features\nenableIcsAttachment': settings?.features?.enableIcsAttachment,
    'features\nenableAgentsOnlyAutomaticDashboardRefresh': settings?.features?.enableAgentsOnlyAutomaticDashboardRefresh,
    'features\nenableRingPhoneConfiguration': settings?.features?.enableRingPhoneConfiguration,
    'features\nenablePaymentPlan': settings?.features?.enablePaymentPlan,
    'features\nenableUniversity': settings?.features?.enableUniversity,
    'features\nenableCohortComms': settings?.features?.enableCohortComms,
    'features\ntransformReservedUnitStatusWithoutLease': settings?.features?.transformReservedUnitStatusWithoutLease,
    'remoteFTP\nhost': settings?.remoteFTP?.host,
    'remoteFTP\nuser': settings?.remoteFTP?.user,
    'remoteFTP\npassword': settings?.remoteFTP?.password,
    'lease\nallowCounterSigningInPast': settings?.lease?.allowCounterSigningInPast,
    'legal\nprivacyPolicyUrl': settings?.legal?.privacyPolicyUrl,
    'legal\ntermsOfServiceUrl': settings?.legal?.termsOfServiceUrl,
    'rules\ncustomPrefix': settings?.rules?.customPrefix,
  },
];

export const exportGlobalSettings = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const { settings } = await getTenantData(ctx);
  const globalSettings = buildGlobalSettings(settings);

  return buildDataPumpFormat(globalSettings, columnHeadersOrdered);
};
