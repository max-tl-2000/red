/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { formatMoney } from '../../../common/money-formatter';
import Text from '../Typography/Text';

export default function Money({ amount, inline = true, className, currency = 'USD', noFormat, noDecimals = false, TextComponent = Text, dataId, ...rest }) {
  const { result: formatted, integerPart, decimalPart } = formatMoney({
    amount,
    currency,
  });

  return noFormat ? (
    <span data-id={dataId} data-component="money" className={className} {...rest}>
      {formatted}
    </span>
  ) : (
    <TextComponent inline={inline} data-component="money" className={className} data-id={`${dataId}Formatted`} {...rest}>
      <span data-id={dataId} data-part="integer">
        {integerPart}
      </span>
      {!noDecimals && (
        <TextComponent inline secondary data-part="decimal">
          .{decimalPart}
        </TextComponent>
      )}
    </TextComponent>
  );
}
