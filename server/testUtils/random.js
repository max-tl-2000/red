/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const letters = 'abcdefghijklmnopqrstuvwxyz';

const integer = (min = 0, max = 10) => Math.floor(Math.random() * (max - min + 1) + min);

const string = length => {
  const output = [];
  for (let i = 0; i <= length; i++) {
    output.push(letters.charAt(integer(0, letters.length)));
  }
  return output.join('');
};

const name = (length = 10) => {
  const s = string(length);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const email = (domain = `${string(5)}.com`) => `${string(20)}@${domain}`;

export { integer, string, name, email };
