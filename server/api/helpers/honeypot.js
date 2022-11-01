/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import nullish from '../../../common/helpers/nullish';
import { getTenantSettings } from '../../services/tenantService';

export const EXPECTED_HONEYPOT_NAME = 'Mary-Jane Smith';

const fieldsPopulatedCorrectly = (userName, name) => userName === '' && name === EXPECTED_HONEYPOT_NAME;

const shouldCheckHoneypotTrap = (enableHoneypotTrap, userName, name) => {
  if (!enableHoneypotTrap) return false;
  if (nullish(userName) && nullish(name)) return false;
  return true;
};

export const honeypotTrapCheck = async (req, { _userName_, _name_ }, logger) => {
  const tenantSettings = await getTenantSettings(req);
  const { enableHoneypotTrap } = tenantSettings?.features || {};

  if (shouldCheckHoneypotTrap(enableHoneypotTrap, _userName_, _name_) && !fieldsPopulatedCorrectly(_userName_, _name_)) {
    logger && logger.warn({ ctx: req, ...req.body, enableHoneypotTrap }, 'honeypotTrap - possible bot');
    return true;
  }
  return false;
};
