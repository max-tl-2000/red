/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './Dialog.scss';
import DialogTitle from './DialogTitle';
import Icon from '../Icon/Icon';

export default function DialogHeader({
  className,
  rightSideIcon,
  title,
  titleIconName,
  titleIconClassName,
  rightSideIconClassName,
  fullscreen,
  isCohort,
  children,
  ...props
}) {
  const titleC = typeof title === 'string' ? <DialogTitle>{title}</DialogTitle> : title;

  return (
    <div data-component="dialog-header" id="dialog-header" className={cf('header', { fullscreen, isCohort }, g(className))} {...props}>
      <div className={cf('title-container')}>
        {titleIconName && <Icon name={titleIconName} className={cf('icon-title', g(titleIconClassName))} />}
        {titleC}
        {rightSideIcon && <Icon name={rightSideIcon} className={`${cf('right-side-icon')} ${rightSideIconClassName}`} />}
      </div>
      {children}
    </div>
  );
}
