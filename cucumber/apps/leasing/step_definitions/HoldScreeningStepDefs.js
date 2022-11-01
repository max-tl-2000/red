/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import PartyDetailsPhaseTwo from '../test-pages/partyDetailsPhaseTwo';

module.exports = function PartyDetailsStepDefs() {
  const partyDetailsPhaseTwo = new PartyDetailsPhaseTwo();

  this.Then(/^Validate if the hold screening banner was shown$/, () => partyDetailsPhaseTwo.checkHoldScreeningBannerExists());

  this.Then(/^Check if "([^"]*)" hold type shows in the banner$/, holdType => partyDetailsPhaseTwo.checkBannerContainsHoldType(holdType));
};
