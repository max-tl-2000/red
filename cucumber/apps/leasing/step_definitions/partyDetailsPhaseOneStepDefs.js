/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

'use strict';
import { tenant } from 'support/hooks';
import PartyDetailsPhaseOne from '../test-pages/partyDetailsPhaseOne';
import PartyDetailsCommon from '../test-pages/partyDetailsCommon';
import { formatPhoneToDisplay } from '../../../../server/helpers/phoneUtils';

module.exports = function personDetailsPageStepDefs() {
  const partyDetailsPhaseOne = new PartyDetailsPhaseOne();
  const partyDetailsCommon = new PartyDetailsCommon();

  this.Then(/^The party details page in phase one should open$/, async () => await partyDetailsPhaseOne.checkForPartyDetailsPhaseOnePage());

  this.Then(/^Tasks section should contain a system created task with "([^"]*)" as task owner$/, arg1 => partyDetailsCommon.checkTaskOwner(arg1));

  this.Then(/^The nav bar should contain "([^"]*)"$/, async arg1 => await partyDetailsPhaseOne.navBarContains(arg1));

  this.Then(
    /^The stepper should contain in the first step the phone number and "([^"]*)"$/,
    async arg1 => await partyDetailsPhaseOne.personFirstStepCheck(arg1, formatPhoneToDisplay(tenant.metadata.plivoGuestPhoneNumber)),
  );

  this.Then(/^The stepper should contain in second step:$/, table => partyDetailsPhaseOne.personSecondStepCheck(table));

  this.Then(/^Check "([^"]*)" to the combined monthly income question$/, async arg1 => await partyDetailsPhaseOne.checkCombinedIncomeQuestion(arg1));

  this.Then(/^Select "([^"]*)" from move in time dropdown$/, async arg1 => await partyDetailsPhaseOne.selectPreferredMoveInTime(arg1));

  this.Then(/^User edits contact information$/, async () => await partyDetailsPhaseOne.editContactInformation());
  this.Then(/^Select "([^"]*)" from lease type dropdown$/, async arg1 => await partyDetailsPhaseOne.selectLeaseType(arg1));

  this.Then(/^Closes edit contact dialog$/, async () => await partyDetailsPhaseOne.closeEditContactInfoDialog());
  this.Then(/^Select "([^"]*)" from first contact channel dropdown$/, async arg1 => await partyDetailsPhaseOne.selectFirstContactChannel(arg1));
};
