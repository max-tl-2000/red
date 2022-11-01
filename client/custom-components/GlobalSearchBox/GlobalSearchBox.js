/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Dropdown, Avatar, Icon, Typography as T } from 'components';
import { t } from 'i18next';
import fuzzysearch from 'fuzzysearch';
import trim from 'helpers/trim';
import AutocompleteCard from './AutocompleteCard';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './GlobalSearchBox.scss';
import { partyIsRenewalOrActiveLease, partyIsNotActive } from '../../helpers/party';
import { displayedWorkflowNames } from '../../../common/enums/partyTypes';
import { isRenewalWorkflow, isCorporateParty, isActiveLeaseWorkflow } from '../../../common/helpers/party-utils';
import { GLOBAL_SEARCH_QUERY_MAX_LENGTH } from '../../../common/enums/enums';

export default class GlobalSearchBox extends Component {
  static propTypes = {
    onSuggestionsRequest: PropTypes.func,
    onEnterPress: PropTypes.func,
    clearIcon: PropTypes.string,
    inputValue: PropTypes.string,
    onChange: PropTypes.func,
    onClear: PropTypes.func,
  };

  /**
   * sets the value of the autocompleteTextBox
   */
  set value(val) {
    this.dropdown.setAutocompleteQuery(val);
    this.dropdown.focus();
  }

  // when the query changes this method is called
  // the consumer of the component should provide
  // a function that return a promise with the result
  // of the request
  handleQueryChange = input => {
    const { onSuggestionsRequest } = this.props;
    if (!onSuggestionsRequest) return;
    return onSuggestionsRequest(input); // eslint-disable-line consistent-return
  };

  handleEnterPress = (e, args) => {
    const { onEnterPress } = this.props;
    onEnterPress && onEnterPress(e, args);
  };

  handleAutocompleteTextBoxChange = ({ value }) => {
    if (value === '') {
      const { onClear } = this.props;
      // we need to be informed if the textBox was cleared
      // firing this event we notify the parent component that
      // the value was cleared
      onClear && onClear();
    }
  };

  handleOnChange = selection => {
    const { onChange } = this.props;
    onChange && onChange(selection);
  };

  getIcon(item) {
    switch (item.type) {
      case DALTypes.ItemType.person:
        return <Avatar userName={item.fullName} src={item.avatarUrl} />;
      case DALTypes.ItemType.unit:
        return <Icon name="home" />;
      case DALTypes.ItemType.party: {
        const fullName = trim(item.partyMembersFullNames).split(',')[0];
        const isRenewalOrActiveLease = partyIsRenewalOrActiveLease(item);
        const isClosedParty = partyIsNotActive(item);
        if (isClosedParty) {
          return <Avatar className={cf('avatar')} src="/closed-party.svg" />;
        }
        return <Avatar lighter bgColor="rgb(216, 216, 216)" userName={fullName} isRenewalOrActiveLease={isRenewalOrActiveLease} />;
      }
      default:
        return <Avatar userName={new Date().getTime().toString()} />;
    }
  }

  matchQuery = (query, { originalItem: item }) => fuzzysearch(query, item.originalItem.fullQualifiedName.toLowerCase());

  renderItem = ({ item, query, highlightMatches }) => {
    switch (item.originalItem.type) {
      case DALTypes.ItemType.unit: {
        const { fullQualifiedName, name, layoutDisplayName } = item.originalItem;
        const text = highlightMatches(fullQualifiedName, query, {
          Component: T.SubHeader,
          inline: true,
        });
        const thirdText = (
          <T.Text secondary inline>
            {`${name} | `}
            {highlightMatches(layoutDisplayName, query, {
              inline: true,
              secondary: true,
            })}
          </T.Text>
        );

        return <AutocompleteCard mainText={fullQualifiedName} thirdText={thirdText} itemWithDescription={text} icon={this.getIcon(item.originalItem)} />;
      }

      case DALTypes.ItemType.party: {
        const companyName = isCorporateParty(item.originalItem) ? item.originalItem.companyName : null;
        const { partyMembersFullNames } = item.originalItem;
        const shouldDisplayUnit = isActiveLeaseWorkflow(item.originalItem) || isRenewalWorkflow(item.originalItem);
        const rightAlignedSubtext = [];
        isRenewalWorkflow(item.originalItem) && rightAlignedSubtext.push(t(displayedWorkflowNames.renewal.toUpperCase()));
        shouldDisplayUnit && item.originalItem?.inventory?.name && rightAlignedSubtext.push(`Unit ${item.originalItem?.inventory?.name}`);
        const secondaryText = companyName ? (
          <T.Text secondary inline>
            {highlightMatches(partyMembersFullNames, query, {
              inline: true,
              secondary: true,
            })}
          </T.Text>
        ) : null;
        return (
          <AutocompleteCard
            mainText={companyName || item.originalItem.partyMembersFullNames}
            itemWithDescription={companyName || item.originalItem.partyMembersFullNames}
            secondaryText={secondaryText}
            icon={this.getIcon(item.originalItem)}
            rightAlignedSubtext={rightAlignedSubtext}
          />
        );
      }
      case DALTypes.ItemType.person:
        return (
          <AutocompleteCard mainText={item.originalItem.fullName} itemWithDescription={item.originalItem.fullName} icon={this.getIcon(item.originalItem)} />
        );

      default:
        return '';
    }
  };

  focus() {
    this.dropdown && this.dropdown.focus();
  }

  render() {
    return (
      <div className={cf('searchContainer')}>
        <Dropdown
          ref={ref => (this.dropdown = ref)}
          placeholder={t('SEARCH_LINK')}
          overlayClassName={cf('searchOverlay')}
          autocomplete
          subtleLoading
          noAutoFocusOnItem
          clearFocusOnQueryChange
          renderItem={this.renderItem}
          source={this.handleQueryChange}
          matchQuery={this.matchQuery}
          textField="name"
          valueField="id"
          textBoxIconAffordance="magnify"
          textBoxShowClear={true}
          formatSelected={() => <noscript />}
          wide
          onAutocompleteTextBoxChange={this.handleAutocompleteTextBoxChange}
          styled={false}
          onEnterPressOnTextBox={this.handleEnterPress}
          showResultsWhenQueryLengthValidate
          onChange={this.handleOnChange}
          maxLength={GLOBAL_SEARCH_QUERY_MAX_LENGTH}
        />
      </div>
    );
  }
}
