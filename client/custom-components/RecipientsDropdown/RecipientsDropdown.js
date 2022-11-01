/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Avatar, Dropdown, RedList, Typography as T, RedList as L } from 'components';
import { cf, g } from './RecipientsDropdown.scss';
import Text from '../../components/Typography/Text';

const minMatchLength = 3;

const RecipientsDropdown = ({
  recipients,
  selectedRecipients,
  onChange,
  className,
  overlayMinWidth,
  placeholderText,
  onNoMoreItemsToSelect,
  showListOnFocus,
  readOnly,
}) => {
  const renderItem = ({ item, query, highlightMatches }) => {
    const isItemDisabled = item.disabled;
    const text = highlightMatches(item.text, query, {
      bold: true,
      ellipsis: true,
      className: cf({ disabled: isItemDisabled }),
      minMatchLength,
    });
    const recipientText = highlightMatches(item.originalItem.value, query, {
      ellipsis: true,
      className: cf('value', { disabled: isItemDisabled }),
      minMatchLength,
    });

    return (
      <RedList.ListItem rowStyle="mixed" className={cf('list-item')}>
        <RedList.AvatarSection>
          <Avatar userName={item.text} />
        </RedList.AvatarSection>
        <RedList.MainSection>
          {text}
          <div className={cf('contact-row')}>
            {recipientText}
            {item.originalItem?.isPrimary && (
              <Text className={cf('primary-contact')} secondary>
                {t('PRIMARY')}
              </Text>
            )}
          </div>
        </RedList.MainSection>
      </RedList.ListItem>
    );
  };

  const groupItemRenderer = ({ item }) => {
    const { originalItem } = item;
    return (
      <Text bold className={cf('heading', 'value')}>
        {originalItem.name}
      </Text>
    );
  };

  const matchQuery = (query, { originalItem: item }) => {
    if (item.items) {
      // we don't perform matching on the group items
      return false;
    }

    const name = item.name.toLowerCase();
    const value = item.value.toLowerCase();

    return name.indexOf(query) > -1 || value.indexOf(query) > -1;
  };

  const handleSelection = ({ ids }) => {
    onChange && onChange(ids);
  };

  const renderNoItems = () => (
    <L.ListItem wrapChildren>
      <T.Text>{t('NO_MORE_MEMBERS_TO_SELECT')}</T.Text>
    </L.ListItem>
  );

  return (
    <Dropdown
      placeholder={placeholderText || t('RECIPIENTS_TO')}
      autocomplete
      multiple
      textRoleSecondary={true}
      underlineOnEditOnly
      onNoMoreItemsToSelect={onNoMoreItemsToSelect}
      className={cf('recipients-dropdown', { readOnly }, g(className))}
      overlayClassName={cf('flyout-overlay')}
      overlayStyle={{ minWidth: overlayMinWidth }}
      items={recipients}
      selectedValue={selectedRecipients}
      renderItem={renderItem}
      renderGroupItem={groupItemRenderer}
      matchQuery={matchQuery}
      textField="name"
      onChange={handleSelection}
      showListOnFocus={showListOnFocus}
      queryMinLength={1}
      noMoreItemsTemplate={renderNoItems}
      noItemsTemplate={renderNoItems}
    />
  );
};

export default RecipientsDropdown;
