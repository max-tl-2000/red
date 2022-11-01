/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { mapSeries } from 'bluebird';
import {
  clearTextElement,
  expectVisible,
  expectNotPresent,
  expectNotVisible,
  getPhoneNumberByProgramName,
  formatPhoneNumber,
  clickOnElement,
} from '../../helpers/helpers';

export default class SearchResultsPage {
  constructor(t) {
    this.t = t;
    this.selectors = {
      NavBar: '.contentWrapper .headerBlock',
      SearchBox: '#searchBoxFilter input',
      SearchFilterContainer: '#searchFiltersBody',
      Map: '#revaMap',
      Footer: '#footer',
      CheckedFilter: '#searchFiltersBody div[data-checked="true"]',
      PropertyCard: '#searchResultList div[id^="property_"]',
      Floorplan: '#searchFiltersBody [data-id="selectionGroup-Floorplan type"]',
      Lifestyle: '#searchFiltersBody [data-id="selectionGroup-Lifestyles"]',
      FiltersCategoryTitles: "#searchFiltersBody div[data-id^='selectionGroup-'] p",
      SingleBedroomCheckBox: '#searchFiltersBody [data-id="selectionGroup-Floorplan type"] [data-label="1 Bedroom"]',
      ThreeBedroomsCheckBox: '#searchFiltersBody [data-id="selectionGroup-Floorplan type"] [data-label="3 Bedrooms"]',
      ActiveNightLifeCheckBox: '#searchFiltersBody [data-id="selectionGroup-Lifestyles"] [data-label="Active Night Life"]',
      BikeFriendlyCheckBox: '#searchFiltersBody [data-id="selectionGroup-Lifestyles"] [data-label="Bike Friendly"]',
      PriceFilterInputField: '#searchFiltersBody [data-id="selectionGroup-Price"] [data-component="textbox"] input',
      InfoBoxCard: '.infoBox',
      AcmeMapFlag: '#revaMap div[title="Acme Apartments"] img',
      CollapsedMapFlag: '.cluster img',
      NoMatchWarningMessage: '#searchResultList p',
      NumberOfFoundApartments: '#searchResultList [data-component="Caption"]',
      OtherCommunitiesTitle: '#searchResultList [data-component="Title"]',
      PriceFilterInput: '[data-id="price-filter"]  div input',
      MobileSectionTabs: '#searchResultList [data-component="selection-group"]',
      MobileListTab: '[data-component="selection-group"] [data-value="LIST"]',
      MobileMapTab: '[data-component="selection-group"] [data-value="MAP"]',
      MobileFiltersButton: '#btnFilters',
      MobileFiltersOverlay: '#filtersOverlay',
    };

    this.mapFlagSrcValuesLast16 = {
      InitialFlagSrc: 'ZmYiLz48L3N2Zz4=',
      HoveredFlagSrc: 'OSIvPjwvc3ZnPg==',
      ColapsedFlagsSrc: 'ZmYiLz48L3N2Zz4=',
    };

    this.phoneNumbersByProgram = {};
  }

  hoverElement = async selector => await this.t.hover(await $(selector));

  clickOnZoomOutBotton = async () => await clickOnElement(this.t, { selector: await $('.gm-control-active[title="Zoom out"]'), offsetY: 1 });

  checkMapFlagSrcLast16 = async (selector, srcValue) => await this.t.expect((await $(selector).getAttribute('src')).slice(-16)).eql(srcValue);

  getPropertyCardByTitle = async title => await $(this.selectors.PropertyCard).withText(title);

  isSearchResultsPageDisplayed = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.NavBar });
    await expectVisible(t, { selector: this.selectors.SearchBox });
    await expectVisible(t, { selector: this.selectors.SearchFilterContainer });
    await expectVisible(t, { selector: this.selectors.Map });
    await expectVisible(t, { selector: this.selectors.PropertyCard });
    await expectVisible(t, { selector: this.selectors.Footer });
  };

  areMapFlagsVisible = async flagTitles =>
    await mapSeries(flagTitles, async title => await expectVisible(this.t, { selector: `#revaMap div[title="${title}"]`, boundTestRun: true }));

  isSearchResultsPageDisplayedMobile = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.NavBar });
    await expectVisible(t, { selector: this.selectors.SearchBox });
    await expectVisible(t, { selector: this.selectors.MobileSectionTabs });
    await expectVisible(t, { selector: this.selectors.PropertyCard });
    await expectVisible(t, { selector: this.selectors.Footer });
  };

  arePropertyCardsVisible = async propertyNames =>
    await mapSeries(propertyNames, async element => await expectVisible(this.t, { selector: this.selectors.PropertyCard, text: element, boundTestRun: true }));

  checkSearchResultsPage = async (mapFlagNames, propertyCardTitles) => {
    const { t } = this;
    await this.isSearchResultsPageDisplayed();

    await this.arePropertyCardsVisible(propertyCardTitles);

    // Check that none of the filter checkboxes are checked
    await expectNotPresent(t, { selector: this.selectors.CheckedFilter });

    await this.areMapFlagsVisible(mapFlagNames);
  };

  getPhoneNumberByProgram = async program => {
    if (!this.phoneNumbersByProgram[program]) {
      this.phoneNumbersByProgram[program] = await getPhoneNumberByProgramName(program);
    }
    return this.phoneNumbersByProgram[program];
  };

  checkPropertyCards = async expectedCards => {
    const { t: tst } = this;
    await mapSeries(expectedCards, async cardData => {
      const propertyCard = await $(this.selectors.PropertyCard).withText(cardData.title).with({ boundTestRun: tst });
      await tst.expect(propertyCard.visible).eql(true);

      const titleNode = await propertyCard.child('.clamp-lines').child('div').withText(cardData.title).with({ boundTestRun: tst });
      await tst.expect(titleNode.exists).ok();

      const cardInfoSection = await propertyCard.child('div').withAttribute('data-id', 'propertyCard').with({ boundTestRun: tst });

      await tst.expect(cardInfoSection.visible).eql(true);

      await mapSeries(
        cardData.expectedDetails,
        async text => await tst.expect((await cardInfoSection.child('div').child('p').withText(text).with({ boundTestRun: tst })).visible).eql(true),
      );

      if (cardData.program) {
        const phoneNumber = await this.getPhoneNumberByProgram(cardData.program);
        const { propertyPageFormat } = formatPhoneNumber(phoneNumber);

        await tst
          .expect((await cardInfoSection.child('div').child('div').child('p').withText(propertyPageFormat).with({ boundTestRun: tst })).visible)
          .eql(true);
      }
    });
  };

  checkFiltersCategoriesTitles = async (tst, filtersCategoriesTitles) =>
    await mapSeries(filtersCategoriesTitles, async element => {
      await expectVisible(tst, { selector: this.selectors.FiltersCategoryTitles, text: element, boundTestRun: true });
    });

  checkFloorplanFiltersVisible = async (tst, floorplanFilters) =>
    await mapSeries(floorplanFilters, async element => {
      await expectVisible(tst, { selector: `${this.selectors.Floorplan} [data-label="${element}"]`, text: element, boundTestRun: true });
    });

  checkLifestylesFiltersVisible = async (tst, filtersList) =>
    await mapSeries(filtersList, async element => {
      const capitalizeElement = element
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      await expectVisible(tst, {
        selector: `${this.selectors.Lifestyle} [data-label="${capitalizeElement}"]`,
        text: capitalizeElement,
        boundTestRun: true,
      });
    });

  checkPriceFilterVisible = async () => await expectVisible(this.t, { selector: this.selectors.PriceFilterInputField });

  typeIntoPriceBox = async text => {
    const { t } = this;
    await t.typeText($(this.selectors.PriceFilterInputField), text, { paste: true });
    await t.wait(2000);
  };

  clearPriceFilter = async () => await this.typeIntoPriceBox(' ');

  clearRegionFromSearch = async () => await clearTextElement(this.t, { selector: this.selectors.SearchBox });

  checkPropertyCardsArePresent = async (tst, expectedCardTitles) => {
    await mapSeries(expectedCardTitles, async title => {
      const propertyCard = await $(this.selectors.PropertyCard).withText(title).with({ boundTestRun: tst });
      await tst.expect(propertyCard.exists).ok();
    });
  };

  checkPropertyCardsAreNotPresent = async (tst, notExpectedCardTitles) => {
    await mapSeries(notExpectedCardTitles, async title => {
      const propertyCard = await $(this.selectors.PropertyCard).withText(title).with({ boundTestRun: tst });
      await tst.expect(propertyCard.exists).notOk();
    });
  };

  checkMapInfoBoxDetails = async propertyName => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.InfoBoxCard, text: propertyName });
    await expectVisible(t, { selector: this.selectors.InfoBoxCard, text: '3711 19th Ave, San Francisco' });
  };

  checkNoMatchFoundState = async propertyNames => {
    const { t } = this;
    await expectVisible(t, {
      selector: this.selectors.NoMatchWarningMessage,
      text: "We couldn't find any exact matches. Try changing your filters to find a matching property.",
    });
    await expectVisible(t, {
      selector: this.selectors.OtherCommunitiesTitle,
      text: 'Other communities in the area',
    });
    await this.checkPropertyCardsArePresent(t, propertyNames);
  };

  checkMatchFoundState = async () => {
    const { t } = this;
    await expectNotVisible(t, {
      selector: this.selectors.NoMatchWarningMessage,
      text: "We couldn't find any exact matches. Try changing your filters to find a matching property.",
    });
    await expectVisible(t, {
      selector: this.selectors.NumberOfFoundApartments,
      text: 'Found 4 apartment communities',
    });
  };

  checkMobileSectionTabs = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.MobileSectionTabs });
    await expectVisible(t, { selector: this.selectors.MobileListTab });
    await expectVisible(t, { selector: this.selectors.MobileMapTab });
    await expectVisible(t, { selector: $(this.selectors.MobileListTab).withText('List') });
    await expectVisible(t, { selector: $(this.selectors.MobileMapTab).withText('Map') });
  };

  checkMobileMapTab = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.MobileMapTab });
    await expectNotVisible(t, { selector: this.selectors.PropertyCard });
  };

  checkMobileListTab = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.MobileListTab });
    await expectVisible(t, { selector: this.selectors.PropertyCard });
  };

  checkMobileFiltersOverlay = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.MobileFiltersButton });
    await clickOnElement(t, { selector: this.selectors.MobileFiltersButton });
    await expectVisible(t, { selector: this.selectors.MobileFiltersOverlay });
  };

  pickFilterForNoResults = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: $('[data-value="Active night life"]') });
    await clickOnElement(t, { selector: $('#btnClose') });
  };
}
