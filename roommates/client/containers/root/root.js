/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observer, inject } from 'mobx-react';
import React, { Component } from 'react';
import Router from 'react-router/lib/Router';
import MobxDevTools from 'mobx-react-devtools';
import { Home } from '../home/home';
import { Profile } from '../profile/profile';
import { Register } from '../registration/register';
import { SignIn } from '../sign-in/sign-in';
import { ConfirmRegister } from '../registration/confirm';
import { ResetPassword } from '../reset-password/reset-password';
import { cf } from './root.scss';
import { push as navigatorPush } from '../../../../client/helpers/navigator';

@inject('auth', 'location')
@observer
export default class Root extends Component {
  // eslint-disable-line react/prefer-stateless-function

  constructor(props) {
    super(props);

    this.propertyConfigTemplateUrl = '/:tenantName/:propertyName';
    const temporalParkmercedUrl = '/:tenantName/swparkme'; // TODO: This is a temp url until Parkmerced property is available

    const routes = {
      childRoutes: [
        {
          path: temporalParkmercedUrl,
          component: Home,
          onEnter: this.handleOnParkmercedEnter,
          noAuthRequired: true,
        }, // TODO: This is a temp url handler until Parkmerced property is available
        {
          path: this.getBaseUrl(props),
          component: Home,
          onEnter: this.handleOnEnter,
          noAuthRequired: true,
        },
        { path: '/profile', onEnter: this.addBaseUrl },
        {
          path: `${this.propertyConfigTemplateUrl}/profile`,
          component: Profile,
          onEnter: this.handleOnEnter,
          noAuthRequired: false,
        },
        { path: '/register', onEnter: this.addBaseUrl },
        {
          path: `${this.propertyConfigTemplateUrl}/register`,
          component: Register,
          onEnter: this.handleOnEnter,
          noAuthRequired: true,
        },
        { path: '/confirm', onEnter: this.addBaseUrl },
        {
          path: `${this.propertyConfigTemplateUrl}/confirm`,
          component: ConfirmRegister,
          onEnter: this.handleOnEnter,
          noAuthRequired: true,
        },
        { path: '/resetPassword', onEnter: this.addBaseUrl },
        {
          path: `${this.propertyConfigTemplateUrl}/resetPassword`,
          component: ResetPassword,
          onEnter: this.handleOnEnter,
          noAuthRequired: false,
        },
        { path: '/signin', onEnter: this.addBaseUrl },
        {
          path: `${this.propertyConfigTemplateUrl}/signin`,
          component: SignIn,
          onEnter: this.handleOnEnter,
          noAuthRequired: true,
        },
        { path: '/', onEnter: this.checkUserIsLoggedIn },
      ],
    };

    this.state = { routes };
  }

  getBaseUrl = props =>
    props.auth.propertyConfig.tenantName && props.auth.propertyConfig.propertyName
      ? `/${props.auth.propertyConfig.tenantName}/${props.auth.propertyConfig.propertyName}`
      : this.propertyConfigTemplateUrl;

  addBaseUrl = ({ location }, replace) => {
    const baseUrl = this.getBaseUrl(this.props);
    replace(`${baseUrl}${location.pathname}`);
  };

  checkUserIsLoggedIn = ({ location }, replace) => {
    // TODO: This function will be used for other paths
    this.props.location.updatePath(location.pathname);
    const baseUrl = this.getBaseUrl(this.props);

    if (this.props.auth.isAuthenticated) {
      replace(baseUrl);
    } else {
      replace(`${baseUrl}/signin`);
    }
  };

  handleOnEnter = ({ routes }, replace) => {
    // routes parameter is an array with 2 elements:
    //
    // - the first element (index 0) is all the provided routes
    // - and the second element is the current matched route (index 1)
    //
    // we need the current matched route object as we store some
    // metadata on that element to decide if a given route needs
    // or not authenticated sesions
    const matched = routes[1];
    // wonder why we didn't use the matched.path
    // instead... matched.path is the raw route
    if (matched.noAuthRequired) {
      return;
    }

    const { auth } = this.props;

    if (!auth.isAuthenticated) {
      // TODO: this should redirect to auth login
      replace('/');
    }
  };

  handleOnParkmercedEnter = ({ location }) => {
    // TODO: This is a temp handler where it checks if the path has swparkme property and replace the path with Parkmerced
    this.props.location.updatePath(location.pathname);
    const path = location.pathname.split('/');

    if (this.props.auth.propertyConfig.propertyName === 'Parkmerced' && path.length > 2 && path[2] === 'swparkme') {
      navigatorPush(`/${path[1]}/${this.props.auth.propertyConfig.propertyName}`);
    }
  };

  render() {
    const { history } = this.props;
    const { routes } = this.state;

    return (
      <div className={cf('root')}>
        <Router history={history} routes={routes} />
        {__MOBX_DEVTOOLS__ && <MobxDevTools />}
      </div>
    );
  }
}
