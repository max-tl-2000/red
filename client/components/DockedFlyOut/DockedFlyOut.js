/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { closeFlyout } from 'redux/modules/flyoutStore';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import generateId from 'helpers/generateId';
import { cf } from './DockedFlyOut.scss';
import DockedWindow from './DockedWindow';

// NOTE: this should be moved to custom components so it is bundled
// only with leasing module. For now this should be used pointing directly
// to this file and not from 'components/index'
@connect(
  () => ({}),
  (dispatch, props) =>
    bindActionCreators(
      {
        close: () => closeFlyout(props.flyoutId),
      },
      dispatch,
    ),
)
export default class DockedFlyOut extends Component {
  static propTypes = {
    flyoutId: PropTypes.string,
    close: PropTypes.func.isRequired,
  };

  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  onClose = (manuallyClosed, maximizeIfNecessary) => {
    const { onBeforeClose, close } = this.props;

    const { cancel } = (onBeforeClose && onBeforeClose(manuallyClosed, maximizeIfNecessary)) || {};
    if (cancel) return;
    close();
  };

  render() {
    const { id, children, displayHeader, title, style, windowIconName, dataId } = this.props;
    return (
      <div className={cf('docked-flyout-wrapper')}>
        <DockedWindow
          style={style}
          id={id || this.id}
          dataId={dataId}
          title={title}
          windowIconName={windowIconName || 'window-maximize'}
          onClose={this.onClose}
          displayHeader={displayHeader}>
          {children}
        </DockedWindow>
      </div>
    );
  }
}
