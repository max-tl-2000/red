/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { RedTable } from 'components';
import { formatPhone } from '../../../common/helpers/phone-utils';
import { toMoment } from '../../../common/helpers/moment-utils';
import { UTC_TIMEZONE, MONTH_DATE_YEAR_LONG_FORMAT } from '../../../common/date-constants';
import { cf } from './ProgramsList.scss';
import { isInactiveProgram } from '../../../common/helpers/programs';

const { Table, Row, RowHeader, Cell, TextPrimary } = RedTable;

const getDisplayName = (entities, id) => (entities.find(e => e.id === id) || {}).displayName;

const getProgramFallbackName = (program, programs) => {
  if (!!program.endDate && !program.programFallbackId) return t('NONE');
  const fallbackProgram = programs.find(p => p.programId === program.programFallbackId);
  return fallbackProgram?.name || '';
};

const getStatus = endDate => {
  if (!endDate) return t('ACTIVE_PROGRAM');
  if (isInactiveProgram(endDate)) return t('INACTIVE_PROGRAM');
  const endDateMoment = toMoment(endDate, { timezone: UTC_TIMEZONE });

  return `${t('FUTURE_INACTIVE_PROGRAM', {
    endDate: endDateMoment.format(MONTH_DATE_YEAR_LONG_FORMAT),
  })}`;
};

const ProgramsList = ({ teams, properties, programs }) => {
  const rows = programs.map(program => {
    const isRowInactive = isInactiveProgram(program.endDate);
    return (
      <Row className={cf('row', { inactiveRowFont: isRowInactive })} style={{ wordBreak: 'break-word' }} key={program.id}>
        <Cell>{program.name}</Cell>
        <Cell>{program.displayName} </Cell>
        <Cell width="15%">
          <TextPrimary> {getDisplayName(properties, program.propertyId)}</TextPrimary>
          <TextPrimary> {getDisplayName(teams, program.teamId)} </TextPrimary>
        </Cell>
        <Cell>{getDisplayName(teams, program.onSiteLeasingTeamId)} </Cell>
        <Cell>{program.directEmailIdentifier} </Cell>
        <Cell width="15%">
          <TextPrimary> {program.outsideDedicatedEmails.join('\n')} </TextPrimary>
          <TextPrimary> {program.displayEmail}</TextPrimary>
        </Cell>
        <Cell width="15%">
          <TextPrimary> {program.directPhoneIdentifier}</TextPrimary>
          <TextPrimary> {formatPhone(program.displayPhoneNumber)} </TextPrimary>
        </Cell>
        <Cell>{getStatus(program.endDate)} </Cell>
        <Cell>{getProgramFallbackName(program, programs)} </Cell>
      </Row>
    );
  });

  return (
    <Table>
      <RowHeader className={cf('boldHeaderRow')}>
        <Cell>{t('PROGRAM_NAME')} </Cell>
        <Cell>{t('PROGRAM_DISPLAY_NAME')} </Cell>
        <Cell width="15%">
          <TextPrimary>{t('PROGRAM_DISPLAY_NAME')} </TextPrimary>
          <TextPrimary>{t('TEAM')} </TextPrimary>
        </Cell>
        <Cell>{t('ON_SITE_LEASING_TEAM')} </Cell>
        <Cell>{t('DIRECT_EMAIL')} </Cell>
        <Cell width="15%">
          <TextPrimary>{t('OUTSIDE_DEDICATED_EMAILS')} </TextPrimary>
          <TextPrimary>{t('DISPLAY_EMAIL')} </TextPrimary>
        </Cell>
        <Cell width="15%">
          <TextPrimary>{t('DIRECT_PHONE')} </TextPrimary>
          <TextPrimary>{t('DISPLAY_PHONE')} </TextPrimary>
        </Cell>
        <Cell>{t('STATUS')} </Cell>
        <Cell>{t('PROGRAM_FALLBACK')} </Cell>
      </RowHeader>
      {rows}
    </Table>
  );
};
export default ProgramsList;
