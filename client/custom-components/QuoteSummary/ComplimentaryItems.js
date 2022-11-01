/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography as T, Truncate } from 'components';
import { cf } from './ComplimentaryItems.scss';

const { Text } = T;

const ComplimentaryItems = ({ inventory }) => {
  const entries = inventory.complimentaryItems.reduce((acc, item, index) => {
    acc.push(
      // TODO: We need to find a proper id here
      // eslint-disable-next-line react/no-array-index-key
      <span key={index}>
        {item.name}
        {!!item.secondaryName && (
          <Text secondary inline className={cf('left-space')}>
            ({item.secondaryName})
          </Text>
        )}
      </span>,
    );

    if (index < inventory.complimentaryItems.length - 1) {
      // TODO: Why are we duplicating the index here
      // eslint-disable-next-line react/no-array-index-key
      acc.push(<span key={`${index}-${index}`}>, </span>);
    }

    return acc;
  }, []);
  return (
    <Truncate>
      <Text data-id="complimentaryItemsTxt">{entries}</Text>
    </Truncate>
  );
};

export default ComplimentaryItems;
