/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action } from 'mobx';

export default class RoommateModel {
  @observable
  id;

  @observable
  email;

  @observable
  fullName;

  @observable
  preferredName;

  @observable
  moveInDateFrom;

  @observable
  moveInDateTo;

  @observable
  gender;

  @observable
  age;

  @observable
  collegeYear;

  @observable
  academicMajor;

  @observable
  preferLiveWith;

  @observable
  likeKeepApartment;

  @observable
  normallyWakeUp;

  @observable
  normallyGoBed;

  @observable
  likeStudyIn;

  @observable
  likeHaveGatheringsInApartment;

  @observable
  preferPetFreeApartment;

  @observable
  shouldKnowAboutMe;

  @observable
  personId;

  @observable
  email;

  @observable
  name;

  @observable
  details;

  @observable
  preferedMoveInDate;

  @observable
  contacted;

  updateFields(roommate) {
    Object.keys(this).forEach(key => {
      this[key] = roommate[key];
    });
  }

  constructor(roommate) {
    this.id = roommate.id;
    this.updateFields(roommate);
  }

  @action
  update(roommate) {
    this.updateFields(roommate);
  }
}
