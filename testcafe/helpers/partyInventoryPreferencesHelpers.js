/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { Selector as $ } from 'testcafe';
import PartyDetailPage from '../pages/partyDetailPage';
import { expectVisible, expectTextIsEqual, clickOnElement } from './helpers';
import { DALTypes } from '../../common/enums/DALTypes';
import { SHORT_DATE_FORMAT, MONTH_DATE_YEAR_FORMAT } from '../../common/date-constants';
import { createMoveInFilter } from '../../common/helpers/filters';

export const verifyPreferencesSectionIsDisplayed = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  return await expectVisible(t, { selector: partyDetailPage.selectors.preferencesSection });
};

export const buildMoveInDateLabelUsingQQ = (moveInTimeQuestionId, timezone) => {
  const moveInRange = createMoveInFilter(DALTypes.QualificationQuestions.MoveInTime[moveInTimeQuestionId], { timezone });
  const { min, max } = moveInRange;

  const isSameYear = min.isSame(max, 'year');

  const minDateFormatted = min.format(isSameYear ? SHORT_DATE_FORMAT : MONTH_DATE_YEAR_FORMAT);
  const maxDateFormatted = max.format(MONTH_DATE_YEAR_FORMAT);

  return `${minDateFormatted} - ${maxDateFormatted}`;
};

export const verifyQQSelectionsOnUnitPreferences = async (t, { propertyName, qualificationInfo, maxPriceRange, moveInDateSummaryLabel }) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.propertyNameInfoText, text: propertyName });
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.numBedroomsText, text: qualificationInfo.bedrooms });

  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.moveInDatePreferenceText, text: moveInDateSummaryLabel });

  await clickOnElement(t, { selector: partyDetailPage.getPreferencesStepSelector(trans('UNIT_PREFERENCES_LABEL')) });
  await expectVisible(t, { selector: partyDetailPage.selectors.maxPriceRangeText });
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.maxPriceRangeText, text: maxPriceRange });
};

export const verifyInventoryPanelPills = async (t, { bedsPillText, moveInPillText }) => {
  if (bedsPillText) {
    await expectTextIsEqual(t, { selector: `[data-id="${trans('LABEL_BEDS')}_inventoryFilterPillText"]`, text: bedsPillText });
  }

  if (moveInPillText) {
    await expectTextIsEqual(t, { selector: `[data-id="${trans('LABEL_DATE')}_inventoryFilterPillText"]`, text: moveInPillText });
  }
};

export const verifyInventoryCardsPrices = async (t, { firstCardId, secondCardId, firstCardFormattedPrice, secondCardFormattedPrice }) => {
  if (firstCardId) {
    await expectVisible(t, { selector: `[data-id="${firstCardId}"]` });
    await expectTextIsEqual(t, { selector: `[data-id="${firstCardId}"]>p>span`, text: firstCardFormattedPrice });
  }

  if (secondCardId) {
    await expectVisible(t, { selector: `[data-id="${secondCardId}"]` });
    await expectTextIsEqual(t, { selector: `[data-id="${secondCardId}"]>p>span`, text: secondCardFormattedPrice });
  }
};

export const verifyMatchingInventoryCards = async (t, { firstUnitCardIdSelector, firstUnitCardPrefix }) => {
  // This is to control responsiveness
  if (await $(firstUnitCardIdSelector).exists) {
    await expectTextIsEqual(t, { selector: firstUnitCardIdSelector, text: firstUnitCardPrefix });
  } else {
    await expectTextIsEqual(t, { selector: '[data-id="qualifiedName"]>span', text: firstUnitCardPrefix });
  }
};

export const verifyClickOnSelectProperty = async (t, { propertyCardSelector }) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.selectPropertyBtn });
  await clickOnElement(t, { selector: partyDetailPage.selectors.selectPropertyBtn });
  await expectVisible(t, { selector: propertyCardSelector });
};

export const selectAmenity = async (t, { amenitySelector }) => {
  await expectVisible(t, { selector: amenitySelector });
  await clickOnElement(t, { selector: amenitySelector });
};

export const verifyClickOnUpdatePreferences = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.updatePreferencesBtn });
  await clickOnElement(t, { selector: partyDetailPage.selectors.updatePreferencesBtn });
  await expectVisible(t, { selector: partyDetailPage.selectors.maxPriceRangeText });
};
