/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import typeOf from 'helpers/type-of';

import nullish from 'helpers/nullish';
import { Title } from '../Typography/Typography';
import { cf, g } from './AppBar.scss';

import AppBarMainSection from './AppBarMainSection';
import AppBarActions from './AppBarActions';
import AppBarIconSection from './AppBarIconSection';

const appBarIconSectionType = (<AppBarIconSection />).type;
const appBarActionsType = (<AppBarActions />).type;
const appBarMainSectionType = (<AppBarMainSection />).type;

import IconButton from '../IconButton/IconButton';

const getSections = children => {
  if (!Array.isArray(children)) {
    children = [children]; // eslint-disable-line
  }
  return children.reduce(
    (seq, child) => {
      if (!nullish(child)) {
        if (child.type === appBarMainSectionType) {
          seq.mainSection = child;
        } else if (child.type === appBarActionsType) {
          seq.appBarActions = child;
        } else if (child.type === appBarIconSectionType) {
          seq.iconSection = child;
        } else {
          seq.others.push(child);
        }
      }

      return seq;
    },
    { others: [] },
  );
};

const AppBar = ({ className, flat, iconSectionClass, isRenewalOrActiveLeaseParty, isCommunicationManagement, secondary, title, children, icon }) => {
  const titleComponent = typeOf(title) === 'string' ? <Title className={cf('title')}>{title}</Title> : title;
  const iconComponent = typeOf(icon) === 'string' ? <IconButton iconName={icon} /> : icon;

  const sections = getSections(children);

  const mainSection = !sections.mainSection ? <AppBarMainSection>{titleComponent}</AppBarMainSection> : sections.mainSection;
  const iconSection = !sections.iconSection ? <AppBarIconSection className={iconSectionClass}>{iconComponent}</AppBarIconSection> : sections.iconSection;

  return (
    <div
      data-id="appBar"
      data-component="app-bar"
      className={cf(
        'appbar',
        { secondary, flat, renewalOrActiveLease: isRenewalOrActiveLeaseParty, communicationManagement: isCommunicationManagement },
        g(className),
      )}>
      {iconSection}
      {mainSection}
      {sections.appBarActions}
      {sections.others}
    </div>
  );
};

export default AppBar;
