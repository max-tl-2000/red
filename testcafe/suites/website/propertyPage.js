/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { getWebsiteURL, clickOnElement } from '../../helpers/helpers';
import Homepage from '../../pages/website/homepage';
import PropertyPage from '../../pages/website/propertyPage';
import { PropertyNames, ProgramNames } from '../../helpers/websiteConstants';
import { setHooks } from '../../helpers/hooks';

setHooks(fixture('Property Page'), {
  skipDatabaseRestore: true,
  beforeEach: async t => {
    await t.navigateTo(getWebsiteURL('/'));
  },
});

test('TEST-1365:Verify that when the user searches for a property from main search, the system retrieves all required info', async t => {
  const homepage = new Homepage(t);
  const propertyPage = new PropertyPage(t);

  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.SierraNorte);
  await homepage.clickOnResult(PropertyNames.SierraNorte);

  await propertyPage.isPropertyPageDisplayed();

  await propertyPage.checkCarouselButtons(t);

  await propertyPage.checkSearchBox();

  await propertyPage.checkFindApartmentButton();

  await propertyPage.checkPropertyInfos(t);

  await propertyPage.checkMapButton();

  await propertyPage.checkPhoneNumber(ProgramNames.SierraNorteWebsite);

  await propertyPage.checkContactUsButton();

  await clickOnElement(t, { selector: $(propertyPage.PropertyInfoSelectors.ContactUsActiveButton) });

  await propertyPage.checkContactUsDialog(ProgramNames.SierraNorteWebsite);

  await propertyPage.clickOutsideDialog();
  // await propertyPage.checkDialogNotPresent();

  await propertyPage.checkShareButton();
  await clickOnElement(t, { selector: propertyPage.PropertyInfoSelectors.ShareButton });
  await propertyPage.checkShareDialog();
  await propertyPage.clickOutsideDialog();
  // await propertyPage.checkDialogNotPresent();

  await propertyPage.checkPropertyTabs(propertyPage.selectors.PropertyTabs);

  await clickOnElement(t, { selector: await $(propertyPage.selectors.PropertyTabs).withText('PROPERTY DESCRIPTION') });

  await propertyPage.checkPropertyTabsNavBar();

  await propertyPage.checkPropertyDescriptionSection();

  await propertyPage.checkHighlightsSection();

  await propertyPage.checkFloorplanSection();

  await propertyPage.checkMapSection();
});

test('TEST-1373: Verify that properties suggested are shown correctly according to the one searched in Property page', async t => {
  const propertyPage = new PropertyPage(t);
  const homepage = new Homepage(t);
  await homepage.isDisplayed();
  await homepage.typeIntoSearch(PropertyNames.SierraNorte);
  await homepage.resultExists(PropertyNames.SierraNorte);
  await homepage.clickOnResult(PropertyNames.SierraNorte);

  await propertyPage.otherCommunitiesDisplayed();
  const relatedCardsSierraNorte = []; // no related properties expected

  await propertyPage.checkRelatedPropertyCards(relatedCardsSierraNorte);

  await propertyPage.clearSearch();

  await propertyPage.typeIntoSearch(PropertyNames.Serenity);
  await homepage.clickOnResult(PropertyNames.Serenity);

  await propertyPage.otherCommunitiesDisplayed();

  const relatedCardsSerenity = [
    {
      title: PropertyNames.Acme,
      expectedDetails: ['3711 19th Ave', 'San Francisco, CA 94940'],
      campaignPhoneNumber: '650-468-0505',
      program: ProgramNames.AcmeWebsite,
    },
    {
      title: PropertyNames.Cove,
      expectedDetails: ['1 bed – 3 beds', '595 – 2,610 sq ft', 'Starting $3,249', '50 Barbaree Way', 'Tiburon, CA 94920'],
      campaignPhoneNumber: '650-468-0503',
      program: ProgramNames.CoveWebsite,
    },
    {
      title: PropertyNames.Parkmerced,
      expectedDetails: ['2 beds – 4 beds', '250 – 2,195 sq ft', 'Starting $1,810.8', '3711 19th Ave', 'San Francisco, CA 94132'],
      campaignPhoneNumber: '225-555-0182',
      program: ProgramNames.ParkmercedWebsite,
    },
  ];
  await propertyPage.checkRelatedPropertyCards(relatedCardsSerenity);
});
