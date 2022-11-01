/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniq from 'lodash/uniq';
import apiClient from '../apiClient';

const checkIfEmailMatches = (emailMatcher, signatureEmail) => {
  const match = signatureEmail && signatureEmail.match(emailMatcher);
  if (match && match.length) return true;

  return false;
};

const checkIfNameMatches = (residents, nameToSearchFor) => {
  if (residents.length) {
    const residentNames = residents.join('');
    return residentNames.toLowerCase().includes(nameToSearchFor.toLowerCase());
  }

  return false;
};

export const getDataToCleanup = async (ctx, propertyId, emailMatcher, nameToSearchFor) => {
  const dataToDelete = [];

  const data = await apiClient.getAllESignatureStatuses(ctx, propertyId);
  Object.keys(data || {}).forEach(leaseId => {
    const signatures = data[leaseId];
    Object.keys(signatures || {}).forEach(signId => {
      const signature = signatures[signId];
      if (signature.signers.some(sig => checkIfEmailMatches(emailMatcher, sig.email))) {
        dataToDelete.push({
          signature,
          leaseId,
          signId,
        });
      }
    });
  });

  let leaseIds = [];
  if (nameToSearchFor) {
    const allLeases = await apiClient.getAllLeases(ctx, propertyId);
    const leasesToDeleteByName = allLeases.filter(lease => checkIfNameMatches(lease.residents, nameToSearchFor));
    leaseIds = leasesToDeleteByName.map(lease => lease.leaseId);
  }

  return {
    dataToDelete,
    signaturesToDelete: uniq(dataToDelete.map(signature => signature.signId).filter(x => x)),
    leasesToDelete: uniq(
      dataToDelete
        .map(lease => lease.leaseId)
        .concat(leaseIds)
        .filter(x => x),
    ),
  };
};
