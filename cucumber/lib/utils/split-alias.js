/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

function randomize(Max) {
  return Math.floor(Math.random() * Max);
}

export default function splitAlias(email, Random) {
  // If email address uses an alias
  let alias = email;

  const isAlias = alias.indexOf('+');

  if (isAlias > 0 && alias !== '') {
    // User wants to use an alias
    // Split string
    const address = alias.split(/[@]+/).shift();
    const domain = alias.split(/[@]+/).pop(1);

    // alias must contain a random value
    alias = `${address}${randomize(Random)}@${domain}`;
  }

  return alias;
}
