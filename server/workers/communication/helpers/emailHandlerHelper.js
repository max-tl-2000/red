/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getMailDomain, getFooterLinks } from '../../../helpers/mails';
import { getPartyDataForInvite } from '../../../helpers/party';
import { DALTypes } from '../../../../common/enums/DALTypes';
import config from '../../../config';
import { getSmallAvatar, getPropertyImage, init as initCloudinaryHelpers } from '../../../../common/helpers/cloudinary';
import { formatPropertyAssetUrl } from '../../../helpers/assets-helper';

export const getDataForInvite = async (ctx, partyId, propertyId) => {
  const { tenant, leasingAgent, team, party, partyMembers, property, program } = await getPartyDataForInvite(ctx, { partyId, propertyId });

  initCloudinaryHelpers({
    cloudName: config.cloudinaryCloudName,
    tenantName: ctx.tenantName,
    isPublicEnv: config.isPublicEnv,
    isDevelopment: config.isDevelopment,
    domainSuffix: config.domainSuffix,
    reverseProxyUrl: config.reverseProxy.url,
    rpImageToken: config.rpImageToken,
    cloudEnv: config.cloudEnv,
  });
  leasingAgent.avatarUrl = getSmallAvatar(leasingAgent.avatarUrl, leasingAgent.fullName);
  const propertyAssetUrl = await formatPropertyAssetUrl({ ...ctx, tenantName: tenant.name }, propertyId, { permaLink: true, from: 'template' });
  const propertyFormatted = {
    propertyName: property.displayName,
    propertyAddress: `${property.address.addressLine1}, ${property.address.city}, ${property.address.state}`,
    imageUrl: getPropertyImage(propertyAssetUrl, { width: 1200 }),
  };

  const emailConfiguration = {
    domain: getMailDomain({ tenantName: tenant.name }),
    subject: config.mail.rentalApplicationLinkMailSubject,
    footerLinks: getFooterLinks(ctx, tenant.settings.communications),
  };
  const partyMembersFormatted = partyMembers.reduce((acc, partyMember) => {
    acc[partyMember.id] = {
      preferredName: partyMember.preferredName,
      fullName: partyMember.fullName,
      memberId: partyMember.id,
      personId: partyMember.personId,
      isGuarantor: partyMember.memberType === DALTypes.MemberType.GUARANTOR,
      guaranteedBy: partyMember.guaranteedBy,
      guarantorFor: partyMembers
        .filter(pm => pm.guaranteedBy === partyMember.id)
        .map(pm => ({
          fullName: pm.fullName,
          preferredName: pm.preferredName,
        })),
      otherApplicants: partyMembers
        .filter(pm => pm.memberType !== DALTypes.MemberType.GUARANTOR && pm.id !== partyMember.id)
        .map(pm => ({
          fullName: pm.fullName || pm.contactInfo.defaultEmail,
          preferredName: pm.preferredName || pm.contactInfo.defaultEmail,
        })),
    };
    return acc;
  }, {});

  return {
    tenant,
    emailConfiguration,
    party,
    leasingAgent,
    program,
    partyMembers: partyMembersFormatted,
    property: propertyFormatted,
    team,
  };
};
