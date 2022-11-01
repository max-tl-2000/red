/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const downloadDocument = async url => {
  const a = document.createElement('a');
  a.href = url;
  a.download = true;
  a.style.display = 'none';
  document.body.appendChild(a);

  // TODO: consider removing the hidden element after download starts
  a.click();
};
