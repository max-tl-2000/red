/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { getPreviousPath, clearPreviousPath } from 'helpers/auth-helper';
import { replace } from 'helpers/navigator';
import injectProps from '../../helpers/injectProps';
import SignIn from '../SignIn/SignIn';
import AutoLogin from '../SignIn/AutoLogin';
import Dashboard from '../Dashboard/Dashboard';
import TenantAdmin from '../Tenants/TenantAdmin';
import TenantsList from '../Tenants/TenantsList';
import { isAdmin } from '../../../common/helpers/auth';
// since this component uses the connect decorator it is better to
// keep it like it is and not transform it to a stateless function
@connect(state => ({
  user: state.auth.user,
  loggingOut: state.auth.loggingOut,
}))
export default class Home extends Component {
  // eslint-disable-line
  static propTypes = {
    user: PropTypes.object,
  };

  get previousPath() {
    return getPreviousPath();
  }

  handleSignIn = () => {
    const { previousPath } = this;

    // redirect to the last path
    // that was rejected because of
    // the lack of session
    if (previousPath) {
      const MS_BEFORE_REDIRECT = 300;

      setTimeout(() => {
        clearPreviousPath();
        // navigate to the previous path
        replace(previousPath);
      }, MS_BEFORE_REDIRECT);
    }
  };

  @injectProps
  render({ user, loggingOut }) {
    // if we have a previous path
    // we will perform a redirect
    // after login
    const { previousPath } = this;

    if (user && user.tenantId === 'admin') {
      return <TenantsList />;
    }

    if (user && isAdmin(user)) {
      return <TenantAdmin location={this.props.location} />;
    }

    // so if the previousPath is defined that means
    // we don't need to render nothing on this turn
    // as a redirection will happen after
    if (user && !loggingOut && !previousPath) {
      return <Dashboard />;
    }

    if (this.props.location?.query?.autoLogin) {
      return <AutoLogin location={this.props.location} onSignIn={this.handleSignIn} />;
    }

    return <SignIn onSignIn={this.handleSignIn} />;
  }
}
