/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { zIndexManager } from '../../z-index-manager';
import { ZIndexHelper } from '../../../common/client/z-index-helper';
import { cf } from './GenericFlyOutContainer.scss';

@observer
class GenericFlyOutContainer extends Component {
  constructor(props) {
    super(props);
    this.zIndexHelper = new ZIndexHelper();
    this.checkZIndex();
  }

  checkZIndex() {
    const { childrenCount } = this.props;
    if (childrenCount > 0) {
      this.zIndexHelper.zIndex = zIndexManager.pushOverlay('GenericFlyOutContainer', this.zIndexHelper);
    } else {
      zIndexManager.removeOverlay('GenericFlyOutContainer');
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.childrenCount !== prevProps.childrenCount) {
      this.checkZIndex();
    }
  }

  componentWillUnmount() {
    zIndexManager.removeOverlay('GenericFlyOutContainer');
  }

  render() {
    const { children, childrenCount } = this.props;
    return (
      <div id="flyoutContainer" className={cf('docked-flyout-container', { on: childrenCount > 0 })} style={{ zIndex: this.zIndexHelper.zIndex }}>
        {children}
      </div>
    );
  }
}

export default GenericFlyOutContainer;
