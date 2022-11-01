/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Typography as T, Button } from 'components';
import { windowOpen } from 'helpers/win-open';
import { cf } from './FakeDocuSignPage.scss';

export default class FakeDocuSignPage extends Component {
  render() {
    if (!this.props) return <noscript />;

    const { confirmationURL, signerName, verb } = this.props && this.props.location.query;
    const signerNameId = signerName.replace(/\s/g, '_');

    return (
      <div className={cf('page')} data-component="fake-u-sign-page">
        <T.Headline>{'Welcome to Fake-u-Sign,'}</T.Headline>
        <T.Headline bold id={`${signerNameId}`}>{`${signerName}!`}</T.Headline>
        <T.Title>{`You may ${verb} this published lease by pressing the button below.`}</T.Title>
        <Button data-id="signButton" type="raised" btnRole="primary" label={`${verb} Lease`} onClick={() => windowOpen(confirmationURL, '_self')} />
      </div>
    );
  }
}
