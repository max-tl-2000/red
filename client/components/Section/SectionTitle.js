/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import typeOf from 'helpers/type-of';
import { cf, g } from './Section.scss';
import Text from '../Typography/Text';

const SectionTitle = ({ children, actionItems, className }) => {
  let text;
  if (typeOf(children) === 'string') {
    text = (
      <div>
        <Text bold>{children}</Text>
      </div>
    );
  } else {
    text = children;
  }

  return (
    <div data-id="sectionTitleTxt" className={cf('title-section', g(className))}>
      {text} {actionItems && <div className={cf('action-items')}>{actionItems}</div>}
    </div>
  );
};

export default SectionTitle;
