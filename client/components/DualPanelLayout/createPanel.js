/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer } from 'mobx-react';
import elevationShadow from 'helpers/elevationShadow';
import { widthInColumns } from 'helpers/width-in-columns';
import $ from 'jquery';
import contains from 'helpers/contains';
import { cf, g } from './DualPanelLayout.scss';
import GeminiScrollbar from '../GeminiScrollbar/GeminiScrollbar';

export const createPanel = ({ elevation, panel, className: defaultClassName }) => {
  const $doc = $(document);

  @observer
  class Panel extends Component {
    handleClickOutside = e => {
      const viewArea = this.panel;
      const eventHappenedInsideOverlay = contains(viewArea, e.target);

      if (eventHappenedInsideOverlay) return;

      const { onClickOutside } = this.props;
      onClickOutside && onClickOutside(e);
    };

    componentDidMount() {
      const { onClickOutside } = this.props;
      if (!onClickOutside) return;
      $doc.on('mouseup', this.handleClickOutside);
    }

    componentWillUnmount() {
      $doc.off('mouseup', this.handleClickOutside);
    }

    render() {
      const {
        gutterWidth,
        totalColumns,
        last,
        gutterType,
        columns,
        useExtraBottomPadding,
        blocked,
        noOverflow,
        padContent,
        className,
        contentClassName,
        children,
        onClickOutside,
        floating,
        shadowLeft,
        height,
        width,
        ...rest
      } = this.props;

      let overlayStyle = {};

      if (columns) {
        overlayStyle = {
          ...widthInColumns(columns, {
            gutterWidth,
            totalColumns,
            last,
            gutterType,
          }),
        };
      }

      if (width) {
        overlayStyle.width = width;
      }

      const shadowStyle = {};
      if (elevation > 0) {
        shadowStyle.boxShadow = elevationShadow(elevation);
      }

      if (height) {
        overlayStyle.height = height;
      }

      return (
        <div ref={ref => (this.panel = ref)} style={overlayStyle} className={cf('panel', { floating, blocked }, g(className, defaultClassName))}>
          <GeminiScrollbar className={cf('scrollArea')} data-layout={panel} noOverflow={noOverflow} useExtraBottomPadding={useExtraBottomPadding} {...rest}>
            <div className={cf('pagePanel', g(contentClassName), { padContent })}>{children}</div>
          </GeminiScrollbar>
          {shadowLeft && <div className={cf('shadow')} style={shadowStyle} />}
        </div>
      );
    }
  }

  return Panel;
};
