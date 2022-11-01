/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Dialog, DialogOverlay, Typography as T, DialogActions, Button, DialogHeader } from 'components';
import { t } from 'i18next';
import { cf } from './DeleteSickLeaveDialog.scss';

const renderDeletedSickLeaveRows = sickLeavesToDelete =>
  sickLeavesToDelete.map(sickLeave => {
    const { isAllDay, startHour, endHour, day, dayOfWeek } = sickLeave;
    const timeOfDay = isAllDay ? t('ALL_DAY_EVENT') : `${startHour} - ${endHour}`;
    return <T.Text key={`${dayOfWeek}-${day}`} className={cf('info-text')}>{`${dayOfWeek} - ${day}, ${timeOfDay}`}</T.Text>;
  });
export const DeleteSickLeaveDialog = props => {
  const { open, id, onClose, onDelete, sickLeavesToDelete } = props;
  const isSeriesSickLeave = sickLeavesToDelete.length > 1;
  const alertIcon = isSeriesSickLeave && 'alert';
  const label = isSeriesSickLeave ? t('DELETE_MULTIPLE_SICK_LEAVES') : t('DELETE_ONE_SICK_LEAVE');
  return (
    <Dialog open={open} id={id} onCloseRequest={onClose} forceFocusOnDialog closeOnEscape>
      <DialogOverlay className={cf('loading-dialog')} container={false}>
        <DialogHeader title={t('DELETE_SICK_LEAVE')} rightSideIcon={alertIcon} rightSideIconClassName={cf('right-icon')} />
        <T.Text className={cf('info-text')}>{label}</T.Text>
        {renderDeletedSickLeaveRows(sickLeavesToDelete)}
        <DialogActions className={cf('actions')}>
          <Button type="flat" btnRole="secondary" id="submitAssignedProperty" onClick={onClose} label={t('CLOSE')} />
          <Button type="flat" id="submitAssignedProperty" onClick={onDelete} label={t('DELETE')} />
        </DialogActions>
      </DialogOverlay>
    </Dialog>
  );
};
