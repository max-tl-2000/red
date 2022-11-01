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
import { toLowerCaseTransKey } from '../../../../common/helpers/i18next-utils';
import { ChildrenForm } from './ChildrenForm';
import { ChildrenCard } from './ChildrenCard';
import { createChildrenFormModel } from './ChildrenFormModel';

@observer
export default class ChildrenCollection extends Component {
  static propTypes = {
    viewModel: PropTypes.object,
    useRevealingPanel: PropTypes.bool,
  };

  setRef = (prop, instance) => {
    this[prop] = instance;
  };

  render = ({ viewModel, useRevealingPanel = false, restrictAddOrRemoveItems = false, partyClosedOrArchived } = this.props) => (
    <CollectionPanel
      ref={node => this.setRef('collectionPanel', node)}
      collectionPanelId="childCollectionPanel"
      entityLabel={'MINOR'}
      FormComponent={ChildrenForm}
      EntityComponent={ChildrenCard}
      contextMenuDefaults={true}
      emptyMessageStyle={{ padding: '1rem 1.5rem' }}
      collectionViewModel={viewModel}
      useRevealingPanel={useRevealingPanel}
      createFormModel={createChildrenFormModel}
      restrictAddOrRemoveItems={restrictAddOrRemoveItems}
      restrictAddOrRemoveItemsTitle={t('CANNOT_ADD_COLLECTION_TITLE', { collection: toLowerCaseTransKey('MINORS') })}
      restrictAddOrRemoveItemsMsg={
        partyClosedOrArchived
          ? t('CANNOT_ADD_MEMBERS_TEXT_CLOSED', { memberType: t('MINORS') })
          : t('CANNOT_ADD_COLLECTION_TEXT_ACTIVE_LEASE', { collection: t('MINORS') })
      }
    />
  );
}
