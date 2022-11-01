/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { clearTextElement, expectVisible, clickOnElement, expectNotVisible } from '../../helpers/helpers';

export default class Homepage {
  constructor(t) {
    this.t = t;
    this.selectors = {
      SearchBox: '#searchBox input',
      SearchSuggestion: '[data-component="list-item"]',
      Navigation: '#navigation',
      NavigationItem: '#navigation li',
      NavigationItemLink: '#navigation li a',
      Container: '.contentWrapperHome',
      MobileNavMenuButton: '#btnHamburguer',
      MobileNavMenuItemsButton: '#hamburguerOverlay .navigationLinks a',
      LogoButton: '#logo',
      ViewMarketsOverlayButton: '#searchSection #viewAllMarkets',
      HideMarketsOverlayButton: '[data-cmd="closeOverlay"]',
      OverlayListContainer: '#marketsNavigation',
      OverlayListItem: '[data-part="nav-container"] a',
    };
  }

  clearSearch = async () => await clearTextElement(this.t, { selector: this.selectors.SearchBox });

  typeIntoSearch = async searchTerm => {
    const { t } = this;
    await t.typeText($(this.selectors.SearchBox), searchTerm);
  };

  getSearchResultElement = async text => await $(this.selectors.SearchSuggestion).withText(text);

  resultExists = async text => await this.t.expect((await this.getSearchResultElement(text)).visible).eql(true);

  resultExistsBound = async text => {
    const { t: tst } = this;
    return await tst.expect($(this.selectors.SearchSuggestion).withText(text).with({ boundTestRun: tst }).visible).eql(true);
  };

  clickOnResult = async text => await clickOnElement(this.t, { selector: await this.getSearchResultElement(text) });

  clickOnNavigationStateItemByText = async text => await clickOnElement(this.t, { selector: (await $(`${this.selectors.Navigation} a`)).withText(text) });

  clickOnNavigationItemByText = async text => await clickOnElement(this.t, { selector: await $(this.selectors.NavigationItemLink).withText(text) });

  isDisplayed = async () => await expectVisible(this.t, { selector: this.selectors.Container });

  checkMobileNavMenuItems = async () => {
    const { t } = this;
    await expectVisible(t, { selector: $(this.selectors.MobileNavMenuItemsButton).withText('Home') });
    await expectVisible(t, { selector: $(this.selectors.MobileNavMenuItemsButton).withText('Residents') });
    await expectVisible(t, { selector: $(this.selectors.MobileNavMenuItemsButton).withText('About') });
  };

  navigateThroughLogo = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.LogoButton });
  };

  checkMarketsOverlay = async () => {
    const { t } = this;
    await expectVisible(t, { selector: $(this.selectors.ViewMarketsOverlayButton).withText('VIEW ALL MARKETS') });
    await clickOnElement(t, { selector: this.selectors.ViewMarketsOverlayButton });
    await expectVisible(t, { selector: $(this.selectors.HideMarketsOverlayButton).withText('HIDE ALL MARKETS') });
    await expectVisible(t, { selector: this.selectors.OverlayListContainer });
    await clickOnElement(t, { selector: this.selectors.HideMarketsOverlayButton });
    await expectNotVisible(t, { selector: this.selectors.OverlayListContainer });
  };

  navigateThroughMarketsOverlay = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.ViewMarketsOverlayButton });
    await clickOnElement(t, { selector: $(this.selectors.OverlayListItem).withText('Bay Area') });
  };
}
