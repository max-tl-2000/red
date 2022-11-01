/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { observer, inject } from 'mobx-react';
import { reaction } from 'mobx';
import { Typography as T, Revealer } from 'components';
import { t } from 'i18next';
import { cf } from './application-error-block.scss';
import SVGDesertImage from '../../../../resources/pictographs/404-desert.svg';
import Footer from '../../../../client/pages/common/Footer/Footer';

@inject('screen', 'application', 'agent')
@observer
export class ApplicationErrorBlock extends Component {
  static propTypes = {
    displayError: PropTypes.bool,
  };

  componentDidMount = () => {
    const { application } = this.props;
    application.isApplicantRemovedFromParty && this.fetchPartyAgentIfNeeded();
    this.stop = reaction(
      () => ({ isApplicantRemovedFromParty: application.isApplicantRemovedFromParty }),
      ({ isApplicantRemovedFromParty }) => {
        isApplicantRemovedFromParty && this.fetchPartyAgentIfNeeded();
      },
    );
  };

  componentWillUnmount = () => {
    this.stop && this.stop();
  };

  fetchPartyAgentIfNeeded = () => {
    const { agent, application } = this.props;
    if (agent.loadingAgent) return;
    !agent.isAgentReady && agent.fetchPartyAgent(application.partyId);
  };

  render() {
    const { application, screen } = this.props;
    const { isApplicantRemovedFromParty, isMemberRemovedFromParty, isPartyClosed } = application;

    const size = screen.isAtLeastMedium ? { width: 943, height: 305 } : {};
    const shouldShow = isApplicantRemovedFromParty || isMemberRemovedFromParty || isPartyClosed;

    return (
      <Revealer show={shouldShow}>
        <div className={cf('block_container')}>
          <div className={cf('block_description')}>
            <T.Title className={cf('title')} secondary>{`${t('APPLICATION_LINK_EXPIRED')}`}</T.Title>
            <T.SubHeader secondary>{`${t('ERROR_CODE', { errorCode: 404 })}`}</T.SubHeader>
            <T.SubHeader className={cf('message')}>{t('APPLICATION_LINK_EXPIRED_DESCRIPTION')}</T.SubHeader>
          </div>
          <SVGDesertImage {...size} />
          <Footer />
        </div>
      </Revealer>
    );
  }
}
