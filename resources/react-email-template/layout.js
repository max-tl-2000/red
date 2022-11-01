/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';

const msHack = `
<!--[if mso]>
    <style>
      .mainTable { width: 800px; }
    </style>
    <![endif]-->
`;

const Layout = ({ lang = 'en', title, backgroundColor, children }) => (
  <html lang={lang}>
    <head>
      <meta name="format-detection" content="date=no" />
      <meta name="format-detection" content="email=no" />
      <meta name="format-detection" content="phone=no" />
      <title>{title}</title>
    </head>
    <body style={{ margin: 0, padding: 0, fontFamily: 'Roboto,sans-serif' }} bgcolor={backgroundColor || '#FFFFFF'}>
      <div dangerouslySetInnerHTML={{ __html: msHack }} />
      <table
        width="100%"
        height="100%"
        style={{ minWidth: 348, fontFamily: 'Roboto, sans-serif', backgroundColor: backgroundColor || '#FFFFFF' }}
        border="0"
        cellSpacing="0"
        cellPadding="0">
        <tbody>
          <tr align="center">
            <td>
              <table className="mainTable" border="0" cellSpacing="0" cellPadding="0" style={{ maxWidth: 680 }}>
                <tbody>
                  <tr>
                    <td>{children}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr height="32px" />
        </tbody>
      </table>
    </body>
  </html>
);

export default Layout;
