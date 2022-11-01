/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed } from 'mobx';

interface IAuthUser {
  id: string;
  fullName: string;
  email: string;
  tenantId: string;
}

interface IAuth {
  token: string;
  user?: IAuthUser;
  isAuthenticated: boolean;

  setTokenAndUser(user: IAuthUser, token: string): void;

  clearTokenAndUser(): void;
}

export class Auth implements IAuth {
  @observable
  token: string = '';

  @observable
  user?: IAuthUser;

  @action
  setTokenAndUser(user: IAuthUser, token: string) {
    this.user = user;
    this.token = token;
  }

  @action
  clearTokenAndUser() {
    this.token = '';
    this.user = undefined;
  }

  @computed
  get isAuthenticated() {
    return !!this.token;
  }
}
