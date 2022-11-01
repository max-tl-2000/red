/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component, Children, cloneElement } from 'react';
import { observer } from 'mobx-react';
import { isNumber } from 'helpers/type-of';
import SizeAware from '../SizeAware/SizeAware';
import { createPanel } from './createPanel';
import LayoutModel from './LayoutModel';
import { cf, g } from './DualPanelLayout.scss';

export const RightPanel = createPanel({ elevation: 4, panel: 'right-panel', className: cf('rightPanel') });
export const LeftPanel = createPanel({ elevation: 0, panel: 'left-panel', className: cf('leftPanel') });

const rightPanelType = (<RightPanel />).type;
const leftPanelType = (<LeftPanel />).type;
@observer
export class PanelsContainer extends Component {
  getPanels = () => {
    const { children } = this.props;

    return Children.toArray(children).reduce(
      (acc, child) => {
        if (child.type === leftPanelType) {
          acc.leftPanel = child;
        } else if (child.type === rightPanelType) {
          acc.rightPanel = child;
        } else {
          acc.others.push(child);
        }

        return acc;
      },
      { others: [] },
    );
  };

  onClickOutside = e => {
    const { onRightPanelClickOutside, model } = this.props;
    if (onRightPanelClickOutside) {
      const args = { target: e.target, cancel: false };
      onRightPanelClickOutside(args);
      if (args.cancel) return;
    }
    model.closeRightPanel();
  };

  render() {
    const { props, onClickOutside } = this;
    const { model, className, paddingTop = '4rem', customBreakpoints } = props;

    const { leftPanel, rightPanel, others } = this.getPanels();
    const pTop = isNumber(paddingTop) ? `${paddingTop}px` : paddingTop;
    const height = `calc(100vh - ${pTop})`;

    const breakpoints = customBreakpoints ?? { compact: [0, 840], normal: [841, Infinity] };

    return (
      <SizeAware className={cf('panelContainer', g(className))} breakpoints={breakpoints} onBreakpointChange={model.updateBreakpoint}>
        {cloneElement(leftPanel, { ...model.leftColumnProps, height })}
        {model.rightColumnIsVisible && model.compact && <div className={cf('overlay')} />}
        {model.rightColumnIsVisible &&
          cloneElement(rightPanel, { shadowLeft: true, onClickOutside: model.compact ? onClickOutside : undefined, ...model.rightColumnProps, height })}
        {others}
      </SizeAware>
    );
  }
}

export { LayoutModel };
