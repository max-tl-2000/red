/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { getWebsiteURL, expectVisible, clickOnElement } from '../../helpers/helpers';
import Homepage from '../../pages/website/homepage';
import PropertyPage from '../../pages/website/propertyPage';
import { PropertyNames } from '../../helpers/websiteConstants';
import { setHooks } from '../../helpers/hooks';

setHooks(fixture('Search results'), {
  skipDatabaseRestore: true,
  beforeEach: async t => {
    await t.navigateTo(getWebsiteURL('/'));
  },
});

test('TEST-2031:Navigate through westegg', async t => {
  const propertyPage = new PropertyPage(t);
  const homepage = new Homepage(t);
  await homepage.isDisplayed();

  // Search by community
  await homepage.typeIntoSearch(PropertyNames.Parkmerced);
  await homepage.clickOnResult('Parkmerced Apartments, Boston, Massachusetts');

  await propertyPage.isPropertyPageDisplayed();

  // check westegg chatbot
  await clickOnElement(t, { selector: propertyPage.westEggSelectors.westEggChatBotButton });

  // check FIND YOUR NEW HOME section
  await clickOnElement(t, { selector: $(propertyPage.westEggSelectors.westEggChatBotButton).withText('FIND YOUR NEW HOME') });
  await expectVisible(t, { selector: propertyPage.selectors.InventoryDate });
  await clickOnElement(t, { selector: $(propertyPage.westEggSelectors.westEggChatBotButton).withText('BACK TO THE BEGINNING') });

  // check CONTACT US section
  await clickOnElement(t, { selector: $(propertyPage.westEggSelectors.westEggChatBotButton).withText('CONTACT US') });
  await expectVisible(t, { selector: propertyPage.westEggSelectors.westEggInputField });
  await expectVisible(t, { selector: $(propertyPage.westEggSelectors.westEggChatBotButton).withText('CONTINUE') });
  await clickOnElement(t, { selector: $(propertyPage.westEggSelectors.westEggChatBotButton).withText('BACK TO THE BEGINNING') });

  // check SCHEDULE TOUR section
  await clickOnElement(t, { selector: $(propertyPage.westEggSelectors.westEggChatBotButton).withText('SCHEDULE A TOUR') });
  await expectVisible(t, { selector: propertyPage.DialogDateSelectors.DateSelectorBody });
  await clickOnElement(t, { selector: $(propertyPage.westEggSelectors.westEggChatBotButton).withText('BACK TO THE BEGINNING') });

  // check THE COMMUNITY section
  await clickOnElement(t, { selector: $(propertyPage.westEggSelectors.westEggChatBotButton).withText('THE COMMUNITY') });
  await propertyPage.checkWestEggButtons(propertyPage.westEggSelectors.westEggChatBotButtons);
  await clickOnElement(t, { selector: $(propertyPage.westEggSelectors.westEggChatBotButton).withText('BACK TO THE BEGINNING') });
});
