/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Menu, MenuItem, RedList as L } from 'components';
import { t } from 'i18next';
import { DALTypes } from 'enums/DALTypes';
import { isResident, isOccupant } from '../../../common/helpers/party-utils';
const getIdForMemberItem = (memberType, action) => {
  if (memberType === DALTypes.MemberType.RESIDENT) return `${action}InResidentMenuItem`;
  return `${action}InGuarantorMenuItem`;
};

const linkToEntity = (selectedMember, members) => {
  const hasGuarantor = !!selectedMember.guaranteedBy;
  const hasResidents = members.some(member => member.guaranteedBy === selectedMember.id);
  const oppositeMemberType = (isResident(selectedMember) ? DALTypes.MemberType.GUARANTOR : DALTypes.MemberType.RESIDENT).toUpperCase();

  const memberType = t(oppositeMemberType).toLowerCase();
  if (hasGuarantor || hasResidents) return `${t('EDIT_MEMBER_TYPE_LINK', { memberType })}`;
  return `${t('LINK_MEMBER_TYPE', { memberType })}`;
};

const renderMoveToOptionsFor = (memberType, allowOccupants) =>
  [DALTypes.MemberType.RESIDENT, DALTypes.MemberType.GUARANTOR, ...(allowOccupants ? [DALTypes.MemberType.OCCUPANT] : [])]
    .filter(type => type !== memberType)
    .map(type => {
      const moveMemberType = t(type.toUpperCase(), { count: 2 }).toLowerCase();
      return (
        <MenuItem
          id={getIdForMemberItem(memberType, `moveTo${moveMemberType}`)}
          key={type}
          text={`${t('MOVE_TO')} ${moveMemberType}`}
          action="moveTo"
          data-member-type={type}
        />
      );
    });

const ResidentContextMenu = ({
  className,
  showExtended,
  allowLinkMembers,
  allowOccupants,
  displayDuplicatePersonNotification,
  showSendResidentAppInvite,
  selectedPersonEmail,
  appName,
  ...rest
}) => {
  const { selectedMember = {}, members, isPartyLevelGuarantor } = rest;
  const isOccupantMember = isOccupant(selectedMember);
  const personHasStrongMatch = selectedMember.person && selectedMember.person.strongMatchCount > 0;
  const canLinkMembers = showExtended && !isOccupantMember && allowLinkMembers && !isPartyLevelGuarantor;

  return (
    <Menu id={selectedMember.id} className={className} {...rest}>
      {displayDuplicatePersonNotification && personHasStrongMatch && (
        <MenuItem id={getIdForMemberItem(selectedMember.memberType, 'viewDuplicates')} text={t('VIEW_DUPLICATES')} action="edit" />
      )}
      <MenuItem id={getIdForMemberItem(selectedMember.memberType, 'edit')} text={t('EDIT_CONTACT_INFORMATION')} action="edit" />
      <MenuItem id={getIdForMemberItem(selectedMember.memberType, 'open')} text={t('OPEN_DETAILS')} action="open" />
      <L.Divider />
      {showExtended && renderMoveToOptionsFor(selectedMember.memberType, allowOccupants)}
      {canLinkMembers && <MenuItem id={getIdForMemberItem(selectedMember.memberType, 'link')} text={linkToEntity(selectedMember, members)} action="link" />}
      {showExtended && <L.Divider />}
      {showSendResidentAppInvite && (
        <MenuItem
          id={`sendResidentAppInvite${selectedMember.memberType}MenuItem`}
          text={t('SEND_INVITE_TO_JOIN_THE_APP', { appName })}
          action={selectedPersonEmail ? 'send-resident-app-invite' : 'cannot-send-app-invite'}
        />
      )}
      <MenuItem id={`removeFromPartyIn${selectedMember.memberType}MenuItem`} text={t('REMOVE_FROM_PARTY')} action="remove-from-party" />
    </Menu>
  );
};

export default ResidentContextMenu;
