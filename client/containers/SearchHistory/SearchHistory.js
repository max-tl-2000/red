/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Icon, Typography as T, RedList as L } from 'components';
import trim from 'helpers/trim';

export default class SearchHistory extends Component {
  static propTypes = {
    searches: PropTypes.array,
    onClick: PropTypes.func,
  };

  handleClick = item => this.props.onClick && this.props.onClick(item);

  render() {
    const { searches = [], className } = this.props;
    const items = searches.reduce((seq, search) => {
      if (!trim(search.value)) {
        return seq;
      }

      seq.push(
        <L.ListItem onClick={() => this.handleClick(search.value)} key={search.value}>
          <L.AvatarSection>
            <Icon name="history" iconStyle="dark" />
          </L.AvatarSection>
          <L.MainSection>
            <T.Text secondary>{search.value}</T.Text>
          </L.MainSection>
        </L.ListItem>,
      );

      return seq;
    }, []);

    return (
      <div className={className}>
        <T.Text style={{ margin: '0.625rem 0 0.625rem 1rem' }}>{t('YOUR_SEARCHES')}</T.Text>
        <L.List>{items}</L.List>
      </div>
    );
  }
}
