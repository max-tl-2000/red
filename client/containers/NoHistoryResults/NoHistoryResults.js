/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import { cf } from './NoHistoryResults.scss';
import NoHistoryItem from './NoHistoryItem';

export default class NoHistoryResults extends Component {
  static defaultProps = {
    items: [
      {
        name: 'UNITS',
        icon: 'property',
      },
      {
        name: 'PARTIES',
        icon: 'people',
      },
      {
        name: 'PEOPLE',
        icon: 'account',
      },
      {
        name: 'EMAIL',
        icon: 'email',
      },
      {
        name: 'NOTES',
        icon: 'message-text',
      },
      {
        name: 'PHONE',
        icon: 'phone',
      },
    ],
  };

  render() {
    const text = t('NO_HISTORY_MSG').split('BREAK');

    const renderItems = this.props.items.map((item, index) => (
      // TODO: We need to find a proper id here
      // eslint-disable-next-line react/no-array-index-key
      <NoHistoryItem key={index} item={item} />
    ));

    return (
      <div className={cf('mainContainer')}>
        <div className={cf('internContainer')}>
          <span className={cf('title')}>{t('SEARCH_FOR')}</span>
          <div>{renderItems}</div>
          <span className={cf('text')}>{text[0]}</span>
          <span className={cf('text', 'second')}>{text[1]}</span>
        </div>
      </div>
    );
  }
}
