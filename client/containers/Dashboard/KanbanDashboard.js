/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import $ from 'jquery';
import { t } from 'i18next';
import { Button, Typography } from 'components';
import { KanbanColumn, columnsPerScreen } from './KanbanColumns';
import { cf, g } from './Dashboard.scss';
import KanbanNavigator from './KanbanNavigator';
import { window } from '../../../common/helpers/globals';
import TelephonyErrorBanner from '../Telephony/TelephonyErrorBanner';
const kanbanColumnType = (<KanbanColumn />).type;

const { Text } = Typography;

export default class KanbanDashboard extends Component {
  static propTypes = {
    setColumnPosition: PropTypes.func,
    columnPosition: PropTypes.number,
    children: (props, propName, componentName) => {
      let error;
      const prop = props[propName];

      React.Children.forEach(prop, child => {
        if (child.type !== kanbanColumnType) {
          error = new Error(`${componentName} only accepts children of type KanbanColumn.`);
        }
      });

      return error;
    },
  };

  componentDidMount() {
    this.setKanbanView();
    const $win = (this.$win = $(window));

    $win.on('window:resize.KanbanDashboard', () => {
      this.setKanbanView();
    });
  }

  componentWillUnmount() {
    this.$win.off('.KanbanDashboard');
  }

  constructor(props) {
    super(props);
    this.state = {
      showNav: true,
      styleWidth: '100%',
      styleLeft: '0px',
    };
  }

  setKanbanView() {
    const colCount = this.getColumnCount();
    const colView = columnsPerScreen();
    const overflow = colCount > colView;
    const colWidth = 100 / (overflow ? colView : colCount);
    let position = this.props.columnPosition;

    this.setState({
      showNav: overflow,
      styleWidth: `calc(${colWidth * colCount}% - 12rem)`,
    });

    for (const swimlane of this.KanbanContainer.childNodes) {
      swimlane.style.width = `calc(${colWidth}% - 1rem)`;
    }

    if (colCount - position < colView) {
      position = colCount >= colView ? colCount - colView : 0;
      this.props.setColumnPosition(position);
    }

    setTimeout(() => this.setKanbanPosition(position));
  }

  navigateLeft = () => {
    if (this.props.columnPosition > 0) {
      const position = this.props.columnPosition - 1;
      this.props.setColumnPosition(position);
      this.setKanbanPosition(position);
    }
  };

  navigateRight = () => {
    const colCount = this.getColumnCount();
    const colView = columnsPerScreen();

    if (colCount - this.props.columnPosition > colView) {
      const position = this.props.columnPosition + 1;
      this.props.setColumnPosition(position);
      this.setKanbanPosition(position);
    }
  };

  setKanbanPosition(position) {
    const size = this.getColumnSize();

    this.setState({
      styleLeft: `${-position * size}px`,
    });
  }

  getColumnSize() {
    return this.KanbanContainer && this.KanbanContainer.children[0].offsetWidth;
  }

  getColumnCount() {
    return this.KanbanContainer && this.KanbanContainer.childElementCount;
  }

  storeKanbanContainerRef = ref => {
    this.KanbanContainer = ref;
  };

  render() {
    const { isPlivoConnectionError, plivoConnectionErrorReason } = this.props;
    const { showNav, styleWidth, styleLeft } = this.state;
    const kanbanColumnStyle = cf(g('kanbanColumn', { 'hide-nav': showNav }));
    const kanbanStyle = {
      width: styleWidth,
      transform: `translateX(${styleLeft})`,
    };
    const { nextMatchParty, displayDuplicatePersonNotification, shouldLeaveRoomForBanner } = this.props;

    return (
      <div className={cf('dashboardContainer')}>
        <div className={cf('kanbanPlaceholder')} />
        {isPlivoConnectionError && <TelephonyErrorBanner className={cf('telephonyErrorBanner')} reason={plivoConnectionErrorReason} />}
        {!isPlivoConnectionError && !!nextMatchParty && displayDuplicatePersonNotification && !!nextMatchParty.id && (
          <div className={cf('banner')} data-id="possibleDuplicateBanner">
            <Text data-id="possibleDuplicateTxt">{t('STRONG_MATCH_DASHBOARD_BANNER_TEXT')}</Text>
            <Button
              id="reviewMatchesBtn"
              btnRole={'primary'}
              type={'raised'}
              label={t('STRONG_MATCH_DASHBOARD_BANNER_BUTTON')}
              onClick={() => this.props.navigateToNextMatch(this.props.nextMatchParty, this.props.nextMatchPersonId)}
            />
          </div>
        )}
        <div className={kanbanColumnStyle}>
          <div className={cf(g('kanbanContainer', { shouldLeaveRoomForBanner }))} ref={this.storeKanbanContainerRef} style={kanbanStyle}>
            {this.props.children}
          </div>
        </div>
        <KanbanNavigator ref="KanbanNavigator" show={showNav} onLeft={this.navigateLeft} onRight={this.navigateRight} />
      </div>
    );
  }
}
