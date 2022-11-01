/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import CollectionPanel from 'custom-components/CollectionPanel/CollectionPanel';
import { PetForm } from './PetForm';
import { PetCard } from './PetCard';
import { createPetFormModel } from './PetFormModel';
import { toLowerCaseTransKey } from '../../../../common/helpers/i18next-utils';

@observer
export default class PetCollection extends Component {
  static propTypes = {
    viewModel: PropTypes.object,
    useRevealingPanel: PropTypes.bool,
    restrictAddOrRemoveItems: PropTypes.bool,
    isLeaseDraft: PropTypes.bool,
    isLeasePublishedOrExecuted: PropTypes.bool,
  };

  setRef = (prop, instance) => {
    this[prop] = instance;
  };

  getRestrictAddOrRemoveItemsMsg = () => {
    const { isLeaseDraft = false, isLeasePublishedOrExecuted = false, partyClosedOrArchived } = this.props;
    if (partyClosedOrArchived) {
      return t('CANNOT_ADD_MEMBERS_TEXT_CLOSED', { memberType: t('PETS_AND_ASSISTANCE_ANIMALS') });
    }
    if (isLeaseDraft) {
      return t('CANNOT_ADD_PETS_TEXT_DRAFT_LEASE', { pets: t('PETS_AND_ASSISTANCE_ANIMALS') });
    }
    if (isLeasePublishedOrExecuted) {
      return t('CANNOT_ADD_PETS_TEXT', { pets: t('PETS_AND_ASSISTANCE_ANIMALS') });
    }
    return t('CANNOT_ADD_COLLECTION_TEXT_ACTIVE_LEASE', { collection: t('PETS_AND_ASSISTANCE_ANIMALS') });
  };

  render = ({ viewModel, useRevealingPanel = false, restrictAddOrRemoveItems = false } = this.props) => (
    <CollectionPanel
      ref={node => this.setRef('collectionPanel', node)}
      collectionPanelId="petCollectionPanel"
      entityLabel={'ANIMAL'}
      FormComponent={PetForm}
      EntityComponent={PetCard}
      contextMenuDefaults={true}
      emptyMessageStyle={{ padding: '1rem 1.5rem' }}
      collectionViewModel={viewModel}
      useRevealingPanel={useRevealingPanel}
      createFormModel={createPetFormModel}
      restrictAddOrRemoveItems={restrictAddOrRemoveItems}
      restrictAddOrRemoveItemsTitle={t('CANNOT_ADD_PETS', { pets: toLowerCaseTransKey('PETS_AND_ASSISTANCE_ANIMALS') })}
      restrictAddOrRemoveItemsMsg={this.getRestrictAddOrRemoveItemsMsg()}
    />
  );
}
