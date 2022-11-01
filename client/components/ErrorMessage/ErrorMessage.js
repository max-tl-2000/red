/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import trim from 'helpers/trim';
import { cf } from './error.scss';
import Text from '../Typography/Text';

export default function ErrorMessage(props) {
  const { errorMessage, visible, message, dataTestId } = props;
  const theErrorMessage = message || errorMessage;

  const statusClasses = cf('error-message', {
    on: visible || trim(theErrorMessage) !== '',
  });

  const errorContent = props.children || (
    <Text data-id={dataTestId} error>
      {theErrorMessage}
    </Text>
  );

  return <div className={statusClasses}>{errorContent}</div>;
}
