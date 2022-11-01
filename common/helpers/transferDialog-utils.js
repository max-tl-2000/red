/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { DALTypes } from '../enums/DALTypes';

const getTeamModule = (teamId, allTeams) => {
  const team = allTeams.find(item => item.id === teamId);
  return team?.module || '';
};

const getTeamName = (teamId, allTeams) => {
  const team = allTeams.find(item => item.id === teamId);
  return team?.displayName || '';
};

const getAssociatedPropertiesIds = associatedProperties => associatedProperties.map(property => property.id);

const getPropertyName = (properties, id) => {
  const property = properties.find(item => item.id === id);
  return property?.displayName || '';
};

export const getTranferPartyDialogData = ({ partyInfo, selectedItem, previsiousItemAssociatedProperties, allTeams }) => {
  const selectedTeamId = selectedItem?.isTeam ? selectedItem?.id : selectedItem?.teamId;
  const currentTeamModule = getTeamModule(partyInfo?.ownerTeam, allTeams);
  const selectedTeamModule = getTeamModule(selectedTeamId, allTeams);
  const currentAssociatedPropertiesIds = getAssociatedPropertiesIds(previsiousItemAssociatedProperties);
  const selectedAssociatedPropertiesIds = getAssociatedPropertiesIds(selectedItem.associatedProperties);

  // CASE 1: transferring parties between Hub (callCenter) and Property leasing team for the same primary property
  const transferPartyBetweenHubAndLeasigProperty = currentTeamModule === DALTypes.ModuleType.CALL_CENTER && selectedTeamModule === DALTypes.ModuleType.LEASING;

  // CASE 2: moving a party between teams that belong to different modules but share a property
  const transferPartyBetweenTeams =
    selectedAssociatedPropertiesIds.some(item => currentAssociatedPropertiesIds.includes(item)) && currentTeamModule !== selectedTeamModule;

  // CASE 3: moving a party between leasing teams that do not share a property
  const transferPartyBetweenProperties =
    currentTeamModule === DALTypes.ModuleType.LEASING &&
    selectedTeamModule === DALTypes.ModuleType.LEASING &&
    !selectedAssociatedPropertiesIds.some(item => currentAssociatedPropertiesIds.includes(item));

  const currentTeam = getTeamName(partyInfo?.ownerTeam, allTeams);
  const newTeam = getTeamName(selectedTeamId, allTeams);
  const currentPrimaryProperty = getPropertyName(previsiousItemAssociatedProperties, partyInfo.assignedPropertyId);
  const newPrimaryProperty = getPropertyName(selectedItem.associatedProperties, selectedItem.propertyId);

  if (!transferPartyBetweenHubAndLeasigProperty && (transferPartyBetweenTeams || transferPartyBetweenProperties)) {
    return {
      showDialog: true,
      content:
        transferPartyBetweenProperties && selectedItem.propertyId
          ? t('REASSIGN_PARTY_TO_PROPERTY', { currentPrimaryProperty, newPrimaryProperty })
          : t('REASSIGN_PARTY_TO_TEAM', { currentTeam, newTeam }),
    };
  }
  return { showDialog: false, content: '' };
};
