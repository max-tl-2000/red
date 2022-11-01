/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { AppBar, IconButton, AppBarActions } from 'components';
import { cf, g } from './LeasePage.scss';

@observer
export class LeasePage extends Component { // eslint-disable-line
  static propTypes = {
    id: PropTypes.string,
    className: PropTypes.string,
    propertyName: PropTypes.string,
  };

  render() {
    const { className, children, appBar, id, propertyName, ...rest } = this.props;
    const content = children;

    return (
      <div id={id} data-component="page" className={cf('page', g(className))} {...rest}>
        <div className={cf('page-container')}>
          <AppBar
            title={propertyName}
            iconSectionClass={cf('icon-section')}
            className={cf('blue-header')}
            icon={<IconButton className={cf('icon')} iconName="property" />}>
            <AppBarActions />
          </AppBar>
          <div className={cf('page-content')}>{content}</div>
        </div>
      </div>
    );
  }
}
