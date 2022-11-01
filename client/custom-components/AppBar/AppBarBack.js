/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';

import IconButton from 'components/IconButton/IconButton';
import AppBar from 'components/AppBar/AppBar';
import { inject, observer } from 'mobx-react';

const AppBarBack = ({ children, onNavigateBack, ...props }) => {
  const navigateBack = () => {
    onNavigateBack && onNavigateBack();
    props.leasingNavigator.navigateToDashboard();
  };

  return (
    <AppBar icon={<IconButton id="navigateBack" iconStyle="light" iconName="arrow-left" onClick={navigateBack} />} {...props}>
      {children}
    </AppBar>
  );
};

export default inject('leasingNavigator')(observer(AppBarBack));
