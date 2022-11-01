/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import uniq from 'lodash/uniq';
import { diff } from 'deep-diff';
import { IApplicantData, IApplicationData } from './applicant-types';
import { IDataDiff, IDictionaryHash } from '../../../common/types/base-types';

const getApplicationDataObjValues = (dataObjects: string[], applicationData: IApplicationData): IDataDiff =>
  dataObjects.reduce((acc, obj) => {
    const value = get(applicationData, obj);
    return { ...acc, [obj]: { ...value } };
  }, {});

const convertObjDiffToApplicationDataDiff = (objDiff: IDictionaryHash<any>, applicationData: IApplicationData): IDataDiff => {
  const applicationDataDiff = objDiff.reduce(
    (acc, dataDiff) => {
      const { rhs: value, path } = dataDiff;

      if (path.length > 1) {
        return { ...acc, objectDiffs: uniq([...acc.objectDiffs, path[0]]) as string[] };
      }

      const key = get(dataDiff, 'path[0]');

      return { ...acc, baseDataDiff: { ...acc.baseDataDiff, [key]: value || 'REMOVED' } as IDataDiff };
    },
    { baseDataDiff: {} as IDataDiff, objectDiffs: [] as string[] },
  );

  const objectDiffs = getApplicationDataObjValues(applicationDataDiff.objectDiffs, applicationData);

  return { ...applicationDataDiff.baseDataDiff, ...objectDiffs };
};

const diffApplicantData = (applicantDataA: IApplicantData, applicantDataB: IApplicantData): IDataDiff => {
  const objDiff = diff(applicantDataA.applicationData, applicantDataB.applicationData);
  if (!objDiff) return {} as IDataDiff;

  return convertObjDiffToApplicationDataDiff(objDiff, applicantDataB.applicationData);
};

export const getApplicantDataDiff = (applicantDataA: IApplicantData, applicantDataB?: IApplicantData): IDataDiff => {
  if (!applicantDataB) return applicantDataA.applicationData;

  return { ...diffApplicantData(applicantDataA, applicantDataB) };
};
