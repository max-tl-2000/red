/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const signedDocuments = new Map([
  ['Community Standards Addendum', 'Cove - Community standards addendum.docx'],
  ['Cove -- Core Agreement', 'Cove-Core contract.docx'],
  ['Equipment Release Form Addendum', 'Cove - Equipment release form addendum.docx'],
  ['Recreational Facility Regulations', 'Cove - Recreational facility regulations addendum.docx'],
  ['Storage Agreement Addendum', 'Cove - Storage agreement addendum.docx'],
  ['Serenity -- Core Agreement', 'Serenity-Core contract.docx'],
  ['Recreational Facility Regulations', 'Serenity - Recreational facility regulations addendum.docx'],
  ['Recreational Facility Regulations', 'Serenity - Recreational facility regulations addendum.pdf'],
  ['Utility and Services Addendum', 'Serenity-Utilityandservicesaddendum.docx'],
  ['Woodchase -- Core Agreement', 'Woodchase - Core contract.pdf'],
  ['Recreational Facility Regulations', 'Woodchase - Recreational facility regulations addendum.docx'],
  ['Utility and Services Addendum', 'Woodchase - Utility and services addendum.docx'],
  ['Parkmerced-Guarantee of Lease', 'Parkmerced - Guarantee of lease.pdf'],
  ['Parkmerced-Core Agreement', 'Parkmerced - Core Contract (converted in word).docx'],
  ['Parkmerced - SF public works and environmental ordinances', 'Parkmerced - SF public works and environmental ordinances (1).pdf'],
  ['Parkmerced-Asbestos disclosure addendum', 'Parkmerced - Asbestos disclosure addendum.pdf'],
  ['Parkmerced-Bedbug addendum', 'Parkmerced - Bedbug addendum.pdf'],
  ['Parkmerced-Move-in/out statement and summary of move-out charges addendum', 'Parkmerced - Move-inmove-out statement and summary of move-out charges.pdf'],
  ['Parkmerced-Utility addendum', 'Parkmerced - Utility addendum.pdf'],
  ['Parkmerced-Utility provider information addendum', 'Parkmerced - Utility provider information addendum.pdf'],
  ['Parmerced-Community policies addendum', 'Parkmerced - Community rules addendum.pdf'],
  ['Parmerced-Facts about renters insurance addendum', 'Parkmerced - Facts about renters insurance addendum.pdf'],
  ['Parmerced-Lease disclosure addendum', 'Parkmerced - Lease disclosure addendum.pdf'],
  ['Parmerced-Mold notification and lead disclosure addendum', 'Parkmerced - Mold_mildew_lead disclosure addendum.pdf'],
  ['Parmerced-Pet agreement addendum', 'Parkmerced - Pet agreement addendum.pdf'],
  ['Parmerced-Recreational facility regulations addendum', 'Parkmerced - Recreational facility regulations addendum.pdf'],
  ['Parmerced-SFSU lease addendum', 'Parkmerced - SFSU lease addendum.pdf'],
  ['Parmerced-Student Option for Early Termination lease addendum', 'Parkmerced - Student Option for Early Termination lease addendum.pdf'],
  ['Parkmerced-Summer 2022 Student Offer lease addendum', 'Parkmerced - Summer 2022 Student Offer lease addendum.pdf'],
  ['Parkmerced-EPA Booklet addendum', 'BLANK - EPA Booklet.pdf'],
  ['Acknowledgement for Work on Premises Addendum', 'z_Acknowledgement for work on premises addendum.docx'],
  ['Because We Care Addendum', 'z_Because we care addendum.docx'],
  ['Community Policies Addendum', 'z_Communitypoliciesaddendum.docx'],
  ['Community Policies Addendum', 'z_Community policies addendum.docx'],
  ['Facts About Renters Insurance Addendum', 'z_Facts about renters insurance addendum.docx'],
  ['Guarantee of Lease', 'z_Gurantee of lease.docx'],
  ['Lessee Security Notice and Acknowledgment Addendum', 'z_Lessee security notice and acknowledgment addendum.docx'],
  ['Move-in_Move-out Itemized Statement', 'z_Move-in_Move-out itemized statement.docx'],
  ['Parking Policies and Vehicle Identification Addendum', 'z_Parking policies and vehicle identification addendum.pdf'],
  ['Parking Policies and Vehicle Identification Addendum', 'z_Parkingpoliciesandvehicleidentificationaddendum.pdf'],
  ['Pet agreement addendum', 'z_Pet agreement addendum.docx'],
  ['Proposition 65 Fact Sheet Addendum', 'z_Proposition 65 fact sheet addendum.docx'],
  ['Rent Concession Agreement', 'z_Rent concession agreement addendum.docx'],
  ['Security Deposit Agreement Addendum', 'z_Security deposit agreement addendum.docx'],
  ['Smoke Free Addendum', 'z_Smokefreeaddendum.docx'],
  ['Utility Provider Information Addendum', 'z_Utility provider information addendum.docx'],
  ['Ventilation Instructions and Agreement Addendum', 'z_Ventilation instructions and agreement addendum.docx'],
]);

export const getDocumentName = displayName => signedDocuments.get(displayName);
