/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sortBy from 'lodash/sortBy';
import { toMoment } from '../../common/helpers/moment-utils';

export const hasPhonesOutsideTheApp = user => {
  if (!user) return false;
  const { ringPhones = [], sipEndpoints = [] } = user;
  return ringPhones.length || sipEndpoints.filter(endpoint => !endpoint.isUsedInApp).length;
};

export const getPreferredCallSource = user => {
  const source = user.metadata.preferredCallSource;
  if (!source) return { source: 'app' };
  if (user.ringPhones.includes(source)) return { source, sourceName: source };

  const sip = user.sipEndpoints.find(e => e.username === source);
  if (sip) {
    return { source, isSipUsername: true, sourceName: sip.alias };
  }
  return { source: 'app' };
};

export const getAssociatedParty = (parties, partyId) => {
  if (partyId) {
    const party = parties.find(p => p.id === partyId);
    if (party) return party;
  }

  const sortedParties = sortBy(parties, p => -toMoment(p.created_at).utc());
  const openParties = sortedParties.filter(p => !p.endDate);

  if (openParties.length) return openParties[0];

  return sortedParties[0];
};

export const shouldDisplayViewPartyLink = (pagePath, associatedParty, comm) => {
  if (!pagePath || !associatedParty) return false;

  if (comm && comm.persons.some(p => pagePath.includes(p))) return false;
  if (pagePath.includes(associatedParty.id)) return false;

  return true;
};
