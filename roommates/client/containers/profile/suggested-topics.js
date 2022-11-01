/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Typography } from 'components';
import { cf } from './suggested-topics.scss';

const { Caption } = Typography;

const getItems = () => [
  t('ROOMMATE_SUGGESTED_TOPIC_ONE'),
  t('ROOMMATE_SUGGESTED_TOPIC_TWO'),
  t('ROOMMATE_SUGGESTED_TOPIC_THREE'),
  t('ROOMMATE_SUGGESTED_TOPIC_FOUR'),
  t('ROOMMATE_SUGGESTED_TOPIC_FIVE'),
];

const renderListItem = (item, key) => (
  <li className={cf('list-item')} key={key}>
    <Caption secondary>{item}</Caption>
  </li>
);

export const SuggestedTopics = () => {
  const items = getItems();
  return (
    <div className={cf('suggested-topics')}>
      <div className={cf('title')}>
        <Caption secondary>{t('ROOMMATE_SUGGESTED_TOPICS')}</Caption>
      </div>
      <div className={cf('list-container')}>
        <ul>{items.map((item, index) => renderListItem(item, index))}</ul>
      </div>
    </div>
  );
};
