/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './Chip.scss';
import Avatar from '../Avatar/Avatar';
import IconButton from '../IconButton/IconButton';
import Caption from '../Typography/Caption';
import Truncate from '../Truncate/Truncate';

const Chip = ({ text, deletable, floating, userName, onRemove, className, selected = false, error = false, style }) => {
  let textC = text;
  if (typeof text === 'string') {
    textC = (
      <Caption lighter={selected} errorUnderline={error}>
        {text}
      </Caption>
    );
  }
  return (
    <div
      data-component="chip"
      style={style}
      className={cf('chip', g(className), {
        selected,
        floating,
        deletable,
        'chip-with-avatar': !!userName,
        error,
      })}>
      <div className={cf('wrapper')}>
        {userName && <Avatar className={cf('avatar')} userName={userName} initialsStyle={{ fontSize: '.8rem' }} />}

        <Truncate direction="horizontal">{textC}</Truncate>

        {deletable && <IconButton iconName="close-circle" onClick={onRemove} className={cf('remove')} />}
      </div>
    </div>
  );
};

export default Chip;
