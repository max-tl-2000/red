/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { Button, Card, CardActions } from 'components';
import { t } from 'i18next';
import { UnitBlock, SummarySection } from 'custom-components/QuoteSummary/QuoteSummary';
import { cf } from './QuoteSummarySection.scss';

export const QuoteSummarySection = ({ quote, inventory, onViewFullQuote }) => {
  const handleViewFullQuote = () => onViewFullQuote && onViewFullQuote();
  return (
    <Card data-id="quoteSummaryCard" data-component="quote-summary-section">
      <div>
        {inventory && inventory.id && <UnitBlock reflow hideStatus inventory={inventory} dataId="applicationSummary" />}
        {quote && <SummarySection quote={quote} className={cf('quote')} renderLeaseTerms={false} />}
      </div>
      <CardActions className={cf('quote-actions')} textAlign="center">
        <Button data-id="viewQuoteButton" type="flat" label={t('VIEW_FULL_QUOTE')} onClick={handleViewFullQuote} />
      </CardActions>
    </Card>
  );
};

QuoteSummarySection.propTypes = {
  quote: PropTypes.object,
  inventory: PropTypes.object,
  onViewFullQuote: PropTypes.func,
};
