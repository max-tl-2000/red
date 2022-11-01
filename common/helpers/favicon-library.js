/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const isEligibleEnv = (...envs) => value => value && envs.some(env => new RegExp(`^${env}$`, 'i').test(value));

const faviconLibraries = {
  dev: {
    isEligible: isEligibleEnv('dev'),
    color: '#DD2C00',
  },
  prod: {
    isEligible: isEligibleEnv('prod'),
    color: '#2962FF',
  },
  qa: {
    isEligible: isEligibleEnv('staging'),
    color: '#FFAB00',
  },
  staging: {
    isEligible: isEligibleEnv('staging-cust', 'staging-blue', 'staging-green'),
    color: '#00C853',
  },
  university: {
    isEligible: isEligibleEnv('university'),
    color: '#AA00FF',
  },
};

export const getFaviconLibrary = ({ cloudEnv }) => {
  const library =
    Object.keys(faviconLibraries).find(key => {
      const { isEligible } = faviconLibraries[key];
      return isEligible(cloudEnv);
    }) || 'prod';

  return {
    color: faviconLibraries[library].color,
    library,
  };
};
