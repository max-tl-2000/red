/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { diff } from 'deep-diff';
import get from 'lodash/get';
import { isNumber } from '../../../common/helpers/type-of';
import { maskSSNInApplicants } from './fadv-mask-applicant-ssn';

const DIFF_KIND = {
  NEW: 'N',
  DELETE: 'D',
  EDIT: 'E',
  ARRAY: 'A',
};

const DIFF_KIND_NAME = {
  NEW: 'New',
  DELETE: 'Delete',
  EDIT: 'Edit',
  ARRAY: 'Array',
};

const getDiffActionName = kind => {
  switch (kind) {
    case DIFF_KIND.NEW:
      return DIFF_KIND_NAME.NEW;
    case DIFF_KIND.DELETE:
      return DIFF_KIND_NAME.DELETE;
    case DIFF_KIND.EDIT:
      return DIFF_KIND_NAME.EDIT;
    default:
      return '';
  }
};

const getDiffObject = (object, action, prop, newVal, oldVal = '') => ({ object, action: getDiffActionName(action), prop, newVal, oldVal });
const getDiffProperty = (diffPath = []) => (diffPath ? diffPath.slice(-1).pop() : '');
const getDiffObjectValue = obj => {
  const isApplicantDiffObject = applicantObj => applicantObj && applicantObj.firstName && applicantObj.lastName;
  const isApplicantAddressObject = addressObj => addressObj && addressObj.unparsedAddress;

  let diffObjValue = '';
  if (isApplicantDiffObject(obj)) {
    diffObjValue = `${obj.firstName} ${obj.lastName}`;
  } else if (isApplicantAddressObject(obj)) {
    diffObjValue = `${obj.unparsedAddress}`;
  }

  return diffObjValue;
};

const getObjSummaryFromPath = (objPath = [], obj = {}) => {
  objPath = objPath.map(e => (isNumber(e) ? `[${e}]` : e));
  objPath.pop();

  const objChangePath = objPath.join('.');
  const { firstName, lastName, unparsedAddress, rent } = get(obj, objChangePath);
  let res = 'N/A';
  if (firstName && lastName) {
    res = `${firstName} ${lastName}`;
  } else if (unparsedAddress) {
    res = unparsedAddress;
  } else if (rent) {
    res = objChangePath;
  }

  return res;
};

const diffScreeningRequestData = (submissionRequestDataA, submissionRequestDataB) => {
  const res = diff(submissionRequestDataA, submissionRequestDataB) || [];
  return res.map(entry => {
    if (entry.kind === DIFF_KIND.ARRAY) {
      return getDiffObject(entry.path[0], entry.item.kind, getDiffProperty(entry.path), getDiffObjectValue(entry.item.rhs), getDiffObjectValue(entry.item.lhs));
    }

    return getDiffObject(getObjSummaryFromPath(entry.path, submissionRequestDataB), entry.kind, getDiffProperty(entry.path), entry.rhs, entry.lhs);
  });
};

export const getScreeningRequestDataDiff = (submissionRequestDataA = {}, submissionRequestDataB = {}) => {
  const applicantDataA = submissionRequestDataA.applicantData || {};
  const applicantDataB = submissionRequestDataB.applicantData || {};

  submissionRequestDataA = { ...submissionRequestDataA, applicantData: maskSSNInApplicants(applicantDataA) };
  submissionRequestDataB = { ...submissionRequestDataB, applicantData: maskSSNInApplicants(applicantDataB) };

  return { diff: diffScreeningRequestData(submissionRequestDataA, submissionRequestDataB) };
};
