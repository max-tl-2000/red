/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Dropdown, RedList, RedTable, Typography } from 'components';
import TimeDuration from '../TimeDuration';
import { cf } from './LeaseTermSelector.scss';
// TODO: this is actually a sign that we can factorize a component
// Referencing 2 or more css files from a single js file is a sign
// that a component is just waiting to be factorized properly
// Ideally not more than one scss file should be referenced from a js file
import { cf as cf2 } from '../QuoteList.scss';

const { ListItem } = RedList;

const { Money, TextPrimary } = RedTable;

const { Text } = Typography;

const renderQuoteTermRow = renderScreeningInfo => ({ item: { originalItem } }) => {
  const { id, termLength, adjustedMarketRent } = originalItem;
  return (
    <ListItem data-component="list-term-selector-row" hoverable={false} id={`term${termLength}`}>
      <Text key={`term-${id}`}>
        <Text inline>
          <TimeDuration value={termLength} />
        </Text>
        <Text inline>
          <Money amount={adjustedMarketRent} />
        </Text>
        {renderScreeningInfo && (
          <Text inline className={cf2('row-shape')}>
            <span className={cf2(originalItem.screening.shape)} />
            <TextPrimary inline>{originalItem.screening.text}</TextPrimary>
          </Text>
        )}
      </Text>
    </ListItem>
  );
};

const formatSelected = renderScreeningInfo => args => renderQuoteTermRow(renderScreeningInfo)({ item: { originalItem: args.selected[0].originalItem } });

export const LeaseTermSelector = ({ leaseTerms, onChange, selectedTerm, renderScreeningInfo, isRenewal }) => (
  <Dropdown
    data-component="lease-term-selector"
    items={leaseTerms}
    selectedValue={selectedTerm.id}
    onChange={({ item }) => onChange(item)}
    renderItem={renderQuoteTermRow(renderScreeningInfo)}
    formatSelected={formatSelected(renderScreeningInfo)}
    useTooltip={false}
    className={cf('lease-term-selector', { isRenewal })}
  />
);
