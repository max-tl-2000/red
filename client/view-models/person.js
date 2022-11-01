/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { DALTypes } from '../../common/enums/DALTypes';
import trim from '../../common/helpers/trim';
import { getDisplayName } from '../../common/helpers/person-helper';

export default class PersonViewModel {
  constructor(person) {
    this.person = person;
  }

  get anyName() {
    const { person } = this;
    return person.preferredName || person.fullName;
  }

  static create(person) {
    return new PersonViewModel(person);
  }

  get companyName() {
    return trim(this.person.companyName);
  }

  get preferredName() {
    return this.person.preferredName;
  }

  get fullName() {
    return this.person.fullName;
  }

  get phones() {
    const { person } = this;
    const { phones = [] } = person.contactInfo || {};

    return phones;
  }

  get emails() {
    const { person } = this;
    const { emails = [] } = person.contactInfo || {};

    return emails;
  }

  get isGuarantor() {
    const { person } = this;
    return person.memberType === DALTypes.MemberType.GUARANTOR;
  }

  get hasGuarantees() {
    const { person } = this;
    return person.hasGuarantees;
  }

  get noContactInfo() {
    const { person } = this;
    const { phones = [], emails = [] } = person.contactInfo || {};

    return !phones.length && !emails.length;
  }

  get unknownName() {
    const { person } = this;
    return !person.preferredName && !person.fullName;
  }

  getDisplayName() {
    const { person } = this;
    return getDisplayName(person);
  }

  get guarantor() {
    const { person } = this;
    return person.guarantor;
  }

  get resident() {
    const { person } = this;
    const { partyMembers, memberId } = person;
    const linkedResident = partyMembers.filter(member => member.guaranteedBy === memberId);
    if (linkedResident.length > 1) return t('RESIDENTS_LINKED', { count: linkedResident.length });
    if (linkedResident.length === 1) return linkedResident[0].person.displayName;
    return null;
  }

  get strongMatchCount() {
    const { person } = this;
    return person.strongMatchCount;
  }
}
