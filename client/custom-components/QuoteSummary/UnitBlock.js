/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { getQuoteLayoutSummary } from 'helpers/inventory';
import { Text, SubHeader, Caption } from '../../components/Typography/Typography';
import { cf } from './UnitBlock.scss';
import ComplimentaryItems from './ComplimentaryItems';
import { inventoryStateRepresentation } from '../../../common/inventory-helper';
import { getBigLayoutImage } from '../../../common/helpers/cloudinary';
import { formatUnitAddress } from '../../../common/helpers/addressUtils';

export default function UnitBlock({ inventory, reflow, hideStatus, dataId, leftPadding }) {
  const layoutInf = getQuoteLayoutSummary(inventory);
  const unitInfo = formatUnitAddress(inventory);
  const state = inventoryStateRepresentation(inventory);

  // TODO: image here should come from the handler for images
  // not directly from cloudinary

  // TODO: make a Picture component
  return (
    <div className={cf('unit', { reflow })}>
      <div className={cf('image-container', { 'hide-status': hideStatus })}>
        <img data-id={`${dataId}_quoteImage`} className={cf('image')} src={getBigLayoutImage(inventory.imageUrl)} />
        {!hideStatus && (
          <span className={cf('status')}>
            <Caption inline>{state}</Caption>
          </span>
        )}
      </div>
      <div className={cf('description')}>
        <div className={cf('unit-info', { leftPadding })}>
          <SubHeader id="summaryUnitNameTxt" data-id={`${dataId}_quoteInfo`} className={cf('unit-name')}>
            {unitInfo}
          </SubHeader>
          <Text id="summaryComplimentaryItemsTxt">{layoutInf}</Text>
        </div>
        {!!inventory && !!inventory.complimentaryItems.length && (
          <div className={cf('complimentaryItems', { leftPadding })}>
            <div>
              <Text inline secondary>
                {' '}
                {t('QUOTE_DRAFT_INCLUDES_COMPLIMENTARY')}{' '}
              </Text>
            </div>
            <ComplimentaryItems inventory={inventory} />
          </div>
        )}
      </div>
    </div>
  );
}
