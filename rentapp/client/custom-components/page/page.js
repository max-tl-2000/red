/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import GeminiScrollbar from 'components/GeminiScrollbar/GeminiScrollbar';
import { cf, g } from './page.scss';
import { DefaultAppBar } from '../default-app-bar/default-app-bar';
@observer
export class Page extends Component { // eslint-disable-line
  static propTypes = {
    id: PropTypes.string,
    className: PropTypes.string,
    appBar: PropTypes.object,
  };

  render() {
    const { className, children, appBar, id, fixedHeader, ...rest } = this.props;
    const theAppBar = appBar || <DefaultAppBar />;
    let content = children;

    if (fixedHeader) {
      content = <GeminiScrollbar className={cf('scrollable-content')}>{content}</GeminiScrollbar>;
    }
    return (
      <div id={id} data-component="page" className={cf('page', g(className))} {...rest}>
        {theAppBar}
        {content}
      </div>
    );
  }
}
