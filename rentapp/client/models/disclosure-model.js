/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed } from 'mobx';

export default class DisclosureModel {
  @observable
  selected;

  @observable
  description;

  @observable
  interacted;

  constructor({ id, selected, displayName, displayHelp, descriptionHelper, description }) {
    this.id = id;
    this.selected = selected;
    this.displayName = displayName;
    this.displayHelp = displayHelp;
    this.descriptionHelper = descriptionHelper;
    this.description = description;
    this.interacted = true;
  }

  @computed
  get serialized() {
    const { id, selected, displayName, displayHelp, descriptionHelper, description, isInteracted } = this;

    return {
      id,
      selected: !!selected,
      displayName,
      displayHelp,
      descriptionHelper,
      description,
      isInteracted,
    };
  }

  @action
  select(selected) {
    this.selected = selected;
  }

  @action
  updateDescription(description) {
    this.description = description;
  }

  @action
  updateInteracted(interacted) {
    this.interacted = interacted;
  }
}
