/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Section } from 'components';
import { t } from 'i18next';
import InventoryStepper from '../Inventory/InventoryStepper';

// eslint-disable-next-line
export default class InventoryStepperWrapper extends Component {
  render() {
    const { partyId, party, properties, isCorporateParty, onInventoryStepChange, isInventoryListVisible } = this.props;

    return (
      <Section data-id="preferencesSection" title={t('PREFERENCES_LABEL')} padContent={false}>
        <InventoryStepper
          partyId={partyId}
          onInventoryStepChange={onInventoryStepChange}
          properties={properties}
          qualificationQuestions={party.qualificationQuestions}
          isCorporateParty={isCorporateParty}
          isInventoryListVisible={isInventoryListVisible}
        />
      </Section>
    );
  }
}
