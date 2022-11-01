/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { observer } from 'mobx-react';
import ClosePartyDialog from '../ProspectDetailPage/ClosePartyDialog';

const ClosePartyDialogWrapper = ({ model, partyId, leaseNotExecuted, property }) => (
  <ClosePartyDialog open={model.isOpen} partyId={partyId} leaseNotExecuted={leaseNotExecuted} onCloseRequest={model.close} property={property} />
);

export default observer(ClosePartyDialogWrapper);
