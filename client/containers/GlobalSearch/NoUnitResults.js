/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Icon, Typography as T } from 'components';
import { cf, g } from './NoUnitResults.scss';

export default class NoUnitResults extends Component {
  static propTypes = {
    query: PropTypes.string,
    noResultPrefixText: PropTypes.string,
    noResultSuffixText: PropTypes.string,
    icon: PropTypes.string,
    containerClassName: PropTypes.string,
  };

  static defaultProps = {
    icon: '',
  };

  render() {
    return (
      <div className={cf('noResults', g(this.props.containerClassName))}>
        <div>
          {this.props.icon !== '' && (
            <div className={cf('iconContainer')}>
              <Icon name={this.props.icon} className="searchIcon" iconStyle="light" />
            </div>
          )}
          <T.Text secondary className={cf('message')}>
            {this.props.noResultPrefixText}
            <T.Text bold inline>
              {this.props.query}
            </T.Text>
            {this.props.noResultSuffixText}
          </T.Text>
        </div>
        {this.props.displaySuggestions && (
          <div>
            <T.Text className={cf('suggestionsTitle')} secondary>
              {t('APPOINTMENT_CARD_NO_MATCHES_SUGGESTIONS')}
            </T.Text>
            <ul className={cf('suggestionsList')}>
              <li>
                <T.Text secondary>{t('APPOINTMENT_CARD_NO_MATCHES_SUGGESTIONS_CHECK_SPELLING')}</T.Text>
              </li>
              <li>
                <T.Text secondary>{t('APPOINTMENT_CARD_NO_MATCHES_SUGGESTIONS_TRY_DIFFERENT_KEYWORDS')}</T.Text>
              </li>
              <li>
                <T.Text secondary>{t('APPOINTMENT_CARD_NO_MATCHES_SUGGESTIONS_TRY_GENERAL_KEYWORDS')}</T.Text>
              </li>
            </ul>
          </div>
        )}
      </div>
    );
  }
}
