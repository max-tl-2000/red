/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../../common/layout/layout';

const renderWidgetInitialization = (token, host) =>
  `
  document.addEventListener('DOMContentLoaded', function domLoad() {
    const txtProgram = document.querySelector('#txtProgram');
    const txtDynamicFields = document.querySelector('#txtDynamicFields');
    const txtOnAppointmentSave = document.querySelector('#txtOnAppointmentSave');
    const txtMode = document.querySelector('#txtMode');
    const txtAppointmentToken = document.querySelector('#txtAppointmentToken');
    const btnRenderWidget = document.querySelector('#btnRenderWidget');
    const widgetContainer = document.querySelector('#widget');

    const txtMarketingSessionId = document.querySelector('#txtMarketingSessionId');
    const btnHitMarketingContact = document.querySelector('#btnHitMarketingContact');

    const getMarketingSessionId = () => {
      return txtMarketingSessionId.value;
    };

    const setMarketingSessionId = val => {
      txtMarketingSessionId.value = val;
    };

    btnHitMarketingContact.addEventListener('click', async () => {
      let marketingSessionId = getMarketingSessionId();
      const currentUrl = window.location.href + '?pmapartments.us';
      const referrerUrl = window.location.origin;

      marketingSessionId = marketingSessionId ? marketingSessionId : undefined;

      const res = await $.ajax({
        method: 'POST',
        url: 'https://${host}/api/marketingContact',
        headers: {
          Authorization: 'Bearer ${token}',
        },
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify({
          currentUrl,
          referrerUrl,
          marketingSessionId
        })
      });

      setMarketingSessionId(res.marketingSessionId);
    });

    const props = {
      extraData: {
        unitId: '103-SR-001', // replace this by the real parameter
        qualificationQuestions: {
          numBedrooms: [
            'ONE_BED',
            'TWO_BEDS'
          ],
          groupProfile: 'FAIR_MARKET',
          moveInTime: 'NEXT_4_WEEKS',
          cashAvailable: 'YES'
        },
      },
      domain: 'https://${host}',
      token: '${token}'
    };

    const btn1 = document.querySelector('#btn1');
    const btn2 = document.querySelector('#btn2');
    const btnGenericApplyQQ = document.querySelector('#btnGenericApplyQQ');
    const txtUnit = document.querySelector('#txtUnit');

    btn1.addEventListener('click', () => {
      __showFormDialog({ ...props, campaignEmail: txtProgram.value, extraData: { requestApplication: true } })
    });

    btn2.addEventListener('click', () => {
      const unitQualifiedName = (txtUnit.value || '').trim();
      if (!unitQualifiedName) {
        alert('Please enter a unit qualified name');
        return;
      }
      __showFormDialog({ ...props, campaignEmail: txtProgram.value, showExtraFields: true, extraData: { requestQuote: { unitQualifiedName }, ...props.extraData } })
    });
    
    btnGenericApplyQQ.addEventListener('click', () => {
      __showFormDialog({ ...props, campaignEmail: txtProgram.value, extraData: { requestApplication: true , qualificationQuestions: props.extraData.qualificationQuestions } });
    });

    let destroy;

    btnRenderWidget.addEventListener('click', async () => {

      const fn = new Function('return ' + txtOnAppointmentSave.value);

      if (destroy) {
        if (typeof destroy === 'function') {
          // this is the case of the old book appointment widget
          destroy();
        } else {
          // website utils have a different signature
          destroy.destroy && destroy.destroy();
        }
      }

      destroy = await __initBookAppointment('#widget', {
        campaignEmail: txtProgram.value,
        marketingSessionId: getMarketingSessionId(),
        domain: 'https://${host}',
        autoLoadStyles: false,
        token: '${token}',
        mode: txtMode.value,
        appointmentToken: txtAppointmentToken.value,
        dynamicFields: JSON.parse(txtDynamicFields.value),
        onAppointmentSave: fn()
      });
    });

  });
  `.trim();

export const SelfServe = ({ old, token, host, ...rest }) => {
  const libAsset = {
    js: old ? `https://${host}/thirdparty/self-serve/bookAppointmentWidget.min.js` : `https://${host}/thirdparty/website-utils/website-utils.min.js`,
    css: old ? `https://${host}/thirdparty/self-serve/bookAppointmentWidget.min.css` : `https://${host}/thirdparty/website-utils/website-utils.min.css`,
  };
  const assets = ['https://cdnjs.cloudflare.com/ajax/libs/jquery/3.0.0/jquery.min.js', libAsset.js];
  const cssAssets = ['https://fonts.googleapis.com/css?family=Heebo:400,700,500|Playfair+Display:700i,700|Lato', libAsset.css];

  const dynFields = [
    {
      name: 'numBedrooms',
      value: undefined,
      required: '# of bedrooms is required',
      meta: {
        type: 'Dropdown',
        label: '# of Bedrooms',
        items: [
          { id: 'STUDIO', value: 'Studio' },
          { id: 'ONE_BED', value: 'One bed' },
          { id: 'TWO_BEDS', value: 'Two beds' },
          { id: 'THREE_BEDS', value: 'Three beds' },
          { id: 'FOUR_PLUS_BEDS', value: 'Four beds' },
        ],
      },
    },
    {
      name: 'moveInTime',
      value: undefined,
      required: 'Move-in range is required',
      meta: {
        type: 'Dropdown',
        label: 'When do you plan to rent?',
        items: [
          { id: 'NEXT_4_WEEKS', value: 'Next 4 weeks' },
          { id: 'NEXT_2_MONTHS', value: 'Next 2 months' },
          { id: 'NEXT_4_MONTHS', value: 'Next 4 months' },
          { id: 'BEYOND_4_MONTHS', value: 'Beyond 4 months' },
          { id: 'I_DONT_KNOW', value: "I don't know" },
        ],
      },
    },
    {
      name: 'message',
      value: '',
      required: 'Comments are required',
      meta: {
        type: 'TextArea',
        label: 'Comments',
      },
    },
  ];

  const defaultFields = `
${JSON.stringify(dynFields, null, 2)}
  `.trim();

  const defaultOnAppointmentSave = `
function onAppointmentSave(appointment) {
  return Object.assign(appointment, {
    qualificationQuestions: {
      numBedrooms: [appointment.numBedrooms],
      moveInTime: appointment.moveInTime,
      // hardcoded values
      groupProfile: 'FAIR_MARKET',
      cashAvailable: 'YES'
    }
  });
}
  `.trim();

  const explanation = { fontSize: 13, marginTop: 2 };
  const label = { fontSize: 15, marginBottom: 2 };

  const styles = `
  html {
    font-family: Heebo;
  };`;

  return (
    <Layout jsAssets={assets} cssAssets={cssAssets} {...rest}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <h1>Widget test playground</h1>
      <p>Use the following form to create a book appointment widget, when all values are set click on "Render Widget"</p>
      <form style={{ marginBottom: 20 }}>
        <div>
          <p style={label}>Program</p>
          <p style={explanation}>Also known as campaignEmail or programEmail</p>
          <input style={{ width: 300, padding: 5 }} type="text" id="txtProgram" defaultValue="leasing.parkmerced" />
        </div>
        <div>
          <p style={label}>MarketingSessionId</p>
          <p style={explanation}>The marketing SessionId to retrieve from the /marketingContact endpoint.</p>
          <input style={{ width: 300, padding: 5 }} type="text" id="txtMarketingSessionId" defaultValue="" />
          <button type="button" id="btnHitMarketingContact">
            hit marketingContact
          </button>
        </div>
        <div>
          <p style={label}>mode</p>
          <p style={explanation}>Can be "create", "edit" and "cancel". If Edit and cancel is used you need to provide an appointmentToken</p>
          <input style={{ width: 300, padding: 5 }} type="text" id="txtMode" defaultValue="create" />
        </div>
        <div>
          <p style={label}>DynamicFields</p>
          <p style={explanation}>Fields to be added to the ContactForm in the book appointment widget</p>
          <textarea style={{ width: 500, padding: 5, height: 100 }} id="txtDynamicFields" defaultValue={defaultFields} />
        </div>
        <div>
          <p style={label}>onAppointmentSave</p>
          <p style={explanation}>Function used to generate the shape of the payload sent to the create appointment endpoint</p>
          <textarea style={{ width: 500, padding: 5, height: 100 }} id="txtOnAppointmentSave" defaultValue={defaultOnAppointmentSave} />
        </div>
        <div>
          <p style={label}>Appointment Token</p>
          <p style={explanation}>The appointment token found in the confirmation email of an appointment</p>
          <textarea style={{ width: 500, padding: 5, height: 100 }} id="txtAppointmentToken" defaultValue="" />
        </div>
        <div>
          <p style={explanation}>Click the button below to render the calendar widget</p>
          <button style={{ padding: 5 }} type="button" id="btnRenderWidget">
            Render Widget
          </button>
        </div>
      </form>
      <div id="widget" />
      <br />
      <br />
      <h1>Form test playground</h1>
      <div>
        <h2>This will be used to apply without selecting a unit</h2>
        <button style={{ padding: 5 }} type="button" id="btn1">
          Generic Apply Button
        </button>
      </div>
      <div>
        <h2>This will be used to apply without selecting a unit and adding default qualification questions</h2>
        <button style={{ padding: 5 }} type="button" id="btnGenericApplyQQ">
          Generic Apply Button with default QQ
        </button>
      </div>

      <div>
        <h2>This will be used to apply in the context of a unit, so a quote will be created</h2>
        <label htmlFor="Unit">
          Unit:
          <input style={{ margingLeft: 5, marginRight: 5, width: 100, padding: 5 }} type="text" id="txtUnit" />
        </label>
        <button style={{ padding: 5 }} type="button" id="btn2">
          Apply Button related to a unit
        </button>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: renderWidgetInitialization(token, host),
        }}
      />
      <div style={{ height: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p>Extra padding adding for demo</p>
      </div>
      <div style={{ height: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p>Extra padding adding for demo</p>
      </div>
    </Layout>
  );
};
