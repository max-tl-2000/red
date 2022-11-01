/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, computed } from 'mobx';
import { now } from '../../../common/helpers/moment-utils';

export default class PersonViewModel {
  @observable
  id;

  @observable
  fullName;

  @observable
  preferredName;

  @observable
  phone;

  @observable
  email;

  @observable
  contactInfo;

  @observable
  personId;

  @observable
  memberState;

  @observable
  memberType;

  @observable
  backendId;

  @observable
  guaranteedFullName;

  @computed
  get entityId() {
    return this.backendId || this.id;
  }

  constructor({
    id,
    fullName,
    preferredName,
    phone,
    email,
    contactInfo,
    personId,
    memberState,
    memberType,
    backendId,
    hasGuarantees,
    createdAt,
    primaryEmail,
    guaranteedFullName,
  }) {
    this.id = id;
    this.fullName = fullName;
    this.preferredName = preferredName;
    this.phone = phone;
    this.email = email;
    this.contactInfo = contactInfo;
    this.personId = personId;
    this.memberState = memberState;
    this.memberType = memberType;
    this.backendId = backendId;
    this.hasGuarantees = hasGuarantees;
    this.primaryEmail = primaryEmail;
    this.createdAt = createdAt || now(); // this will be replaced by the backend value
    this.guaranteedFullName = guaranteedFullName;
  }
}
