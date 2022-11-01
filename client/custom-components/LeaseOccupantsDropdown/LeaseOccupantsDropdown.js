/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Avatar, Dropdown, RedList } from 'components';
import { infoToDisplayOnPerson } from '../../helpers/infoToDisplayOnPerson';
import { cf, g } from './LeaseOccupantsDropdown.scss';
import Text from '../../components/Typography/Text';

const displayOccupantUnits = occupant => {
  const { unitNamesForPublishedLeases, unitNamesForExecutedLeases } = occupant;
  if (!unitNamesForPublishedLeases.length && !unitNamesForExecutedLeases.length) return '';

  if (unitNamesForPublishedLeases.length) {
    return t('OCCUPANT_ON_PUBLISHED_LEASE', { unitNames: unitNamesForPublishedLeases.join(', ') });
  }
  return t('OCCUPANT_ON_EXECUTED_LEASE', { unitNames: unitNamesForExecutedLeases.join(', ') });
};

const LeaseOccupantsDropdown = ({ occupants, selectedOccupants, onChange, className, overlayMinWidth, placeholderText, showListOnFocus, readOnly, label }) => {
  const renderItem = ({ item }) => (
    <RedList.ListItem rowStyle="mixed" className={cf('list-item')}>
      <RedList.AvatarSection>
        <Avatar userName={item.text} />
      </RedList.AvatarSection>
      <RedList.MainSection>
        {infoToDisplayOnPerson(item.originalItem)}
        <div className={cf('unit-row', 'value')}>{displayOccupantUnits(item.originalItem)}</div>
      </RedList.MainSection>
    </RedList.ListItem>
  );

  const groupItemRenderer = ({ item }) => {
    const { originalItem } = item;
    return (
      <Text bold className={cf('heading')}>
        {originalItem.name}
      </Text>
    );
  };

  const handleSelection = value => {
    onChange && onChange(value);
  };

  return (
    <Dropdown
      placeholder={placeholderText}
      autocomplete
      textRoleSecondary={readOnly}
      multiple
      className={cf('occupants-dropdown', { readOnly }, g(className))}
      overlayClassName={cf('flyout-overlay')}
      overlayStyle={{ minWidth: overlayMinWidth }}
      items={occupants}
      selectedValue={selectedOccupants}
      renderItem={renderItem}
      renderGroupItem={groupItemRenderer}
      textField="fullName"
      onChange={handleSelection}
      showListOnFocus={showListOnFocus}
      queryMinLength={1}
      label={label}
    />
  );
};

export default LeaseOccupantsDropdown;
