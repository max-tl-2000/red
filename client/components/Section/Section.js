/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { isString } from 'helpers/type-of';
import { toTitleCase } from 'helpers/capitalize';
import { cf, g } from './Section.scss';
import SectionTitle from './SectionTitle';
import Caption from '../Typography/Caption';

const Section = ({ children, className, fullWidth = true, title, helperText, padContent = true, actionItems, sectionTitleClassName, ...props }) => {
  const cNames = cf('section', { fullWidth, padContent }, g(className));
  let labelC;

  if (isString(title)) {
    labelC = title && (
      <SectionTitle className={sectionTitleClassName} actionItems={actionItems}>
        {toTitleCase(title)}
      </SectionTitle>
    );
  } else {
    labelC = title;
  }

  if (isString(helperText)) {
    helperText = helperText && (
      <Caption secondary className={cf('helper-text')}>
        {helperText}
      </Caption>
    );
  }

  return (
    <div data-component="section" className={cNames} {...props}>
      {labelC}
      {helperText}
      <div className={cf('content')}>{children}</div>
    </div>
  );
};

export default Section;
