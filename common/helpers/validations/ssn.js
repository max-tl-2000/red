/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { SOCIAL_SECURITY_NUMBER, STRICT_SOCIAL_SECURITY_NUMBER } from '../../regex';

export const isSSNValid = (ssn, strictValidation) => {
  /* Blacklist from https://www.ssa.gov/history/ssn/misused.html
                    http://www.fraudpractice.com/FL-SSN.html
  */
  const blacklist = ['078051120', '219099999', '457555462'];

  if (!ssn) return true;
  // regex using https://www.ssa.gov/employer/randomization.html
  if (strictValidation && !STRICT_SOCIAL_SECURITY_NUMBER.test(ssn)) {
    return false;
  }

  if (!SOCIAL_SECURITY_NUMBER.test(ssn)) return false;
  return blacklist.indexOf(ssn.replace(/\D/g, '')) === -1;
};

export const isItin = itin => itin && itin[0] === '9';
