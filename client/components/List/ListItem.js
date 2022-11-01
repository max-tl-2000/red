/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Children } from 'react';
import { cf, g } from './List.scss';
import AvatarSection from './AvatarSection';
import ActionSection from './ActionSection';
import MainSection from './MainSection';

const avatarSectionType = (<AvatarSection />).type;
const actionSectionType = (<ActionSection />).type;

// rowStyle [row-simple, row-mixed]
export default function ListItem({
  className,
  focused,
  clickable = true,
  hoverable = true,
  fixedSections,
  selected,
  disabled,
  onClick,
  wrapChildren,
  rowStyle = 'simple',
  children,
  ...props
}) {
  if (typeof fixedSections === 'undefined') {
    fixedSections = 0;

    Children.forEach(children, item => {
      if (item && (item.type === avatarSectionType || item.type === actionSectionType)) {
        fixedSections++;
      }
    });
  }

  const cNames = cf(
    'list-item',
    {
      hoverable,
      disabled,
      focused,
      clickable,
      // every ListItem can contain one or two fixed sections
      // one for the Avatar, and one for an action icon
      // these clases are used to fix an issue that happen when
      // the content inside the container with `flex:1` uses nowrap.
      //
      // As described here: https://redisrupt.atlassian.net/browse/CPM-4104
      // the issue is that the no wrapped text breaks the layout preventing
      // the container to have the right size.
      //
      // This issue does not happen if the content inside does not use wrap
      'one-fixed': fixedSections === 1,
      'two-fixed': fixedSections === 2,
      selected,
    },
    rowStyle,
    g(className),
  );

  const content = wrapChildren ? <MainSection>{children}</MainSection> : children;

  return (
    <div data-component="list-item" onClick={e => !disabled && onClick && onClick(e, children.props)} className={cNames} {...props}>
      {content}
    </div>
  );
}
