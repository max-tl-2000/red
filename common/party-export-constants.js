/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const PartyExportConstants = {
  EXPORT_FOLDER_NAME: 'partyExport',
  EXPORT_FILE_NAME: 'party.zip',
  PARTY_INFO_FILE: 'Party and Application Information.pdf',
  PARTY_INFO_FILE_PAGE_SIZE: 'Letter',
  PARTY_INFO_FILE_TITLE: 'Reva Property Management',
  PARTY_INFO_HEADER_HEIGHT: '10mm',
  PARTY_INFO_HEADER_CONTENT: `<div style="fontFamily: Roboto,sans-serif; font-size: 6px;">
                                <div>{reportName}</div>
                                <div style="float: left; position: absolute; left: 40%; top: 8px;">{reportTitle}</div>
                              </div>`,
  PARTY_INFO_FOOTER_HEIGHT: '10mm',
  PARTY_INFO_FOOTER_CONTENT: `<div style="fontFamily: Roboto,sans-serif; font-size: 6px;">
                                <div>{partyId}</div>
                                <div style="float: right; position: absolute; right: 10px; bottom: 13px;">
                                  <span>{{page}}</span>/<span>{{pages}}</span>
                                </div>
                              </div>`,
  PARTY_CREDIT_REPORT_FILE: 'Credit Report',
  PARTY_CREDIT_REPORT_FIX_STYLE: 'html{ zoom:0.55; }',
  QUOTE_BASE_NAME: 'Quote for',
  ADVERSE_LETTER: 'Adverse Action Letter',
  RESIDENT: 'Resident',
  RENEWAL: 'Renewal',
  ETC_UNIT: 'etc',
  DEFAULT_NOTE: 'Agent did not provide a note',
  UPCOMING_LEASE: 'Upcoming lease not executed',
  CURRENT_LEASE: 'Current lease ends',
  PAST_LEASE: 'Past lease ended',
};
