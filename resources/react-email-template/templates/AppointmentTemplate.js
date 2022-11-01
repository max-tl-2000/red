/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../layout';
import TopBar from '../../custom-components/Email/TopBar/TopBar';
import Footer from '../../custom-components/Email/Footer/Footer';
import Card from '../../custom-components/Email/Card/Card';
import { greet } from '../../../common/helpers/strings';
import * as T from '../../custom-components/Email/Typography/Typography';
import { bodyMailBorder } from '../commonStyles';
import { formatPhone } from '../../../common/helpers/phone-utils';
import { toMoment } from '../../../common/helpers/moment-utils';

const AppointmentTemplate = ({
  sender,
  propertyName,
  propertyAddress,
  propertyTimezone,
  startDate,
  contactInfo,
  appointmentEventType,
  tenantCommSettings,
  footerLinks,
  assignedAgent,
}) => {
  const momentDate = toMoment(startDate, { timezone: propertyTimezone });
  const startDateFormatted = `${momentDate.format('MMMM DD, YYYY')} at ${momentDate.format('h:mm a')}`;

  let subHeader = 'Appointment confirmed';
  if (appointmentEventType === 'cancel') subHeader = 'Appointment Cancelled';
  if (appointmentEventType === 'update') subHeader = 'Appointment Updated';

  const cardStyle = { textAlign: 'left', overflow: 'hidden', borderLeft: bodyMailBorder, borderRight: bodyMailBorder };

  const renderCancelAppointment = () => (
    <Card style={cardStyle}>
      <T.Text>{greet('Hi')}</T.Text>
      <T.Text style={{ marginTop: '16px' }}>Your appointment has been cancelled for {startDateFormatted}.</T.Text>
      <T.Text style={{ marginTop: '16px' }}>
        We appreciate your interest {propertyName}. If you change your mind or have questions, contact us at {formatPhone(contactInfo.displayPhoneNumber)} or
        simply reply to this email.
      </T.Text>

      <T.Text style={{ marginTop: '32px' }}>Regards,</T.Text>
      <T.Text>{sender.fullName}</T.Text>
      <T.Caption secondary>{sender.metadata.businessTitle}</T.Caption>
      <T.Caption secondary style={{ marginTop: '4px' }}>
        {formatPhone(contactInfo.displayPhoneNumber)}
      </T.Caption>
    </Card>
  );

  const renderUpdateAppointment = () => (
    <div>
      <Card style={cardStyle}>
        <T.Text>{greet('Hi')}</T.Text>
        <T.Text style={{ marginTop: '16px' }}>Your appointment has been updated.</T.Text>
        <T.Text bold style={{ marginTop: '16px' }}>
          Property tour on {startDateFormatted}.
        </T.Text>
        <T.Text style={{ marginTop: '16px' }}>
          You will meet with {assignedAgent.preferredName} at our Leasing Office located at {propertyAddress}. If you would like to modify or cancel this
          appointment, simply reply to this email with your change.
        </T.Text>

        <T.Text style={{ marginTop: '32px' }}>Cheers,</T.Text>
        <T.Text>{sender.fullName}</T.Text>
        <T.Caption secondary>{sender.metadata.businessTitle}</T.Caption>
        <T.Caption secondary style={{ marginTop: '4px' }}>
          {formatPhone(contactInfo.displayPhoneNumber)}
        </T.Caption>
      </Card>
      {
        // obtain location from google api, this is not implemented yet, using hard coded map image for now
      }
    </div>
  );

  // final template implementation to be completed, i couldn't find the user story
  const renderCreateAppointment = () => (
    <Card style={cardStyle}>
      <T.Text>{greet('Hi')}</T.Text>
      <T.Text style={{ marginTop: '16px' }}>Your appointment has been confirmed.</T.Text>
      <T.Text bold style={{ marginTop: '16px' }}>
        Property tour on {startDateFormatted}.
      </T.Text>
      <T.Text style={{ marginTop: '16px' }}>
        You will meet with {assignedAgent.preferredName} at our Leasing Office located at {propertyAddress}. If you would like to modify or cancel this
        appointment, simply reply to this email with your change.
      </T.Text>

      <T.Text style={{ marginTop: '32px' }}>Cheers,</T.Text>
      <T.Text>{sender.fullName}</T.Text>
      <T.Caption secondary>{sender.metadata.businessTitle}</T.Caption>
      <T.Caption secondary style={{ marginTop: '4px' }}>
        {formatPhone(contactInfo.displayPhoneNumber)}
      </T.Caption>
    </Card>
  );

  const renderAppointmentByEventType = eventType => {
    switch (eventType) {
      case 'create':
        return renderCreateAppointment();
      case 'update':
        return renderUpdateAppointment();
      case 'cancel':
        return renderCancelAppointment();
      default:
        return '';
    }
  };

  return (
    <Layout>
      <TopBar title={propertyName || ''} subHeader={subHeader} />
      {renderAppointmentByEventType(appointmentEventType)}
      <Footer links={footerLinks} tallFooterText={tenantCommSettings.footerNotice} allRightsReserved={tenantCommSettings.footerCopyright} />
    </Layout>
  );
};

export default AppointmentTemplate;
