/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import fuzzysearch from 'fuzzysearch';
import SearchForm from 'custom-components/SearchForm/SearchForm';
import { Markdown, RedList, Avatar, Icon, Typography } from 'components';
import Caption from '../../components/Typography/Caption';
import { cf, g } from './ContactsSearchForm.scss';

const Text = Typography.Text;
export default class ContactsSearchForm extends Component {
  static propTypes = {
    contacts: PropTypes.array.isRequired,
    onContactSelected: PropTypes.func.isRequired,
  };

  matchQuery = (query, { originalItem: item }) => {
    if (item.items) {
      // we don't perform matching on the group items
      return false;
    }
    return fuzzysearch(query, item.fullName.toLowerCase()) || fuzzysearch(query, item.phone.toLowerCase());
  };

  renderItem = ({ item, query, highlightMatches }) => {
    const text = highlightMatches(item.text, query, {
      bold: true,
      ellipsis: true,
      style: { width: '150px' },
    });

    const { phone, hasPhoneNumber, disabled, isPrimary } = item.originalItem;
    const phoneText = highlightMatches(phone, query, { secondary: true });

    return (
      <RedList.ListItem disabled={disabled} rowStyle="mixed">
        <RedList.AvatarSection>
          <Avatar userName={item.text} />
        </RedList.AvatarSection>
        <RedList.MainSection>
          {text}
          {hasPhoneNumber ? (
            <div className={cf('phone-row')}>
              {phoneText}
              {isPrimary && (
                <Text className={cf('primary-phone')} secondary>
                  {t('PRIMARY')}
                </Text>
              )}
            </div>
          ) : (
            t('PHONE_MISSING')
          )}
        </RedList.MainSection>
      </RedList.ListItem>
    );
  };

  renderGroupItem = ({ item }) => <Caption>{item.originalItem.text}</Caption>;

  emptyResultsTemplate = searchTerm => (
    <div className={cf('no-results')}>
      <div className={cf('iconContainer')}>
        <Icon name="magnify" className={cf('icon')} />
      </div>
      <div>
        <Markdown className={cf(g('body textSecondary'), 'info')}>{`${t('NO_RESULTS_FOR')}**"${searchTerm}"**`}</Markdown>
        <Markdown className={cf(g('body textSecondary'), 'suggestions')}>{`${t('NO_PHONE_RESULTS_SUGGESTIONS')}`}</Markdown>
      </div>
    </div>
  );

  render = () => (
    <SearchForm
      placeholder={t('NAME')}
      items={this.props.contacts}
      className={cf('flyout-content')}
      matchQuery={this.matchQuery}
      renderItem={this.renderItem}
      renderGroupItem={this.renderGroupItem}
      emptyResultsTemplate={this.emptyResultsTemplate}
      onChange={this.props.onContactSelected}
      textField="fullName"
      valueField="id"
    />
  );
}
