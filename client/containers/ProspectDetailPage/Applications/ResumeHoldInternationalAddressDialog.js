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

const ResumeHoldInternationalAddressDialog = ({ open, closeDialog, partyMembers }) => {
  const partyMembersWithInternationalAddress = partyMembers.toArray().filter(member => {
    const { application } = member;
    return application && application.applicationData && application.applicationData.haveInternationalAddress;
  });
  const personNames = partyMembersWithInternationalAddress.filter(member => member.person).map(member => getDisplayName(member.person));

  const memberNames = toHumanReadableString(personNames);
  return (
    <MsgBox
      open={open}
      title={t('INTERNATIONAL_HOLD_DIALOG_TITLE', { count: personNames.length })}
      lblOK={t('OK_GOT_IT')}
      hideCancelButton
      onCloseRequest={closeDialog}
      content={<FormattedMarkdown>{t('INTERNATIONAL_HOLD_DIALOG_CONTENT', { memberNames, count: personNames.length })}</FormattedMarkdown>}
    />
  );
};

export default ResumeHoldInternationalAddressDialog;
