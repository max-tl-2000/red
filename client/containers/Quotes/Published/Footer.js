/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';

import FormattedMarkdown from 'components/Markdown/FormattedMarkdown';
import { cf } from './QuoteResult.scss';

export default function Footer({ quoteNumber, markdownContent }) {
  return (
    <div className={cf('footer')}>
      <p className={cf('confirmation-number')}>
        {t('QUOTE_CONFIRMATION_NUMBER')} <span className={cf('quote-number')}>{quoteNumber}</span>
      </p>
      <FormattedMarkdown className={cf('policy-section')}>{markdownContent}</FormattedMarkdown>
    </div>
  );
}
