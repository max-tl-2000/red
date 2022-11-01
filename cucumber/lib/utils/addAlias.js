/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const addAlias = (email, alias) => {
  if (email.indexOf('@') === -1) {
    const parts = email.split('+').filter(part => !!part.trim());
    if (parts.length > 1) {
      // has at least 2 parts
      return `${parts[0]}+${parts[1]}_${alias}`;
    }
    return `${parts[0]}+${alias}`;
  }
  const symbol = email.split('@')[0].indexOf('+') > -1 ? '_' : '+';

  return email.replace(/@/, `${symbol}${alias}@`);
};
