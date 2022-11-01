/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import React from 'react';
import { CardMenu, CardMenuItem, RedList } from 'components';
import { FadvRequestTypes } from 'enums/fadvRequestTypes';
const { Divider } = RedList;

const HoldApplicationScreeningMenu = ({
  screeningHoldTypes,
  hasApplicationScreeningStarted,
  onExecuteHoldManual,
  onResumeHoldManual,
  onResumeHoldInternational,
  onResumeHoldGuarantorLinked,
  onRerunScreening,
  onForceRescreening,
  onShowApplications,
  showApplicationsMenuItem,
  showRevaAdminOptions = false,
  disableReRunScreening,
  disableShowPastApplications,
}) => {
  const { isManualHoldType, isInternationalHoldType, isGuarantorLinkedHoldType } = screeningHoldTypes;
  const handleForceModifyScreening = () => onForceRescreening(FadvRequestTypes.MODIFY);
  const handleForceNewScreening = () => onForceRescreening(FadvRequestTypes.NEW);
  const handleForceResetCreditScreening = () => onForceRescreening(FadvRequestTypes.RESET_CREDIT);

  const renderForceRescreeningOptions = () => (
    <div>
      <Divider />
      <CardMenuItem text={t('FORCE_FADV_MODIFY')} onClick={handleForceModifyScreening} />
      <CardMenuItem text={t('FORCE_FADV_NEW')} onClick={handleForceNewScreening} />
      <CardMenuItem text={t('RECONCILE_CREDIT_FREEZE')} onClick={handleForceResetCreditScreening} />
    </div>
  );

  return (
    <CardMenu iconName="dots-vertical" triggerProps={{ 'data-id': 'holdApplicationScreeningMenu' }}>
      <CardMenuItem text={t('RERUN_SCREENING')} onClick={onRerunScreening} disabled={disableReRunScreening} />
      {!isManualHoldType && (
        <CardMenuItem
          data-id="holdScreeningByManualOption"
          text={t('MANUAL_HOLD_EXECUTE')}
          onClick={onExecuteHoldManual}
          disabled={hasApplicationScreeningStarted}
        />
      )}
      {isManualHoldType && <CardMenuItem data-id="releaseScreeningByManualOption" text={t('MANUAL_HOLD_RESUME')} onClick={onResumeHoldManual} />}
      {isInternationalHoldType && <CardMenuItem text={t('INTERNATIONAL_HOLD_RESUME')} onClick={onResumeHoldInternational} />}
      {isGuarantorLinkedHoldType && <CardMenuItem text={t('GUARANTOR_LINKED_HOLD_RESUME')} onClick={onResumeHoldGuarantorLinked} />}
      {showRevaAdminOptions && renderForceRescreeningOptions()}
      {showApplicationsMenuItem && <CardMenuItem text={t('SHOW_PAST_APPLICATIONS')} disabled={disableShowPastApplications} onClick={onShowApplications} />}
    </CardMenu>
  );
};

export default HoldApplicationScreeningMenu;
