/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { connect } from 'react-redux';
import {
  getPropertyNameForParty,
  getNumberOfGuarantors,
  getActiveLeases,
  getAllApplicationsAreCompleted,
  getNumberOfPets,
  getPartyProgram,
  getPartyOwnerAgent,
} from 'redux/selectors/partySelectors';
import { PartySummary } from '../ProspectDetailPage/PartySummary/PartySummary';

const PartySummaryWrapper = ({
  ownerAgent,
  party,
  associatedProperty,
  filters,
  numberOfGuarantors,
  leases,
  partyMembers,
  allApplicationsAreCompleted,
  numberOfPets,
  partyProgram,
  timezone,
  partyIsRenewal,
  activeLeaseWorkflowData,
  communications,
  quotes,
  hasRenewalPartyActivePromotion,
  inventory,
  onManagePartyLinkClicked,
}) => (
  <PartySummary
    party={party}
    associatedProperty={associatedProperty}
    filters={filters}
    inventory={inventory}
    numberOfGuarantors={numberOfGuarantors}
    leases={leases.toArray()}
    partyMembers={partyMembers.toArray()}
    allApplicationsAreCompleted={allApplicationsAreCompleted}
    numberOfPets={numberOfPets}
    timezone={timezone}
    partyProgram={partyProgram}
    ownerAgent={ownerAgent}
    communications={communications}
    partyIsRenewal={partyIsRenewal}
    activeLeaseWorkflowData={activeLeaseWorkflowData}
    quotes={quotes}
    hasRenewalPartyActivePromotion={hasRenewalPartyActivePromotion}
    onManagePartyLinkClicked={onManagePartyLinkClicked}
  />
);

export default connect((state, props) => ({
  filters: state.unitsFilter.filters,
  communications: state.dataStore.get('communications'),
  quotes: state.quotes.quotes,
  associatedProperty: getPropertyNameForParty(state, props),
  numberOfGuarantors: getNumberOfGuarantors(state, props),
  numberOfPets: getNumberOfPets(state, props),
  ownerAgent: getPartyOwnerAgent(state, props),
  leases: getActiveLeases(state, props),
  allApplicationsAreCompleted: getAllApplicationsAreCompleted(state, props),
  partyProgram: getPartyProgram(state, props),
}))(PartySummaryWrapper);
