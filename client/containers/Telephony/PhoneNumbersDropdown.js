/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Dropdown, RedList } from 'components';
import { cf, g } from './PhoneNumbersDropdown.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import { toMoment } from '../../../common/helpers/moment-utils';

const displayLastCallData = data => {
  const { lastCall, lastCallDate } = data;
  const formattedLastCallDate = lastCallDate ? toMoment(lastCallDate).fromNow() : '';

  switch (lastCall) {
    case DALTypes.ContactInfoLastCallStatus.CALLBACK_REQUESTED:
      return `${t('CALLBACK_REQUESTED')} ${formattedLastCallDate}`;
    case DALTypes.ContactInfoLastCallStatus.MISSED:
      return `${t('MISSED_CALL')} ${formattedLastCallDate}`;
    case DALTypes.ContactInfoLastCallStatus.INCOMING:
      return `${t('INCOMING_CALL')} ${formattedLastCallDate}`;
    case DALTypes.ContactInfoLastCallStatus.OUTGOING:
      return `${t('OUTGOING_CALL')} ${formattedLastCallDate}`;
    default:
      return t('NO_CALLS_YET');
  }
};

const PhoneNumbersDropdown = ({ phoneNumbers, selectedValue, onChange, className, overlayMinWidth, placeholderText, showListOnFocus }) => {
  const renderItem = ({ item }) => {
    const { originalItem } = item;
    return (
      <RedList.ListItem rowStyle="mixed" className={cf('list-item')}>
        <RedList.MainSection>
          {originalItem.displayValue}
          <div className={cf('unit-row', 'value')}>{displayLastCallData(originalItem.metadata)}</div>
        </RedList.MainSection>
      </RedList.ListItem>
    );
  };

  const handleSelection = value => {
    onChange && onChange(value);
  };

  return (
    <Dropdown
      placeholder={placeholderText}
      className={cf('phone-dropdown', g(className))}
      overlayClassName={cf('flyout-overlay')}
      overlayStyle={{ minWidth: overlayMinWidth }}
      items={phoneNumbers}
      selectedValue={selectedValue.id}
      renderItem={renderItem}
      textField="displayValue"
      secondaryTextField={displayLastCallData(selectedValue.metadata)}
      onChange={handleSelection}
      showListOnFocus={showListOnFocus}
    />
  );
};

export default PhoneNumbersDropdown;
