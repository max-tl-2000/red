/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import React from 'react';
import { MsgBox, FormattedMarkdown } from 'components';
import { toHumanReadableString } from '../../../../common/helpers/strings';
import { getDisplayName } from '../../../../common/helpers/person-helper';
import { getPartyMembersGroupedByType } from '../../../../common/helpers/party-utils';

const ResumeHoldGuarantorLinkedDialog = ({ open, closeDialog, partyMembers, onOKClick }) => {
  let guarantorNames = [];
  const { residents, guarantors } = getPartyMembersGroupedByType(partyMembers.toArray());
  // it can't be a party without residents no matter what, even if it has 1 or more guarantors
  if (residents.length) {
    const guarantorNoLinked = guarantors.filter(guarantor => residents.length && residents.every(resident => resident.guaranteedBy !== guarantor.id));
    guarantorNames = guarantorNoLinked.filter(guarantor => guarantor.person).map(guarantor => getDisplayName(guarantor.person));
  }

  const memberNames = toHumanReadableString(guarantorNames);
  return (
    <MsgBox
      open={open}
      title={t('GUARANTOR_LINKED_HOLD_DIALOG_TITLE', { count: guarantorNames.length })}
      lblOK={t('MANAGE_PARTY')}
      onOKClick={onOKClick}
      lblCancel={t('CLOSE')}
      onCloseRequest={closeDialog}
      content={<FormattedMarkdown>{t('GUARANTOR_LINKED_HOLD_DIALOG_CONTENT', { memberNames, count: guarantorNames.length })}</FormattedMarkdown>}
    />
  );
};

export default ResumeHoldGuarantorLinkedDialog;
