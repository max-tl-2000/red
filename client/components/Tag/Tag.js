/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './Tag.scss';
import Caption from '../Typography/Caption';
import Truncate from '../Truncate/Truncate';

const Tag = ({ text, className, info, warn, id }) => {
  let textC = text;
  if (typeof text === 'string') {
    textC = <Caption secondary>{text}</Caption>;
  }
  return (
    <div data-component="tag" id={id} className={cf('tag', g(className), { info, warn })}>
      <div className={cf('wrapper')}>
        <Truncate id={`${id}_truncate`} direction="horizontal">
          {textC}
        </Truncate>
      </div>
    </div>
  );
};

export default Tag;
