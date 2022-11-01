/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import { observer, inject } from 'mobx-react';

import * as T from '../../components/Typography/Typography';
import SVGLostImage from '../../../resources/pictographs/404-lost.svg';
import FormattedMarkdown from '../../components/Markdown/FormattedMarkdown';
import { cf } from './Page404.scss';
import Page from '../common/Page/Page';

const SignInBlock = ({ title, message, inline }) => (
  <div className={cf('signInBlock', { inline })}>
    <T.Title className={cf('signInTitle')}>{title}</T.Title>
    {message}
  </div>
);

@inject('screen', 'urls', 'tenant')
@observer
export default class Page404 extends Component {
  renderSignInBlocks = () => {
    const { urls, screen } = this.props;

    return (
      <div className={cf('signInBlocksSection')}>
        <SignInBlock
          inline={screen.isAtLeastMedium}
          title={t('I_ONLY_USE_REPORTING')}
          message={
            <FormattedMarkdown className={cf('block')}>
              {t('REVA_REPORTING_ACCOUNT_MESSAGE', { linkClassName: cf('link'), signinUrl: urls.reportingSignIn })}
            </FormattedMarkdown>
          }
        />
        <SignInBlock
          inline={screen.isAtLeastMedium}
          title={t('I_USE_REVA')}
          message={<FormattedMarkdown className={cf('block')}>{t('I_USE_REVA_MESSAGE')}</FormattedMarkdown>}
        />
      </div>
    );
  };

  getLostMessage = () => {
    const { urls, leasingMode } = this.props;

    if (leasingMode) return t('GO_BACK_HOME', { homeUrl: '/', linkClassName: cf('link') });

    return this.isSSO ? t('LOOKS_YOU_ARE_NOT_SIGNED_IN') : t('IF_HAVE_ACCOUNT_THEN_SIGN_IN', { signinUrl: urls.rentappSignIn, linkClassName: cf('link') });
  };

  get isSSO() {
    const {
      tenant: { name: tenantName },
      leasingMode,
    } = this.props;

    return !leasingMode && tenantName.toLowerCase() === 'sso';
  }

  render() {
    const { screen } = this.props;
    const height = screen.isAtLeastMedium ? '305' : null;

    const lostMessage = this.getLostMessage();

    return (
      <Page className={cf('page')}>
        <SVGLostImage width={screen.isAtLeastMedium ? '943' : '90%'} height={height} className={cf('image404')} />
        <div>
          <T.Headline className={cf('title', { xsmall: screen.isXSmall })}>{t('ARE_YOU_LOST_QUESTION')}</T.Headline>
          <FormattedMarkdown className={cf('block')}>{lostMessage}</FormattedMarkdown>
        </div>
        {this.isSSO && this.renderSignInBlocks()}
      </Page>
    );
  }
}
