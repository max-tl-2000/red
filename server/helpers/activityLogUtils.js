/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import nullish from '../../common/helpers/nullish';

const getLeaseChangeDisplayName = (leaseChange, lease) => {
  let result;

  switch (leaseChange.kind) {
    case 'N':
      result = (leaseChange.rhs && leaseChange.rhs.displayName) || leaseChange.path[leaseChange.path.length - 1];
      break;
    case 'D':
      result = (leaseChange.lhs && leaseChange.lhs.displayName) || leaseChange.path[leaseChange.path.length - 1];
      break;
    case 'E':
      result = leaseChange.path.length > 1 ? lease.baselineData.publishedLease[leaseChange.path[0]][leaseChange.path[1]].displayName : leaseChange.path[0];
      break;
    default:
  }
  return result;
};

const getLeaseChangedValue = (leaseChange, value) => {
  let result;
  let editedValueName;

  switch (leaseChange.kind) {
    case 'N':
      result = omit(leaseChange.rhs, ['name', 'displayName', 'quoteSectionName']);
      break;
    case 'D':
      result = omit(leaseChange.lhs, ['name', 'displayName', 'quoteSectionName']);
      break;
    case 'E':
      editedValueName = leaseChange.path[leaseChange.path.length - 1];
      result = editedValueName ? { [editedValueName]: value } : '';
      break;
    default:
  }

  return result;
};

export const getFormattedLeaseChange = (c, lease) => {
  const actionType = c.kind;
  const category = c.path[0];
  const displayName = getLeaseChangeDisplayName(c, lease);

  const oldValue = !nullish(c.lhs) && getLeaseChangedValue(c, c.lhs);
  const newValue = !nullish(c.rhs) && getLeaseChangedValue(c, c.rhs);

  return { actionType, category, displayName, oldValue, newValue };
};

export const getFormattedDocumentChange = (c, lease) => {
  const actionType = c.kind;
  const category = 'documents';
  const displayName = lease.leaseData.documents[c.path[0]].displayName;
  const fieldName = (lease.leaseData.documents[c.path[0]].fields[c.path[2]] || {}).displayName;

  const oldValue = !nullish(c.lhs) && { [fieldName]: c.lhs };
  const newValue = !nullish(c.rhs) && { [fieldName]: c.rhs };

  return { actionType, category, displayName, oldValue, newValue };
};

export const getFormattedGlobalFieldsChange = c => {
  const actionType = c.kind;
  const category = 'documents';

  const updatedField = c.path[1];
  if (updatedField !== 'value') {
    return undefined;
  }

  const fieldName = c.path[0];
  const oldValue = c.lhs;
  const newValue = c.rhs;
  return { actionType, category, displayName: fieldName, oldValue, newValue };
};
