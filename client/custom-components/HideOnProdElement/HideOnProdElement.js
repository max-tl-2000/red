/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { window } from '../../../common/helpers/globals';

const isProd = () => {
  const host = window.location.host;

  return !host.match(/^.*env\.reva\.tech$/) || host.match(/^.*prod\.env\.reva\.tech$/);
};

const HideOnProdElement = ({ children }) => {
  if (!isProd()) {
    return children;
  }
  return null;
};

export default HideOnProdElement;
