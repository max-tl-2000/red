/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Tag } from 'components';
import { Text, SubHeader, Caption } from 'components/Typography/Typography';
import FormattedMarkdown from 'components/Markdown/FormattedMarkdown';
import { connect } from 'react-redux';
import injectProps from '../../helpers/injectProps';
import { formatUnitCardInfo, getInventoryLeaseSelector } from '../../helpers/unitsUtils';
import { cf } from './InventoryCard.scss';
import { inventoryStateRepresentation, shouldDisplayInventoryState, isModelState } from '../../../common/inventory-helper';
import { renderFullQualifiedName } from './InventoryHelper';
import { getStartingAtPriceText } from '../../../common/helpers/adjustmentText';

@connect((state, props) => ({
  leases: getInventoryLeaseSelector(state, props),
}))
export default class InventoryDetails extends Component {
  static propTypes = {
    inventory: PropTypes.object,
    isSpecial: PropTypes.bool,
    status: PropTypes.string,
    className: PropTypes.string,
    small: PropTypes.bool,
    unitNameOnTop: PropTypes.bool,
  };

  @injectProps
  render({ inventory, small, onClick, unitNameOnTop, leases }) {
    if (!inventory || !inventory.layoutName) return null;
    const unitInfo = formatUnitCardInfo(inventory);
    const { additionalTag, leaseTerm } = inventory;

    const isModel = isModelState(inventory);
    const hasAdditionalTags = additionalTag && !!additionalTag.length;
    const shouldDisplayState = shouldDisplayInventoryState(inventory, isModel);
    const state = shouldDisplayState && inventoryStateRepresentation(inventory, leases);

    const { name, fullQualifiedName, layoutDisplayName, adjustedMarketRent, specials } = inventory;

    return (
      <div className={cf('unit-details', { model: isModel })} onClick={onClick}>
        {small && unitNameOnTop && <SubHeader>{name}</SubHeader>}
        <SubHeader className={cf('unit-name')}>
          <span data-id="unitInfo">{unitInfo.unitDetails}</span>
          {!small && (
            <Text className={cf('separator-bullet')} inline secondary>
              {' ● '}
            </Text>
          )}
          {!small && renderFullQualifiedName(fullQualifiedName)}
        </SubHeader>
        {shouldDisplayState && (
          <Caption className={cf('caption-text')} secondary data-id="status">
            {state}
          </Caption>
        )}
        <Caption className={cf('caption-text')} secondary>{`${unitInfo.area}, ${layoutDisplayName}`}</Caption>
        {!isModel && !!adjustedMarketRent && (
          <Caption className={cf('caption-text')}>
            <FormattedMarkdown data-id={`${fullQualifiedName}_startingAtPriceText`} inline className={cf('starting-at')}>
              {getStartingAtPriceText(adjustedMarketRent, leaseTerm)}
            </FormattedMarkdown>
            {specials && (
              <Caption inline highlight>
                {t('SPECIALS')}
              </Caption>
            )}
          </Caption>
        )}
        {hasAdditionalTags && additionalTag.map(tag => tag && <Tag id={`tag-${name}-${tag}`} text={tag} className={cf('tag')} info key={tag} />)}
      </div>
    );
  }
}
