/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observer, inject } from 'mobx-react';
import React, { Component } from 'react';
import Route from 'react-router/lib/Route';
import Router from 'react-router/lib/Router';
import MobxDevTools from 'mobx-react-devtools';
import { hot } from 'react-hot-loader';

import { Login } from '../login/login';
import { Registration } from '../registration/registration';
import { Register } from '../registration/register';
import { ConfirmRegister } from '../registration/confirm';
import { ResetPassword } from '../reset-password/reset-password';
import { Protected } from '../protected/protected';
import { NotFound } from '../not-found/not-found';
import { Form } from '../form/form';
import { Help } from '../help/help';
import { cf } from './root.scss';

@inject('auth')
@observer
class Root extends Component {
  // eslint-disable-line react/prefer-stateless-function

  requireAuth = (nextState, replace) => {
    const { auth } = this.props;

    if (!auth.isAuthenticated) {
      replace({
        pathname: '/login',
        state: { nextPathname: nextState.location.pathname },
      });
    }
  };

  render() {
    const { history } = this.props;
    return (
      <div className={cf('root')}>
        <Router history={history}>
          <Route path="/form" component={Form} />
          <Route path="/login" component={Login} />
          <Route path="/registration" component={Registration} />
          <Route path="/register" component={Register} />
          <Route path="/confirm" component={ConfirmRegister} />
          <Route path="/resetPassword" component={ResetPassword} />
          <Route path="/help" component={Help} />
          <Route path="/protected" component={Protected} onEnter={this.requireAuth} />
          <Route path="*" component={NotFound} />
        </Router>
        {__MOBX_DEVTOOLS__ && <MobxDevTools />}
      </div>
    );
  }
}

export default hot(module)(Root);
