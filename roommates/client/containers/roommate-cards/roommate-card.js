/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Card, Avatar, Truncate, Typography, Button } from 'components';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { t } from 'i18next';
import { cf } from './roommate-card.scss';
import SvgMenuDown from '../../../../resources/icons/menu-down.svg';
import SvgMenuUp from '../../../../resources/icons/menu-up.svg';
import { NotAllowedLayer } from '../../components/not-allowed-layer';
import { FullProfileView } from '../../components/full-profile-view/full-profile-view';
import { formatMoment } from '../../../../common/helpers/moment-utils';
import { DATE_US_FORMAT } from '../../../../common/date-constants';
const { SubHeader, Caption } = Typography;

const generateRandomColor = () => `#${Math.floor(Math.random() * 16777215).toString(16)}`;

const renderAvatar = roommateName => <Avatar lighter bgColor={generateRandomColor()} userName={roommateName} />;

const getRoommateMoveInDate = roommate =>
  `${t('ROOMMATE_PREFERRED_MOVE_IN')}: ${formatMoment(roommate.moveInDateFrom, { format: DATE_US_FORMAT })} ${t(
    'TO',
  ).toLowerCase()} ${formatMoment(roommate.moveInDateTo, { format: DATE_US_FORMAT })}`;

const renderDetails = roommate => (
  <div className={cf('info')}>
    <div className={cf('header')}>
      <SubHeader>{roommate.preferredName}</SubHeader>
      {roommate.contacted && <Caption secondary>{t('ROOMMATE_CONTACTED_STATUS')}</Caption>}
    </div>
    <Truncate className={cf('truncate')} direction="vertical" maxHeight={100}>
      <Caption> {getRoommateMoveInDate(roommate)}</Caption>
      <Caption secondary>{roommate.shouldKnowAboutMe}</Caption>
    </Truncate>
  </div>
);

@inject('auth')
@observer
export class RoommateCard extends Component { // eslint-disable-line
  static propTypes = {
    roommate: PropTypes.object,
  };

  static defaultProps = {
    roommate: {},
  };

  constructor(props, context) {
    super(props, context);
    this.state = {
      displayFullProfile: false,
    };
  }

  toggleFullProfile = () => {
    this.setState({ displayFullProfile: !this.state.displayFullProfile });
  };

  handleSelectContact = () => {
    const { roommate, onSelectContact } = this.props;
    onSelectContact && onSelectContact(roommate);
  };

  renderActions = () => (
    <div className={cf('actions-section')}>
      <Button useWaves type="flat" btnRole="secondary" label={t('ROOMMATE_CONNECT')} onClick={this.handleSelectContact} />
      <Button useWaves type="flat" btnRole="secondary" style={{ marginLeft: 8 }} className={cf('full-profile-btn')} onClick={this.toggleFullProfile}>
        <span className={cf('caption-text')}>{t('ROOMMATE_FULL_PROFILE')}</span>
        {this.state.displayFullProfile ? <SvgMenuUp /> : <SvgMenuDown />}
      </Button>
    </div>
  );

  render() {
    const { roommate } = this.props;
    return (
      <Card className={cf('card')} style={{ padding: 0 }}>
        {!this.props.auth.isAuthenticated && <NotAllowedLayer />}
        <div className={cf('details-container')}>
          <div className={cf('details')}>
            {renderAvatar(roommate.preferredName)}
            {renderDetails(roommate)}
          </div>
        </div>
        <div className={cf('footer-container')}>
          <div className={cf('footer')}>
            {this.renderActions()}
            {this.state.displayFullProfile && <FullProfileView profile={roommate} />}
          </div>
        </div>
      </Card>
    );
  }
}
