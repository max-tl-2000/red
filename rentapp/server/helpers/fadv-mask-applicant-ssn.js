/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { maskSSNWithX } from '../../../common/helpers/utils';

export const maskSSNInApplicants = applicantData => {
  const { applicants } = applicantData;

  const newApplicants = (applicants || []).map(applicant => {
    let { socSecNumber } = applicant;

    if (socSecNumber) {
      socSecNumber = maskSSNWithX(socSecNumber);
    }

    return {
      ...applicant,
      socSecNumber,
    };
  });

  return {
    ...applicantData,
    applicants: newApplicants,
  };
};
