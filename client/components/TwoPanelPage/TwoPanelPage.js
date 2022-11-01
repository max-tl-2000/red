/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Children, Component, cloneElement } from 'react';
import { findDOMNode } from 'react-dom';
import { sizes, screenIsAtLeast } from 'helpers/layout';
import contains from 'helpers/contains';
import $ from 'jquery';
import { cf, g } from './TwoPanelPage.scss';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';

import AutoSize from '../AutoSize/AutoSize';
import GeminiScrollbar from '../GeminiScrollbar/GeminiScrollbar';
import { document } from '../../../common/helpers/globals';

const leftPanelType = (<LeftPanel />).type;
const rightPanelType = (<RightPanel />).type;

const $doc = $(document);

export default class TwoPanelPage extends Component {
  static propsType = {
    responsiveState: PropTypes.oneOf(['row', 'column']),
  };

  static defaultProps = {
    responsiveState: 'column',
  };

  constructor(props, context) {
    super(props, context);
    this.state = { navOpen: false };
  }

  componentWillReceiveProps({ screenSize }) {
    if (screenIsAtLeast(screenSize, sizes.small2)) {
      this.closePanel();
    }
  }

  get $domNode() {
    if (!this._$domNode) {
      this._$domNode = $(findDOMNode(this));
    }
    return this._$domNode;
  }

  _removeCheckForClickOutside() {
    $doc.off('.ns_twoPagePanel');
  }

  _checkForClicksOutside() {
    const { onMouseUpOutside } = this.props;
    $doc.on('mouseup.ns_twoPagePanel', e => {
      if (!this.isOpen) {
        return;
      }
      const rightPanelDOM = this.$domNode.find('[data-layout="right-panel"]')[0];
      const eventHappenedInsideOverlay = contains(rightPanelDOM, e.target);

      if (eventHappenedInsideOverlay || (onMouseUpOutside && onMouseUpOutside(e.target))) {
        return;
      }

      this.closePanel();
    });
  }

  componentWillUnmount() {
    this._removeCheckForClickOutside();
  }

  toggle = () => {
    if (this.isOpen) {
      this.closePanel();
      return;
    }
    this.openPanel();
  };

  get isOpen() {
    return !!this.state.navOpen;
  }

  openPanel = () => {
    if (this.isOpen) return;

    this.setState({
      navOpen: true,
    });

    this._checkForClicksOutside();
  };

  closePanel = () => {
    if (!this.isOpen) return;

    this.setState({
      navOpen: false,
    });

    this._removeCheckForClickOutside();
  };

  render() {
    const {
      className,
      children,
      screenSize, // eslint-disable-line
      onMouseUpOutside, // eslint-disable-line
      responsiveState,
      ...props
    } = this.props;
    const { navOpen } = this.state;

    const childrenArray = Children.toArray(children);

    const [leftPanel] = childrenArray.filter(child => child.type === leftPanelType);
    const [rightPanel] = childrenArray.filter(child => child.type === rightPanelType);

    if (!leftPanel || !rightPanel) {
      return <noscript />; // just render something that doesn't have a visual rep.
    }

    const rowStateEnabled = responsiveState === 'row';

    if (!rowStateEnabled) {
      return (
        <div className={cf('pageStyle', g(className))} data-side-panel-state={navOpen ? 'open' : 'close'} data-responsive-state={responsiveState} {...props}>
          {cloneElement(leftPanel, { renderGeminiScrollbar: true })}
          {cloneElement(rightPanel, { renderGeminiScrollbar: true })}
          <div className={cf('left-panel-overlay')} />
        </div>
      );
    }

    return (
      <AutoSize breakpoints={{ row: [0, 960], column: [961, Infinity] }}>
        {({ breakpoint: gridType }) => {
          const renderScrollbar = !(rowStateEnabled && gridType === 'row');
          return (
            <div
              className={cf('pageStyle', g(className))}
              data-side-panel-state={navOpen ? 'open' : 'close'}
              data-responsive-state={responsiveState}
              {...props}>
              {!renderScrollbar && (
                <GeminiScrollbar className={cf('wrapper-panel')}>
                  {cloneElement(leftPanel, {
                    renderGeminiScrollbar: renderScrollbar,
                  })}
                  {cloneElement(rightPanel, {
                    renderGeminiScrollbar: renderScrollbar,
                  })}
                </GeminiScrollbar>
              )}
              {renderScrollbar &&
                cloneElement(leftPanel, {
                  renderGeminiScrollbar: renderScrollbar,
                })}
              {renderScrollbar &&
                cloneElement(rightPanel, {
                  renderGeminiScrollbar: renderScrollbar,
                })}
            </div>
          );
        }}
      </AutoSize>
    );
  }
}
