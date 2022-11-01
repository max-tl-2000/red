/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { mapSeries } from 'bluebird';
import {
  expectVisible,
  expectNotPresent,
  expectNotVisible,
  clearTextElement,
  clickOnElement,
  getPhoneNumberByProgramName,
  formatPhoneNumber,
} from '../../helpers/helpers';
import { lifestylesFilters } from '../../helpers/websiteConstants';
import SearchResultsPage from './searchResultsPage';

export default class PropertyPage {
  constructor(t) {
    this.t = t;
    this.selectors = {
      ContactUsButton: '.links_section  [data-label="contact us"]',
      MobileContactUsButton: '[data-label="contact us"] [data-id="button-Contact us"]',
      MoveInDateInput: '#inventorySelector input',
      InventoryDate: '#inventorySelector [data-id="inventoryDateSelector"]',
      LayoutGroupContainer: '#inventorySelector [data-id="marketingLayoutGroups"]',
      LayoutContainer: '#inventorySelector [data-id="marketingLayoutGroups"] div div div',
      LayoutButton: '#inventorySelector [data-id="marketingLayoutGroups"] button',
      LayoutImage: '#inventorySelector [data-id="layoutImageContainer"]',
      TextOnHover: '#inventorySelector [data-id="testimonialText"]',
      UnitsContainer: '#inventorySelector [data-id="unitsContainer"]',
      MarketingLayout: '[data-id="unitsContainer"] div',
      MarketingLayoutTitleContainer: '[data-id="marketingLayoutTitleContainer"]',
      MarketingLayoutUnitInfo: '[data-id="marketingLayoutUnitInfo"] span',
      MarketingLayoutSqft: '[data-id="marketingLayoutUnitInfo"] [data-id="marketingLayoutSqft"]',
      MarketingLayoutNumBeds: '[data-id="marketingLayoutUnitInfo"] [data-id="marketingLayoutNumBedrooms"]',
      MarketingLayoutNumBaths: '[data-id="marketingLayoutUnitInfo"] [data-id="marketingLayoutNumBathrooms"]',
      MarketingLayoutUnitDescription: '[data-id="marketingLayoutUnitDescription"]',
      MarketingLayoutUnitContainer: '[data-id="marketingLayoutUnitBlock"]',
      MarketingLayoutImageContainer: '[data-id="marketingLayoutImageContainer"]',
      MarketingLayoutCardsContainer: '[data-id="marketingLayoutCardsContainer"]',
      MarketingLayoutUnitCard: '[data-id="marketingLayoutUnitCard"]',
      MarketingLayoutUnitCardState: '[data-id="marketingLayoutUnitCard"] p',
      MarketingLayoutApartmentPriceContainer: '[data-id="apartmentPriceContainer"]',
      MarketingLayoutApartmentNumberContainer: '[data-id="apartmentNumberContainer"]',
      MarketingLayoutUnitCardAmenitiesList: '[data-id="marketingLayoutUnitCard"] [data-id="amenitiesList"]',
      NavBar: '#header',
      Carousel: '#carousel',
      PropertyInfoSection: '#propertyDetails',
      PropertyTabsSection: '#revaPropertyTabs',
      PropertyDescriptionSection: '.propertyDescription',
      PropertyDescriptionGallerySection: '.rw_gallery_block',
      PropertyHighLightsSection: '.communityHighlights',
      PropertyFloorplansSection: '.findYourApartment',
      PropertyMapSection: '.exploreSection',
      SugestedPropertiesSection: '.otherCommunities',
      Footer: '#footer',
      ScrollerContainer: '.scrollerContainer',
      PropertyTabs: '#revaPropertyTabs [data-part="tabText"]',
      MobilePropertyTabs: '#revaPropertyTabs [data-component="button"]',
      PropertyTabsNavBar: '#header #revaPropertyTabsOnHead',
      BackToTopButton: '#header #backToTopProperty',
      PropertyTabsNavBarTitles: '#revaPropertyTabsOnHead [data-part="tabText"]',
      PropertyDescriptionTitle: '.propertyDescription #sectionPropertyDescription',
      DescriptionOfTheProperty: '.propertyDescription .rw_pd_container_block',
      DescriptionHighlights: '.propertyDescription [data-id="descriptionHighlights"]',
      PropertyHighlightsTitle: '.communityHighlights [data-reva-section="Highlights"]',
      PropertyHighlightsSecondaryTitles: '#lifeStyles .rw_communityHighlights h3',
      LifestyleTitles: '#lifeStyles [data-component="life-style-icon"]',
      HighlightsMentionText: '.rw_communityHighlights .rw_ch_smallPrint',
      FloorplanSectionTitle: '.findYourApartment h2',
      LayoutSectionContainer: '.findYourApartment #inventorySelector',
      MapSectionTitle: '.exploreSection h2',
      MapContainer: '.exploreSection #revaPropertyMap',
      SierraMapFlag: '#revaPropertyMap div[title="Sierra Norte"] img',
      MapInfoBox: '.infoBox',
      RelatedProperties: '#relatedProperties div',
      RelatedPropertyCard: '#relatedProperties div[id^="property_"]',
      OtherCommunities: '.otherCommunities #relatedProperties',
    };

    this.CarouselSelectors = {
      PreviouosArrow: '#carousel .control-prev',
      NextArrow: '#carousel .control-next',
      PicturesButton: '#carousel [data-id="button-Pictures"]',
      VideoButton: '#carousel [data-id="button-Video"]',
      Tour3DButton: '#carousel [data-id="button-3DTour"]',
      PicturesButtonTitle: '#carousel [data-id="button-Pictures"]',
      VideoButtonTitle: '#carousel [data-id="button-Video"]',
      Tour3DButtonTitle: '#carousel [data-id="button-3DTour"]',
      MultimediaButtons: '#carousel [data-id^="button-"]',
      ButtonsContainer: '[data-id="carouselButtonsContainer"]',
      ShowHideButton: '[data-id="carouselButtonsContainer"] button',
      PictureUrl: '.carousel-slider ul li:nth-child(2) > div > div > div > div',
      VideoAndTourSrc: '.carousel-slider ul li:nth-child(2) > div > div > iframe',
    };

    this.PropertyInfoSelectors = {
      SearchBoxContainer: '.rw_propertyDetails_top .textboxWrapper',
      SearchBoxInput: '.rw_propertyDetails_top .textboxWrapper input',
      MobileSearchBoxInput: '[data-c="searchBox"] input',
      FindApartmentButton: '.rw_propertyDetails_top button',
      RentDetails: '.propertyDetails_content .rw_propertyDetails_infoPrice',
      PropertyInfosContainer: '.propertyDetails_content .rw_propertyDetails_info p',
      MapButton: '.propertyDetails_content [data-label="Explore the map"] [data-component="button"]',
      PhoneNumber: '.rw_propertyDetails_contactData .phoneBtn',
      PhoneNumberLink: '.rw_propertyDetails_contactData .phoneBtn a',
      PhoneIcon: '.rw_propertyDetails_contactData .phoneBtn svg',
      ContactUsActiveButton: '.links_section  [data-id="button-Contact us"]',
      DialogConatainer: '[data-id="contactUsDialogContainer"]',
      ContactUsDialogTitle: '[data-id="contactUsDialogContainer"] [data-component="Header"]',
      ContactUsPhoneNumber: '[data-id="contactUsDialogContainer"] [data-component="Text"]',
      FullNameInput: '[data-id="contactFormCard"] [data-id="contactInfoFullName"]',
      PhoneInput: '[data-id="contactFormCard"] [data-id="contactInfoPhoneNumber"]',
      EmailInput: '[data-id="contactFormCard"] [data-id="contactInfoEmail"]',
      AdditionalCommentsInput: '[data-id="contactFormCard"] [data-id="contactInfoAdditionalComments"]',
      MoveInRangeDropdown: '[data-id="contactFormCard"] [data-id="dropdownPlaceholder-When do you plan to move in?"]',
      MoveInRangeDropdownItems: '[data-id="dropdownItems-When do you plan to move in?"] div',
      SendButtonSelector: '[data-id="button-Send"]',
      ShareButton: '.links_section [data-c="btnShareURL"]',
      ShareDialogConatainer: '[data-id="shareDialogContainer"]',
      ShareDialogTitle: '[data-id="shareDialogContainer"] [data-component="Title"]',
      ShareDialogUrlField: '[data-id="shareDialogContainer"] [data-component="field"]',
      ShareFieldInput: '[data-id="shareDialogContainer"] [data-component="field"] input',
      CopyUrlButton: '[data-id="button-copy"]',
      CopyUrlMessage: '[data-id="shareDialogContainer"] [data-component="Caption"]',
    };

    this.ScheduleATourSelectors = {
      UnitDialogContainer: '[data-id="unitDialogContainer"]',
      UnitDialogHeader: '[data-id="unitDialogHeader"]',
      UnitDialogPage: '[data-id="unitDialogPage"]',
      UnitDialogDescription: '[data-id="unitDialogDescription"]',
      UnitDialogButtons: '[data-id="unitDialogButtons"] button',
      UnitDialogCrousel: '[data-id="unitDialogContainer"] [data-id="carousel-wrapper"]',
      UnitDialogFooter: '[data-id="unitDialogFooter"]',
      UnitDialogCancelButton: '[data-id="unitDialogFooter"] button',
    };

    this.DialogDateSelectors = {
      BookerWidgetContainer: '[data-id="bookerWidget"]',
      DateSelectorHeader: '[data-id="dateSelectorHeader"]',
      DateSelectorTitle: '[data-id="dateSelectorTitle"]',
      DateSelectorSubTitle: '[data-id="dateSelectorSubTitle"]',
      DateSelectorBody: '[data-id="dateSelectorBody"]',
      BackToTodayButton: '[data-id="dateSelectorBody"] [data-id="backToTodayButton"] span',
      DateSelectorChevronLeft: '[data-id="daysContainer"] [data-id="dateSelectorChevronLeft"]',
      DateSelectorChevronRight: '[data-id="daysContainer"] [data-id="dateSelectorChevronRight"]',
      DateSelectorMonth: '[data-id="daysScrollerWrapper"] [data-id="dateSelectorMonth"] p',
      DateSelectorMonthGroup: '[data-id="daysScrollerWrapper"] [data-id="dateSelectorMonthGroup"]',
      DateOfTheMonth: '[data-id="dateSlot"]:nth-child(1) [data-id="dateOfTheMonth"]',
      AppointmentsButton: '[data-id="dateSlot"]:nth-child(2) [data-id="appointmentsButtonContainer"] button:nth-child(1)',
      TimeSlot: '[data-id="dateSlot"]:nth-child(2) [data-id="appointmentsButtonContainer"] button:nth-child',
      ViewMoreButton: '[data-id="dateSlot"]:nth-child(2) [data-id="viewMoreButton"]',
      DateSelectorTimeZone: '[data-id="dateSelectorTimeZone"]',
      DateTimeSelectorFooter: '[data-id="dateTimeSelectorFooter"]',
      FooterBackButton: '[data-id="dateTimeSelectorFooter"] button',
      DateSlotsDialogContainer: '[data-id="dateSlotsDialogContainer"]',
      DateSlotsDialogHeader: '[data-id="dateSlotsDialogHeader"]',
      DateSlotsDialogBody: '[data-id="dateSlotsDialogBody"]',
      DateSlotsDialogButtons: '[data-id="dateSlotsDialogBody"] button',
      DateSelectorCloseButton: 'button',
    };

    this.TourScheduleFormSelectors = {
      HeaderTitle: '[data-id="bookerWidget"] [data-id="dateSelectorTitle"]',
      HeaderSubTitle: '[data-id="bookerWidget"] [data-id="dateSelectorSubTitle"]',
      ContactInfoContainer: '[data-id="bookerWidget"] [data-id="wrapperContainer"] > div',
      FooterContainer: '[data-id="bookerWidget"] [data-id="contactInfoFooter"]',
      SelectedDateTimeLabel: '[data-id="bookerWidget"] [data-id="contactInfoContainer"] > p',
      LegalNameInput: '[data-id="contactInfoContainer"] [data-id="contactInfoLegalName"]',
      EmailInput: '[data-id="contactInfoContainer"] [data-id="contactInfoEmailAddress"]',
      PhoneNumberInput: '[data-id="contactInfoContainer"] [data-id="contactInfoMobilePhone"]',
      DropdownPlaceholder: '[data-id="contactInfoContainer"] [data-id="dropdownPlaceholder-When do you plan to move in?*"]',
      DropdownSecondItem: '[data-id="contactInfoContainer"] [data-id="dropdownItems-When do you plan to move in?*"] [data-idx="1"]',
      ConfirmButton: '[data-id="bookerWidget"] [data-id="contactInfoFooter"] button:nth-child(2)',
    };

    this.Colors = {
      SelectedCarouselButton: 'rgb(72, 100, 247)',
      VideButtonSelected: 'rgb(53, 79, 219)',
      DefaultFindApartmentButton: 'rgb(72, 100, 247)',
      HoveredFindApartmentButton: 'rgb(53, 79, 219)',
      DefaultMapButton: 'rgba(0, 0, 0, 0)',
      HoveredMapButton: 'rgba(158, 158, 158, 0.2)',
      SelectedMapButton: 'rgba(158, 158, 158, 0.4)',
      HoveredContactUsButton: 'rgba(158, 158, 158, 0.2)',
      SelectedContactUsButton: 'rgba(158, 158, 158, 0.4)',
      HoveredSendButton: 'rgb(53, 79, 219)',
      HoveredShareButton: 'rgba(0, 0, 0, 0)',
      HoveredCopyUrlButton: 'rgb(53, 79, 219)',
    };

    this.carouselButtonsValues = {
      PicturesStyle: '1500w"); background-size: cover;',
      VideosSrc: 'https://www.youtube.com/embed/Ju6kx6E32WA?1',
      Tour3D: 'https://my.matterport.com/show/?model=U1vHeQjKZ99&1',
    };

    this.mapFlagSrcValuesLast16 = {
      InitialFlagSrc: 'ZmYiLz48L3N2Zz4=',
      HoveredFlagSrc: 'OSIvPjwvc3ZnPg==',
    };

    this.searchResultsPage = new SearchResultsPage(t);

    this.phoneNumbersByProgram = {};

    this.westEggSelectors = {
      westEggChatBotButton: '#chatGardenWidget [type="button"]',
      westEggInputField: '#chatGardenWidget [data-component="textbox"]',
      westEggChatBotButtons: '#chatGardenWidget [data-component="button"]',
    };
  }

  clickContactUsButton = async () => await clickOnElement(this.t, { selector: $(this.selectors.ContactUsButton) });

  checkMoveInDate = async date => await this.t.expect(await $(this.selectors.MoveInDateInput).getAttribute('value')).eql(date);

  clickMobileContactUsButton = async () => await clickOnElement(this.t, { selector: this.selectors.MobileContactUsButton });

  areLayoutFilterContainersDisplayed = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.InventoryDate });
    await expectVisible(t, { selector: this.selectors.LayoutGroupContainer });
  };

  checkLayoutContainer = async () => {
    const { t } = this;
    const layoutContainer = await $(this.selectors.LayoutContainer).withText('1 Bedroom');
    const layoutButton = await $(this.selectors.LayoutButton).withText('1 Bedroom');

    await expectVisible(t, { selector: layoutContainer });
    await expectVisible(t, { selector: layoutButton });

    await t.expect(await layoutButton.getStyleProperty('background-color')).eql('rgb(245, 245, 245)');
    await t.hover(await layoutContainer);

    await expectVisible(t, { selector: this.selectors.TextOnHover });

    await t.hover(await layoutContainer);
  };

  clickLayoutButton = async text => await clickOnElement(this.t, { selector: $(this.selectors.LayoutButton).withText(text) });

  checkMarketingLayoutContainer = async (selector, text) => await expectVisible(this.t, { selector, text });

  checkUnitCardContent = async unitDetails => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.UnitsContainer });
    await expectVisible(t, { selector: this.selectors.MarketingLayoutTitleContainer });
    await expectVisible(t, { selector: this.selectors.MarketingLayoutTitleContainer, text: unitDetails.title });

    await expectVisible(t, { selector: this.selectors.MarketingLayoutUnitInfo, text: 'Area' });
    await t.expect($(this.selectors.MarketingLayoutSqft).innerText).eql(`${unitDetails.sqft} sq ft`);

    await expectVisible(t, { selector: this.selectors.MarketingLayoutUnitInfo, text: 'Beds' });
    await t.expect($(this.selectors.MarketingLayoutNumBeds).innerText).eql(unitDetails.bedsNumber);

    await expectVisible(t, { selector: this.selectors.MarketingLayoutUnitInfo, text: 'Baths' });
    await t.expect($(this.selectors.MarketingLayoutNumBaths).innerText).eql(unitDetails.bathsNumber);

    await t
      .expect($(this.selectors.MarketingLayoutUnitDescription).innerText)
      .eql('Open floor plan with massive bedroom, expansive windows, walk-in closet with built-in dresser and galley style kitchen.');

    await expectVisible(t, { selector: this.selectors.MarketingLayoutUnitContainer });
    await expectVisible(t, { selector: this.selectors.MarketingLayoutImageContainer });
    await expectVisible(t, { selector: this.selectors.MarketingLayoutCardsContainer });

    await expectVisible(t, { selector: this.selectors.MarketingLayoutUnitCard });
    await expectVisible(t, { selector: this.selectors.MarketingLayoutUnitCardState, text: unitDetails.cardState });
    await expectVisible(t, { selector: this.selectors.MarketingLayoutApartmentPriceContainer, text: unitDetails.price });
    await expectVisible(t, { selector: this.selectors.MarketingLayoutApartmentNumberContainer, text: unitDetails.apartmentNumber });
  };

  checkMarketingLayoutForAvailableUnit = async () => {
    const unitDetails = {
      title: 'EL CAPITAN',
      sqft: '819',
      bedsNumber: '1',
      bathsNumber: '1',
      cardState: 'Available now',
      price: '$1,040',
      apartmentNumber: '1-104',
    };
    await this.checkUnitCardContent(unitDetails);
    await this.t.expect($(this.selectors.MarketingLayoutUnitCardAmenitiesList).innerText).eql('Balcony, Patio, Tile Backsplash');
  };

  checkMarketingLayoutForUnavailableUnit = async program => {
    const { t } = this;
    const phoneNumber = await this.getPhoneNumberByProgram(program);

    await expectVisible(t, { selector: this.selectors.MarketingLayoutTitleContainer, text: 'MAMMOTH' });
    await expectNotPresent(t, { selector: this.selectors.MarketingLayoutTitleContainer, text: 'LANGLEY' });

    await expectVisible(t, { selector: this.selectors.MarketingLayoutUnitInfo, text: 'Area' });
    await t.expect($(this.selectors.MarketingLayoutSqft).innerText).eql('1,362 sq ft');

    await expectVisible(t, { selector: this.selectors.MarketingLayoutUnitInfo, text: 'Beds' });
    await t.expect($(this.selectors.MarketingLayoutNumBeds).innerText).eql('3');

    await expectVisible(t, { selector: this.selectors.MarketingLayoutUnitInfo, text: 'Baths' });
    await t.expect($(this.selectors.MarketingLayoutNumBaths).innerText).eql('2');

    await t
      .expect($(this.selectors.MarketingLayoutUnitDescription).innerText)
      .eql('Open floor plan with massive bedroom, expansive windows, walk-in closet with built-in dresser and galley style kitchen.');

    const emptyStateContainer = '[data-id="emptyStateContainer"]';
    await expectVisible(t, { selector: emptyStateContainer });
    await expectVisible(t, {
      selector: `${emptyStateContainer} p`,
      text: 'Our availability is limited right now, but things can change fast! Give us a call at:',
    });

    await expectVisible(t, { selector: `${emptyStateContainer} svg` });
    await expectVisible(t, { selector: `${emptyStateContainer} span`, text: 'CALL US' });
    const { propertyPageFormat, internationalFormat } = formatPhoneNumber(phoneNumber);
    await expectVisible(t, { selector: `${emptyStateContainer} a`, text: propertyPageFormat });
    await t.expect(await $(`${emptyStateContainer} a[data-id="phone"]`).getAttribute('href')).eql(`tel:${internationalFormat}`);

    await expectVisible(t, { selector: `${emptyStateContainer} button` });
  };

  checkOnHoldInventorysAreNotDisplayed = async () => {
    const { t } = this;
    await expectNotPresent(t, { selector: this.selectors.MarketingLayoutApartmentNumberContainer, text: 'Apartment\n\n350AR-1001' });
  };

  checkInventorysWhitoutRmsPricingAreNotDisplayed = async () => {
    const { t } = this;
    await expectNotPresent(t, { selector: this.selectors.UnitsContainer, text: 'Two Bedrooms' });
  };

  checkVacantMakeReadyReservedInventorysAreNotDisplayed = async () => {
    const { t } = this;
    await expectNotPresent(t, { selector: this.selectors.MarketingLayoutApartmentNumberContainer, text: 'Apartment\n\n1-002SALT' });
  };

  checkOccupiedInventorysAreNotDisplayed = async () => {
    const { t } = this;
    await expectNotPresent(t, { selector: this.selectors.MarketingLayoutApartmentNumberContainer, text: 'Apartment\n\n1-007SALT' });
  };

  checkVacantDownInventorysAreNotDisplayed = async () => {
    const { t } = this;
    await expectNotPresent(t, { selector: this.selectors.MarketingLayoutApartmentNumberContainer, text: 'Apartment\n\n1-012SALT' });
  };

  checkModelInventorysAreNotDisplayed = async () => {
    const { t } = this;
    await expectNotPresent(t, { selector: this.selectors.MarketingLayoutApartmentNumberContainer, text: 'Apartment\n\n1-003SALT' });
  };

  isPropertyPageDisplayed = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.NavBar });
    await expectVisible(t, { selector: this.selectors.Carousel });
    await expectVisible(t, { selector: this.selectors.PropertyInfoSection });
    await expectVisible(t, { selector: this.selectors.PropertyTabsSection });
    await expectVisible(t, { selector: this.selectors.PropertyDescriptionSection });
    await expectVisible(t, { selector: this.selectors.PropertyDescriptionGallerySection });
    await expectVisible(t, { selector: this.selectors.PropertyHighLightsSection });
    await expectVisible(t, { selector: this.selectors.PropertyFloorplansSection });
    await expectVisible(t, { selector: this.selectors.PropertyMapSection });
    await expectVisible(t, { selector: this.selectors.SugestedPropertiesSection });
    await expectVisible(t, { selector: this.selectors.Footer });
  };

  showCarouselButtons = async t => {
    const showHideTitle = await $(this.CarouselSelectors.ShowHideButton).getAttribute('title');
    if (showHideTitle === 'Show Buttons') {
      await clickOnElement(t, { selector: this.CarouselSelectors.ShowHideButton });
      await t.wait(2000);
    }
  };

  isMobilePropertyPageDisplayed = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.NavBar });
    await expectVisible(t, { selector: this.selectors.Carousel });
    await expectVisible(t, { selector: this.selectors.PropertyInfoSection });
    await expectVisible(t, { selector: this.selectors.PropertyTabsSection });
    await expectVisible(t, { selector: this.selectors.PropertyDescriptionSection });
    await expectVisible(t, { selector: this.selectors.PropertyHighLightsSection });
    await expectVisible(t, { selector: this.selectors.PropertyFloorplansSection });
    await expectVisible(t, { selector: this.selectors.PropertyMapSection });
    await expectVisible(t, { selector: this.selectors.SugestedPropertiesSection });
    await expectVisible(t, { selector: this.selectors.Footer });
  };

  checkCarouselButtons = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.CarouselSelectors.NextArrow });
    await clickOnElement(t, { selector: this.CarouselSelectors.NextArrow });
    await expectVisible(t, { selector: this.CarouselSelectors.PreviouosArrow });

    await t.wait(4000); // this is needed because we have a 3.5 seconds timer for the carousel buttons to not be displayed anymore and for the animation
    await t.expect($('[data-id="carouselButtonsContainer"]').getStyleProperty('opacity')).eql('1');

    await t.hover(await $(this.selectors.Carousel));
    await t.expect($('[data-id="carouselButtonsContainer"]').getStyleProperty('opacity')).eql('1');

    t.expect($(this.CarouselSelectors.PicturesButtonTitle).find('span').withText('PICTURES'.toUpperCase()));
    t.expect($(this.CarouselSelectors.VideoButtonTitle).find('span').withExactText('VIDEO'.toUpperCase()));

    t.expect($(this.CarouselSelectors.Tour3DButtonTitle).find('span').withExactText('3DTOUR'.toUpperCase()));

    await t.hover(await $(this.selectors.Carousel));
    await this.checkElementStyle({
      selector: this.CarouselSelectors.PicturesButton,
      property: 'background-color',
      value: this.Colors.SelectedCarouselButton,
    });

    await clickOnElement(t, { selector: this.CarouselSelectors.VideoButton });
    await t.hover(await $(this.CarouselSelectors.PicturesButton));
    await this.checkElementStyle({
      selector: this.CarouselSelectors.VideoButton,
      property: 'background-color',
      value: this.Colors.SelectedCarouselButton,
    });

    await t.expect(await $(this.CarouselSelectors.VideoAndTourSrc).getAttribute('src')).eql(this.carouselButtonsValues.VideosSrc);

    await t.wait(3000);
    await this.showCarouselButtons(t);

    await clickOnElement(t, { selector: this.CarouselSelectors.Tour3DButton });
    await t.hover(await $(this.CarouselSelectors.PicturesButton));
    await this.checkElementStyle({
      selector: this.CarouselSelectors.Tour3DButton,
      property: 'background-color',
      value: this.Colors.SelectedCarouselButton,
    });
    await t.expect(await $(this.CarouselSelectors.VideoAndTourSrc).getAttribute('src')).eql(this.carouselButtonsValues.Tour3D);

    await t.wait(3000);
    await this.showCarouselButtons(t);
    await clickOnElement(t, { selector: this.CarouselSelectors.PicturesButton });
    await t.hover(await $(this.CarouselSelectors.VideoButton));
    await this.checkElementStyle({
      selector: this.CarouselSelectors.PicturesButton,
      property: 'background-color',
      value: this.Colors.SelectedCarouselButton,
    });
    await t.expect((await $(this.CarouselSelectors.PictureUrl).getAttribute('style')).slice(-32)).eql(this.carouselButtonsValues.PicturesStyle);
  };

  checkElementStyle = async ({ selector, property, value }) => await this.t.expect(await $(selector).getStyleProperty(property)).eql(value);

  checkInputFieldValue = async (selector, text) => await this.t.expect(await $(selector).getAttribute('value')).eql(text);

  checkAnchorTagNavigation = async selector => {
    const { t } = this;
    await t.expect(await $(selector).getBoundingClientRectProperty('top')).lt(5);
    await t.expect(await $(selector).getBoundingClientRectProperty('top')).gt(-5);
  };

  checkSearchBox = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.PropertyInfoSelectors.SearchBoxContainer });
    await this.checkInputFieldValue(this.PropertyInfoSelectors.SearchBoxInput, 'Sierra Norte');
  };

  checkFindApartmentButton = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.PropertyInfoSelectors.FindApartmentButton });
    await this.checkElementStyle({
      selector: this.PropertyInfoSelectors.FindApartmentButton,
      property: 'background-color',
      value: this.Colors.DefaultFindApartmentButton,
    });

    await expectVisible(t, { selector: this.PropertyInfoSelectors.FindApartmentButton });

    await t.hover(await $(this.PropertyInfoSelectors.FindApartmentButton));
    await this.checkElementStyle({
      selector: this.PropertyInfoSelectors.FindApartmentButton,
      property: 'background-color',
      value: this.Colors.HoveredFindApartmentButton,
    });

    await t.expect($(this.PropertyInfoSelectors.FindApartmentButton).innerText).eql('FIND YOUR NEW HOME');

    await clickOnElement(t, { selector: $(this.PropertyInfoSelectors.FindApartmentButton) });
    await this.checkAnchorTagNavigation(this.selectors.PropertyFloorplansSection);
  };

  checkPropertyInfos = async tst => {
    const infoTexts = [
      'Starting at $1,040 (check availability)',
      '3118 E Bragstad Dr, Sioux Falls, CA 57103',
      'Office Hours: Mon-Tue 12:01am-11:58pm | Wed Closed | Thu-Sun 12:01am-11:58pm',
    ];
    await mapSeries(infoTexts, async title => {
      await expectVisible(tst, { selector: this.PropertyInfoSelectors.PropertyInfosContainer, text: title, boundTestRun: tst });
    });
  };

  checkMapButton = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.PropertyInfoSelectors.MapButton });
    await t.expect($(this.PropertyInfoSelectors.MapButton).innerText).eql('EXPLORE THE MAP');
    await this.checkElementStyle({ selector: this.PropertyInfoSelectors.MapButton, property: 'background-color', value: this.Colors.DefaultMapButton });

    await t.hover(await $(this.PropertyInfoSelectors.MapButton));
    await this.checkElementStyle({ selector: this.PropertyInfoSelectors.MapButton, property: 'background-color', value: this.Colors.HoveredMapButton });

    await clickOnElement(t, { selector: $(this.PropertyInfoSelectors.MapButton) });
    await this.checkAnchorTagNavigation(this.selectors.PropertyMapSection);
  };

  checkPhoneNumber = async program => {
    const { t } = this;
    const phoneNumber = await this.getPhoneNumberByProgram(program);

    await expectVisible(t, { selector: this.PropertyInfoSelectors.PhoneNumber });
    await expectVisible(t, { selector: this.PropertyInfoSelectors.PhoneIcon });
    const { propertyPageFormat, internationalFormat } = formatPhoneNumber(phoneNumber);
    await t.expect(await $(this.PropertyInfoSelectors.PhoneNumberLink).getAttribute('href')).eql(`tel:${internationalFormat}`);
    await t.expect((await $(this.PropertyInfoSelectors.PhoneNumber).innerText).trim()).eql(`CALL US${propertyPageFormat}`);
  };

  checkContactUsButton = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.PropertyInfoSelectors.ContactUsActiveButton });
    await t.expect((await $(this.PropertyInfoSelectors.ContactUsActiveButton).innerText).trim()).eql('CONTACT US');
    await t.hover(await $(this.PropertyInfoSelectors.ContactUsActiveButton));
    await this.checkElementStyle({
      selector: this.PropertyInfoSelectors.ContactUsActiveButton,
      property: 'background-color',
      value: this.Colors.HoveredContactUsButton,
    });
  };

  getPhoneNumberByProgram = async program => {
    if (!this.phoneNumbersByProgram[program]) {
      this.phoneNumbersByProgram[program] = await getPhoneNumberByProgramName(program);
    }
    return this.phoneNumbersByProgram[program];
  };

  checkContactUsDialog = async program => {
    const { t } = this;
    const phoneNumber = await this.getPhoneNumberByProgram(program);

    await expectVisible(t, { selector: this.PropertyInfoSelectors.DialogConatainer });

    await expectVisible(t, { selector: this.PropertyInfoSelectors.ContactUsDialogTitle, text: 'Contact Us' });

    await expectVisible(t, {
      selector: this.PropertyInfoSelectors.ContactUsPhoneNumber,
      text: `CALL US${formatPhoneNumber(phoneNumber).propertyPageFormat}`,
    });

    await expectVisible(t, { selector: this.PropertyInfoSelectors.FullNameInput });
    await t.expect(await $(this.PropertyInfoSelectors.FullNameInput).getAttribute('placeholder')).eql('Full Name*');

    await expectVisible(t, { selector: this.PropertyInfoSelectors.PhoneInput });
    await t.expect(await $(this.PropertyInfoSelectors.PhoneInput).getAttribute('placeholder')).eql('Phone*');

    await expectVisible(t, { selector: this.PropertyInfoSelectors.EmailInput });
    await t.expect(await $(this.PropertyInfoSelectors.EmailInput).getAttribute('placeholder')).eql('Email*');

    await expectVisible(t, { selector: this.PropertyInfoSelectors.AdditionalCommentsInput });
    await t.expect(await $(this.PropertyInfoSelectors.AdditionalCommentsInput).getAttribute('placeholder')).eql('Additional comments');

    await expectVisible(t, { selector: this.PropertyInfoSelectors.MoveInRangeDropdown });
    await t.expect(await $(this.PropertyInfoSelectors.MoveInRangeDropdown).getAttribute('title')).eql('When do you plan to move in?');

    await clickOnElement(t, { selector: $(this.PropertyInfoSelectors.MoveInRangeDropdown) });
    const moveInRanges = ['Next 4 weeks', 'Next 2 months', 'Next 4 months', 'Beyond 4 months', "I don't know"];
    await mapSeries(moveInRanges, async title => {
      await expectVisible(t, { selector: this.PropertyInfoSelectors.MoveInRangeDropdownItems, text: title, boundTestRun: this.t });
    });

    await expectVisible(t, { selector: this.PropertyInfoSelectors.SendButtonSelector });

    await clickOnElement(t, { selector: $(this.PropertyInfoSelectors.MoveInRangeDropdown) });

    await t.hover(await $(this.PropertyInfoSelectors.SendButtonSelector));
    await this.checkElementStyle({
      selector: this.PropertyInfoSelectors.SendButtonSelector,
      property: 'background-color',
      value: this.Colors.HoveredSendButton,
    });
  };

  checkDialogNotPresent = async () => await expectNotPresent(this.t, { selector: this.PropertyInfoSelectors.DialogConatainer });

  clickOutsideDialog = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: await $(this.PropertyInfoSelectors.RentDetails) });
    await t.wait(500);
  };

  checkShareButton = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.PropertyInfoSelectors.ShareButton, text: 'SHARE' });

    await t.hover(await $(this.PropertyInfoSelectors.ShareButton));
    await this.checkElementStyle({
      selector: this.PropertyInfoSelectors.ShareButton,
      property: 'background-color',
      value: this.Colors.HoveredShareButton,
    });
  };

  checkShareDialog = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.PropertyInfoSelectors.ShareDialogConatainer, text: 'Share' });
    await expectVisible(t, { selector: this.PropertyInfoSelectors.ShareDialogUrlField });

    await t
      .expect(await $(this.PropertyInfoSelectors.ShareFieldInput).getAttribute('value'))
      .eql('https://web.local.env.reva.tech/property/south-dakota/siouxfalls/sierra');
    await expectVisible(t, { selector: this.PropertyInfoSelectors.CopyUrlButton, text: 'COPY' });

    await t.hover(await $(this.PropertyInfoSelectors.CopyUrlButton));
    await this.checkElementStyle({
      selector: this.PropertyInfoSelectors.CopyUrlButton,
      property: 'background-color',
      value: this.Colors.HoveredCopyUrlButton,
    });

    await t.setNativeDialogHandler(() => true).click(this.PropertyInfoSelectors.CopyUrlButton); // eslint-disable-line red/no-tc-click
    await expectVisible(t, { selector: await $(this.PropertyInfoSelectors.CopyUrlMessage), text: 'Link copied' });

    await t.wait(4000);
    await expectNotPresent(t, { selector: this.PropertyInfoSelectors.CopyUrlMessage });
  };

  checkPropertyTabs = async selector => {
    const { t } = this;
    const propertyTabButtonsTitle = ['PROPERTY DESCRIPTION', 'HIGHLIGHTS', 'FLOOR PLANS', 'EXPLORE THE AREA'];
    await mapSeries(propertyTabButtonsTitle, async title => {
      await expectVisible(t, { selector, text: title, boundTestRun: t });
    });
  };

  checkMobilePropertyTabs = async (tst, selector) => {
    const propertyTabButtonsTitle = ['DESCRIPTION', 'HIGHLIGHTS', 'FLOOR PLANS', 'MAP'];
    await mapSeries(propertyTabButtonsTitle, async title => {
      await expectVisible(tst, { selector, text: title, boundTestRun: tst });
    });
  };

  checkPropertyTabsNavBar = async () => {
    const { t } = this;
    // TODO: uncomment this and remove the next line after padding issue will be fixed on CPM-15201;
    // await this.checkAnchorTagNavigation(this.selectors.PropertyDescriptionSection);
    await t.expect(await $(this.selectors.PropertyDescriptionSection).getBoundingClientRectProperty('top')).gt(-5);
    await t.expect(await $(this.selectors.NavBar).getAttribute('data-tabs-visible')).eql('true');

    await expectVisible(t, { selector: this.selectors.PropertyTabsNavBar });
    await expectVisible(t, { selector: this.selectors.BackToTopButton });

    await this.checkPropertyTabs(this.selectors.PropertyTabs);

    await t.expect($(this.selectors.BackToTopButton).innerText).eql('BACK TO TOP ↑');

    await clickOnElement(t, { selector: $(this.selectors.PropertyTabsNavBarTitles).withText('HIGHLIGHTS') });
    await this.checkAnchorTagNavigation(this.selectors.PropertyHighLightsSection);

    await clickOnElement(t, { selector: $(this.selectors.PropertyTabsNavBarTitles).withText('FLOOR PLANS') });
    await this.checkAnchorTagNavigation(this.selectors.PropertyFloorplansSection);

    await clickOnElement(t, { selector: $(this.selectors.PropertyTabsNavBarTitles).withText('EXPLORE THE AREA') });
    await this.checkAnchorTagNavigation(this.selectors.PropertyMapSection);

    await clickOnElement(t, { selector: $(this.selectors.BackToTopButton) });
    await t.expect(await $(this.selectors.NavBar).getAttribute('data-tabs-visible')).eql('false');
  };

  checkMobileNavigationPropertyTabs = async () => {
    const { t } = this;
    await t.expect(await $(this.selectors.PropertyDescriptionSection).getBoundingClientRectProperty('top')).gt(-5);

    await clickOnElement(t, { selector: $(this.selectors.MobilePropertyTabs).withText('HIGHLIGHTS') });
    await this.checkAnchorTagNavigation(this.selectors.PropertyHighLightsSection);

    await clickOnElement(t, { selector: $(this.selectors.MobilePropertyTabs).withText('FLOOR PLANS') });
    await this.checkAnchorTagNavigation(this.selectors.PropertyFloorplansSection);

    await clickOnElement(t, { selector: $(this.selectors.MobilePropertyTabs).withText('MAP') });
    await this.checkAnchorTagNavigation(this.selectors.PropertyMapSection);
  };

  checkPropertyDescriptionSection = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.PropertyDescriptionTitle, text: 'Property Description' });

    await expectVisible(t, { selector: this.selectors.DescriptionOfTheProperty });
    await expectVisible(t, { selector: this.selectors.DescriptionHighlights });
  };

  checkHighlightsSection = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.PropertyHighlightsTitle, text: 'Community Highlights' });

    const secondaryHighlightsTitles = ['LifeStyles', 'Community Amenities', 'Floorplan Amenities'];
    await mapSeries(
      secondaryHighlightsTitles,
      async title => await expectVisible(t, { selector: this.selectors.PropertyHighlightsSecondaryTitles, text: title, boundTestRun: t }),
    );

    const lifestyleTitles = [
      lifestylesFilters.PetFriendly,
      lifestylesFilters.FamilyFriendly,
      lifestylesFilters.Gym,
      lifestylesFilters.ClubHouse,
      lifestylesFilters.CloseToTransit,
    ];

    await mapSeries(lifestyleTitles, async title => await expectVisible(t, { selector: this.selectors.LifestyleTitles, text: title, boundTestRun: t }));

    await expectVisible(t, { selector: this.selectors.HighlightsMentionText, text: '* Floorplans vary and may not include all the floorplan amenities' });
  };

  checkFloorplanSection = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.FloorplanSectionTitle, text: 'Find Your New Home' });
    await expectVisible(t, { selector: this.selectors.LayoutSectionContainer });
  };

  checkMapSection = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.MapSectionTitle, text: 'Explore the Neighborhood' });
    await expectVisible(t, { selector: this.selectors.MapContainer });
    await expectVisible(t, { selector: this.selectors.SierraMapFlag });
    await this.searchResultsPage.checkMapFlagSrcLast16(this.selectors.SierraMapFlag, this.mapFlagSrcValuesLast16.InitialFlagSrc);
    await t.hover(await $(this.selectors.SierraMapFlag));
    await this.searchResultsPage.checkMapFlagSrcLast16(this.selectors.SierraMapFlag, this.mapFlagSrcValuesLast16.HoveredFlagSrc);
    await clickOnElement(t, { selector: await $(this.selectors.SierraMapFlag) });
    await this.searchResultsPage.checkMapFlagSrcLast16(this.selectors.SierraMapFlag, this.mapFlagSrcValuesLast16.HoveredFlagSrc);
    await expectVisible(t, { selector: this.selectors.MapInfoBox, text: 'Sierra Norte' });
    await t.wait(500);
    await clickOnElement(t, { selector: await $(this.selectors.SierraMapFlag) });
    await t.wait(500);
  };

  otherCommunitiesDisplayed = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.OtherCommunities });
  };

  checkRelatedPropertyCards = async expectedCards => {
    const { t } = this;
    if (!expectedCards.length) {
      await expectNotPresent(t, { selector: this.selectors.RelatedPropertyCard });
    } else {
      await mapSeries(expectedCards, async cardData => {
        const relatedPropertyCard = await $(this.selectors.RelatedPropertyCard).withText(cardData.title).with({ boundTestRun: t });
        await t.expect(relatedPropertyCard.visible).eql(true);

        const titleNode = await relatedPropertyCard.child('.clamp-lines').child('div').withText(cardData.title).with({ boundTestRun: t });
        await t.expect(titleNode.exists).ok();

        const cardInfoSection = await relatedPropertyCard.child('div').withAttribute('data-id', 'propertyCard').with({ boundTestRun: t });

        await t.expect(cardInfoSection.visible).eql(true);

        await mapSeries(
          cardData.expectedDetails,
          async text => await t.expect((await cardInfoSection.child('div').child('p').withText(text).with({ boundTestRun: t })).visible).eql(true),
        );

        if (cardData.program) {
          const phoneNumber = await this.getPhoneNumberByProgram(cardData.program);
          const { propertyPageFormat } = formatPhoneNumber(phoneNumber);

          await t.expect((await cardInfoSection.child('div').child('div').child('p').withText(propertyPageFormat).with({ boundTestRun: t })).visible).eql(true);
        }
      });
    }
  };

  clickOnRelatedPropertyCard = async relatedPropertyCard =>
    await clickOnElement(this.t, { selector: await $(this.selectors.RelatedPropertyCard).withText(relatedPropertyCard) });

  checkSearchBoxInput = async expectedValue => await this.t.expect(await $(this.PropertyInfoSelectors.SearchBoxInput).getAttribute('value')).eql(expectedValue);

  clickOnInventoryCardByIndex = async index => await clickOnElement(this.t, { selector: $(this.selectors.MarketingLayoutUnitCard).nth(index) });

  checkUnitDialog = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.ScheduleATourSelectors.UnitDialogContainer });

    await expectVisible(t, { selector: this.ScheduleATourSelectors.UnitDialogHeader, text: 'Get Your Apartment 1-103' });
    await expectVisible(t, { selector: this.ScheduleATourSelectors.UnitDialogPage });

    await expectVisible(t, { selector: this.ScheduleATourSelectors.UnitDialogDescription, text: 'Starting at $1040' });
    await expectVisible(t, {
      selector: this.ScheduleATourSelectors.UnitDialogDescription,
      text: 'Balcony, Patio, Tile Backsplash',
    });

    await expectVisible(t, { selector: this.ScheduleATourSelectors.UnitDialogButtons, text: 'SCHEDULE A TOUR' });
    await expectVisible(t, { selector: this.ScheduleATourSelectors.UnitDialogButtons, text: 'GET PERSONALIZED PRICE' });

    await expectVisible(t, { selector: this.ScheduleATourSelectors.UnitDialogCrousel });
    await expectVisible(t, { selector: this.ScheduleATourSelectors.UnitDialogFooter, text: 'CANCEL' });
  };

  checkDateSelectorDialog = async ({ unitAvailability }) => {
    const { t } = this;
    await expectVisible(t, { selector: this.DialogDateSelectors.BookerWidgetContainer });
    await expectVisible(t, { selector: this.DialogDateSelectors.DateSelectorHeader });
    await expectVisible(t, { selector: this.DialogDateSelectors.DateSelectorBody });
    await expectVisible(t, { selector: this.DialogDateSelectors.BookerWidgetContainer });

    await expectVisible(t, {
      selector: this.DialogDateSelectors.DateSelectorSubTitle,
      text: 'If you are ready to view your future home, please select a date and time to schedule a tour below',
    });

    await expectNotVisible(t, { selector: this.DialogDateSelectors.BackToTodayButton });

    const sierraNortesDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/Chicago' });
    const dayOfTheMonth = new Date().toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Chicago' });
    await t.expect(await $(this.DialogDateSelectors.DateSelectorMonth).innerText).eql(sierraNortesDate);
    await t.expect(await $(this.DialogDateSelectors.DateOfTheMonth).innerText).eql(dayOfTheMonth);

    await expectVisible(t, { selector: this.DialogDateSelectors.AppointmentsButton });
    await expectVisible(t, { selector: this.DialogDateSelectors.ViewMoreButton, text: 'View more' });

    // MAM this timezone label is not currently being rendered
    // await expectVisible(t, { selector: this.DialogDateSelectors.DateSelectorTimeZone, text: 'Time Zone: America/Chicago' });

    await clickOnElement(t, { selector: await $(this.DialogDateSelectors.DateSelectorChevronRight) });
    await expectVisible(t, { selector: this.DialogDateSelectors.BackToTodayButton });

    await clickOnElement(t, { selector: await $(this.DialogDateSelectors.DateSelectorChevronLeft) });
    await t.wait(2000); // needed because we have an animation on th BackToToday button
    await expectNotVisible(t, { selector: this.DialogDateSelectors.BackToTodayButton });

    await clickOnElement(t, { selector: await $(this.DialogDateSelectors.DateSelectorChevronRight) });
    await clickOnElement(t, { selector: await $(this.DialogDateSelectors.DateSelectorChevronRight) });
    await expectVisible(t, { selector: this.DialogDateSelectors.BackToTodayButton });

    await clickOnElement(t, { selector: await $(this.DialogDateSelectors.BackToTodayButton) });
    await t.wait(2000); // needed because we have an animation on th BackToToday button
    await expectNotVisible(t, { selector: this.DialogDateSelectors.BackToTodayButton });

    if (unitAvailability) {
      await expectVisible(t, { selector: this.DialogDateSelectors.DateSelectorTitle, text: 'Schedule a tour for apartment 1-103' });
      await expectVisible(t, { selector: this.DialogDateSelectors.DateTimeSelectorFooter });
      await expectVisible(t, { selector: this.DialogDateSelectors.FooterBackButton, text: 'BACK' });
    } else {
      await expectVisible(t, { selector: this.DialogDateSelectors.DateSelectorTitle, text: 'Schedule a tour for Sierra Norte' });
    }
  };

  checkViewMoreDialog = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: await $(this.DialogDateSelectors.ViewMoreButton) });
    await t.wait(2000);

    await expectVisible(t, { selector: this.DialogDateSelectors.DateSlotsDialogContainer });
    await expectVisible(t, { selector: this.DialogDateSelectors.DateSlotsDialogHeader });
    await expectVisible(t, { selector: this.DialogDateSelectors.DateSlotsDialogBody });
    await expectVisible(t, { selector: this.DialogDateSelectors.DateSlotsDialogButtons });

    await clickOnElement(t, { selector: await $(this.DialogDateSelectors.DateSelectorCloseButton).withText('CLOSE') });
  };

  openContactInfoForm = async () => await clickOnElement(this.t, { selector: await $(this.DialogDateSelectors.AppointmentsButton) });

  selectTimeSlot = async idx => await clickOnElement(this.t, { selector: await $(`${this.DialogDateSelectors.TimeSlot}(${idx})`) });

  checkFieldValidationError = async errorMessage =>
    await this.t.expect((await $('[data-id="contactInfoContainer"] p').withExactText(errorMessage)).visible).eql(true);

  checkContactInfoForm = async () => {
    const { t } = this;
    await expectVisible(t, { selector: this.TourScheduleFormSelectors.HeaderTitle, text: 'Provide contact information' });
    await expectVisible(t, {
      selector: this.TourScheduleFormSelectors.HeaderSubTitle,
      text: "Enter your contact information below, and we'll be in touch with you shortly.",
    });

    await expectVisible(t, { selector: this.TourScheduleFormSelectors.ContactInfoContainer });
    await expectVisible(t, { selector: this.TourScheduleFormSelectors.FooterContainer });
    await expectVisible(t, { selector: this.TourScheduleFormSelectors.SelectedDateTimeLabel });
  };

  typeIntoTourScheduleForm = async (selector, text) => await this.t.typeText($(selector), text, { replace: true });

  clickOnMoveInRangeDropdown = async () => await clickOnElement(this.t, { selector: $(this.TourScheduleFormSelectors.DropdownPlaceholder) });

  clickOnMoveInRangeItem = async () => await clickOnElement(this.t, { selector: $(this.TourScheduleFormSelectors.DropdownSecondItem) });

  submitTourScheduleForm = async () => await clickOnElement(this.t, { selector: $(this.TourScheduleFormSelectors.ConfirmButton) });

  checkThankYouPage = async () => {
    const { t } = this;
    await t.expect((await $('p').withExactText('Thank you for booking a tour!')).visible).eql(true);
    await t.expect((await $('p').withExactText('You will get your confirmation details via email.')).visible).eql(true);
  };

  closeThankYouPage = async () => await clickOnElement(this.t, { selector: $('button').withText('CONTINUE EXPLORING YOUR COMMUNITY') });

  checkTourScheduleFormInputs = async (legalNameInput, email, phoneNumber, moveInRange) => {
    const { t } = this;
    await t.expect(await $(this.TourScheduleFormSelectors.LegalNameInput).getAttribute('value')).eql(legalNameInput);
    await t.expect(await $(this.TourScheduleFormSelectors.EmailInput).getAttribute('value')).eql(email);
    await t.expect(await $(this.TourScheduleFormSelectors.PhoneNumberInput).getAttribute('value')).eql(phoneNumber);
    await expectVisible(t, { selector: 'p', text: moveInRange });
  };

  checkEmptyTourScheduleFormInputs = async () => {
    const { t } = this;
    await t.expect(await $(this.TourScheduleFormSelectors.LegalNameInput).getAttribute('value')).eql('');
    await t.expect(await $(this.TourScheduleFormSelectors.EmailInput).getAttribute('value')).eql('');
    await t.expect(await $(this.TourScheduleFormSelectors.PhoneNumberInput).getAttribute('value')).eql('');
    await expectVisible(t, { selector: this.TourScheduleFormSelectors.DropdownPlaceholder });
  };

  clearSearch = async () => await clearTextElement(this.t, { selector: this.PropertyInfoSelectors.SearchBoxInput });

  typeIntoSearch = async searchTerm => {
    await this.t.typeText($(this.PropertyInfoSelectors.SearchBoxInput), searchTerm);
  };

  checkMobileTourCalendar = async calendarDates => {
    const { t } = this;
    await expectVisible(t, { selector: $('[data-id="dateOfTheMonth"]').withText(calendarDates[0]) });
    await expectVisible(t, { selector: $('[data-id="dateOfTheMonth"]').withText(calendarDates[1]) });
    await clickOnElement(t, { selector: this.DialogDateSelectors.DateSelectorChevronRight });
    await expectVisible(t, { selector: $('[data-id="dateOfTheMonth"]').withText(calendarDates[2]) });
  };

  pickTourSlot = async () => {
    const { t } = this;
    await clickOnElement(t, { selector: '[data-id="dateSlot"]:nth-child(3) button span' });
  };

  checkWestEggButtons = async selector => {
    const { t } = this;
    const westEggButtons = ['LIFESTYLES', 'SHARED AMENITIES', 'FLOOR PLAN AMENITIES', 'PHOTOS'];
    await mapSeries(westEggButtons, async title => {
      await expectVisible(t, { selector, text: title, boundTestRun: t });
    });
  };
}
