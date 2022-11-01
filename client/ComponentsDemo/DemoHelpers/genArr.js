/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const genArr = amount => {
  const arr = [];
  for (let i = 1; i <= amount; i++) {
    arr.push(i);
  }
  return arr;
};

export default genArr;
