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

const DeclinedApplicationTemplate = ({ sender, inventory, externalApplicationId, footerLinks }) => {
  const businessTitle = sender.metadata.businessTitle || 'Leasing Manager';
  const textStyleSmallMargin = { marginTop: 10, textAlign: 'justify' };
  const textStyleMediumMargin = { marginTop: 20 };
  const inventoryType = inventory && inventory.inventorygroup && inventory.inventorygroup.inventoryType;
  const inventoryName = inventory && inventory.name;
  const propertyName = inventory && inventory.property && inventory.property.displayName;
  const propertyAddress = inventory && inventory.property && inventory.property.address;
  const propertyFormattedAddress = propertyAddress && [propertyAddress.addressLine1, propertyAddress.city, propertyAddress.state].filter(x => x).join(', ');

  return (
    <Layout>
      <TopBar title={propertyName} tall subHeader="Application Decision" />
      <Card
        style={{ fontFamily: 'Roboto,sans-serif', textAlign: 'left', overflow: 'hidden', borderLeft: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0' }}>
        <T.Text>{greet('Dear Applicant')}</T.Text>
        <T.Text style={textStyleMediumMargin}>
          {`Thank you for your rental application for ${inventoryType || ''} ${inventoryName || ''} located at ${propertyName || ''}, ${
            propertyFormattedAddress || ''
          }`}
        </T.Text>
        <T.Text style={textStyleSmallMargin}>
          Unfortunately, after reviewing your consumer report and application we are unable to offer you a lease on the terms requested. We use a third-party
          consumer reporting service, First Advantage, to prepare and provide your consumer report. We did not use your credit score to make this decision about
          your application.
        </T.Text>
        <T.SubHeader bold style={textStyleMediumMargin}>
          CONSUMER REPORTING AGENCY
        </T.SubHeader>
        <T.Text style={textStyleSmallMargin}>
          We based our decision, in whole or in part, on information obtained in a consumer report from First Advantage. You may contact First Advantage by
        </T.Text>
        <ul>
          <li>visiting https://resident.fadv.com,</li>
          <li>emailing resident.support@fadv.com,</li>
          <li>calling toll-free at (800) 487-3246, or</li>
          <li>writing to First Advantage Customer Center, P.O. Box 105108, Atlanta, GA 30348.</li>
        </ul>
        <T.Text style={textStyleSmallMargin}>{`Your application ID is ${externalApplicationId}.`}</T.Text>
        <T.Text style={textStyleSmallMargin}>
          Under the Fair Credit Reporting Act you have the right to know what information is contained in your credit file at the consumer reporting agency. You
          have 60 days after receiving this notice to request a free copy of your report from First Advantage. The reporting agency played no part in the
          decision to deny your application, and is unable to supply specific reasons for the decision. If you find that any information contained in your
          report is inaccurate or incomplete, you have the right to dispute the matter with the reporting agency, and to add a statement of up to 100 words
          explaining your position on the disputed items. Future consumer report requests will show your statement about the disputed items. Trained personnel
          are available to help you prepare a consumer statement.
        </T.Text>
        <T.Text style={textStyleSmallMargin}>A Summary of your rights under the Fair Credit Reporting Act is available at</T.Text>
        <ul>
          <li>English: http://files.consumerfinance.gov/f/201504_cfpb_summary_your-rights-under-fcra.pdf, or</li>
          <li>Español: http://files.consumerfinance.gov/f/201504_cfpb_summary_your-rights-under-fcra_es.pdf</li>
        </ul>
        <T.SubHeader bold style={textStyleMediumMargin}>
          CONSUMER FINANCIAL PROTECTION
        </T.SubHeader>
        <T.Text style={textStyleSmallMargin}>
          If you believe there was discrimination in handling your application, contact the Consumer Financial Protection Bureau by
        </T.Text>
        <ul>
          <li>visiting https://consumerfinance.gov/learnmore,</li>
          <li>calling toll-free at (855) 411-2372, or</li>
          <li>writing to Consumer Financial Protection Bureau, P.O. Box 4503, Iowa City, Iowa 52244.</li>
        </ul>
        <T.SubHeader bold style={textStyleMediumMargin}>
          ADDITIONAL RIGHTS
        </T.SubHeader>
        <T.Text style={textStyleSmallMargin}>
          You may have additional rights under the credit reporting or consumer protection laws of your state. For further information, you can contact the
          California State Attorney General's office by visiting https://oag.ca.gov.
        </T.Text>
        <T.Text style={textStyleMediumMargin}>We wish you luck in your search for a new residence.</T.Text>
        <T.Text style={textStyleMediumMargin}>Sincerely,</T.Text>
        <T.Text style={textStyleMediumMargin}>{sender.preferredName}</T.Text>
        <T.Text>{businessTitle}</T.Text>
      </Card>
      <Footer links={footerLinks} />
    </Layout>
  );
};

export default DeclinedApplicationTemplate;
