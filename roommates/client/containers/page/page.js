/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { AppBar, AppBarMainSection, AppBarActions, Button, AppBarIconSection, Typography } from 'components';
import GeminiScrollbar from 'components/GeminiScrollbar/GeminiScrollbar';
import { t } from 'i18next';
import { replace, push } from '../../../../client/helpers/navigator';
import { cf, g } from './page.scss';

const { SubHeader } = Typography;

const renderAppBarMainSection = onMainSectionClick => <AppBarMainSection onClick={onMainSectionClick} />;

const renderAppBarIconSection = onAppBarIconSectionClick => (
  <AppBarIconSection className={cf('icon-section', { clickable: !!onAppBarIconSectionClick })} onClick={() => onAppBarIconSectionClick()}>
    <img src="/graphics/roommates/pm-logo-hor.svg" width={197} height={38} />
    <SubHeader className={cf('title')}>{t('ROOMMATES_TITLE').toUpperCase()}</SubHeader>
  </AppBarIconSection>
);

const renderAppBarActionsSection = (isAuthenticated, hideRegister, signOut, hideSignIn) => (
  <AppBarActions className={cf('app-bar-actions')}>
    <div className={cf('app-bar-action')}>
      {isAuthenticated && <Button style={{ color: '#000000' }} type="flat" btnRole="secondary" label={t('SIGN_OUT')} onClick={() => signOut()} />}
      {!isAuthenticated && !hideSignIn && <Button type="flat" btnRole="secondary" label={t('SIGN_IN')} onClick={() => push({ pathname: '/signin' })} />}
    </div>
    {!isAuthenticated && !hideRegister && (
      <div className={cf('app-bar-action')}>
        <Button label={t('REGISTER')} onClick={() => push({ pathname: '/register' })} />
      </div>
    )}
  </AppBarActions>
);

const renderAppBar = (customAppBar, isAuthenticated, onAppBarIconSectionClick, onMainSectionClick, hideRegister, notActions, signOut, hideSignIn) =>
  customAppBar || (
    <AppBar className={cf('app-bar')}>
      {renderAppBarIconSection(onAppBarIconSectionClick)}
      {renderAppBarMainSection(onMainSectionClick)}
      {!notActions && renderAppBarActionsSection(isAuthenticated, hideRegister, signOut, hideSignIn)}
    </AppBar>
  );

@inject('auth', 'home')
@observer
export class Page extends Component { // eslint-disable-line
  static propTypes = {
    appBar: PropTypes.object,
    className: PropTypes.string,
    extraAttributes: PropTypes.object,
    centerContent: PropTypes.bool,
    onAppBarIconSectionClick: PropTypes.func,
    onMainSectionClick: PropTypes.func,
    hideRegister: PropTypes.bool,
    hideSignIn: PropTypes.bool,
  };

  signOut = () => {
    const { auth, home } = this.props;
    auth.hydrate({
      token: null,
      user: null,
    });

    home.setMyRoommateProfile(null);

    const { tenantName, propertyName } = auth.propertyConfig;

    replace({ pathname: `/${tenantName}/${propertyName}` });
  };

  onAppBarIconSectionClick = () => {
    if (this.props.onAppBarIconSectionClick) {
      this.props.onAppBarIconSectionClick();
    } else {
      const { tenantName, propertyName } = this.props.auth.propertyConfig;
      replace({ pathname: `/${tenantName}/${propertyName}` });
    }
  };

  render() {
    const {
      className,
      children,
      customAppBar,
      extraAttributes,
      contentDirection,
      centerContent,
      onMainSectionClick,
      hideRegister,
      notActions,
      hideSignIn,
    } = this.props;

    const flexDirection = contentDirection === 'column' ? 'column-directtion' : 'row-directtion';

    return (
      <div data-component="page" className={cf('page', g(className))} {...extraAttributes}>
        {renderAppBar(
          customAppBar,
          this.props.auth.isAuthenticated,
          this.onAppBarIconSectionClick,
          onMainSectionClick,
          hideRegister,
          notActions,
          this.signOut,
          hideSignIn,
        )}
        <GeminiScrollbar className={cf('scrollable-content')}>
          <div
            className={cf('wrapper', flexDirection, {
              centerContent: !!centerContent,
            })}>
            <img className={cf('transparent-background')} src="/graphics/roommates/pm-logo.svg" />
            {children}
          </div>
        </GeminiScrollbar>
      </div>
    );
  }
}
