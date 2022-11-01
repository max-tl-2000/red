/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import nullish from 'helpers/nullish';
import { formatMoney } from '../../../common/money-formatter';
import { DALTypes } from '../../../common/enums/DALTypes';
import { doesUrlHasProtocol } from '../../../common/helpers/resolve-url';
import { location, replace } from '../../../client/helpers/navigator';
import { toMoment, now } from '../../../common/helpers/moment-utils';

export const getFormattedIncome = item => {
  if (!item.income) return t(item.frequency);
  const { result: formatted, integerPart, decimalPart } = formatMoney({
    amount: item.income,
    currency: item.currency,
  });
  const formattedIncome = decimalPart > 0 ? formatted : integerPart;

  if (!item.frequency) return formattedIncome;
  return t('INCOME_WITH_FREQUENCY', {
    income: formattedIncome,
    frequency: t(`${item.frequency}`),
  });
};

const getCity = ({ formattedAddress = '', city, neighborhood }) => {
  if (!neighborhood || city === neighborhood) return city;

  const [matchedCity] = formattedAddress.match(new RegExp(neighborhood, 'i')) || [];
  return matchedCity ? neighborhood : city;
};

export const parseApplicantAddress = (address = {}, isLocalAddress = true) => {
  const localAddressline = isLocalAddress
    ? [...((address.streetNumber && [address.streetNumber]) || []), ...((address.addressLine1 && [address.addressLine1]) || [])].join(' ')
    : '';

  return {
    addressLine: (!isLocalAddress && address.formattedAddress) || '',
    addressLine1: (isLocalAddress && localAddressline) || '',
    addressLine2: '',
    city: (isLocalAddress && getCity(address)) || '',
    state: (isLocalAddress && address.state) || '',
    zip: (isLocalAddress && address.zip) || '',
  };
};

export const isIncomeSourceNegative = field => {
  const val = parseFloat(field.value);
  if (val < 0) {
    return { error: t('GROSS_INCOME_GREATER_OR_EQUAL_TO_ZERO') };
  }
  return true;
};

export const isDateInTheFuture = ({ value }, { parseFormat, errorToken, unitOfTime = 'month' }) => {
  if (!value) return true;

  const startDateInput = toMoment(value, { parseFormat });
  if (startDateInput.isBefore(now(), unitOfTime)) return true;

  return { error: t(errorToken) };
};

export const incomeSourceFieldHasValue = value => !(nullish(value) || isNaN(parseFloat(value)));

export const getPersonInfo = (partyMembers, personId) => {
  const person = partyMembers.find(pm => pm.personId === personId);
  return person || {};
};

export const getPersonContactInfo = (partyMembers, personId) => {
  const person = getPersonInfo(partyMembers, personId);
  return person.contactInfo || {};
};

export const isNegativeFee = feeType => feeType === DALTypes.FeeType.WAIVER_APPLICATION;

// 'location.replace' restarts the store, so not state will be saved
// 'replace' can't handle absolute urls (ex: 'https://www.reva.com')
export const redirectToUrl = url => (doesUrlHasProtocol(url) ? location.replace(url) : replace(url));
