@RentApp @PR
Feature: Demo flow RentApp
         CPM-4793: RentApp demo flow scenario

Scenario: CPM-4794 RentApp initial Context (Background)

  # RentApp background step to getting a Quote email
  Given Published Quote with unit "1013" has been shared for Party guest "Harold Smith" and email "qatest+harold@reva.tech"

  # Customer open a Quote email sent to Apply
  When Customer clicks on 'Apply Now' link from quote emailed to "qatest+harold@reva.tech"
  Then The 'Welcome' page should be displayed

  # Customer starts an application
  When Customer read and accept the terms of service : "I have read and agree to the terms and conditions"
  Then The 'Applicant Details' page should be displayed
  And  The applicant stepper should contain in first step:
        | FirstName  | LastName |    EmailAddress         |
        | Harold     | Smith    | qatest+harold@reva.tech |

  # Customer completes the application form
  When Customer fills out all the required fields:
        |    Field     |   Value    |  type       |
        | phone        | 2025550114 | phone       |
        | dateOfBirth  | 11/11/1995 | maskedInput |
        | grossIncome  | 100000     |             |
        | addressLine1 | 1225 Harvey Street |     |
        | city         | Seattle    |             |
        | zipCode      | 98106      | maskedInput |
  And  Selects a State from dropdown "Washington (WA)"
  And  Clicks "nextStep" button
  Then The applicant stepper should contain in second step:
        |   Charge        | Amount  |
        | Application fee | $50.00  |
        | Hold deposit (3711-101 19th Ave - Valid for 72 hours) | $500.00 |
        | TOTAL           | $50.00  |

  # Customer submits the payment
  When Clicks "doneStep" button
  Then The 'Payment' dialog should be displayed
  When Customer fills out the payment form:
        | Field      | Value |
        | name       | Visa  |
        | cardnumber | 4242424242424242 |
        | cvv        | 123   |
  And Selects a card expiration date: "11/2025"
  And Clicks "btnReviewPayment" button
  # Then The 'Payment' dialog should contain a confirmation message: "Your payment has been confirmed!"

  # Customer finish the application
  # When Clicks "continue-link" button
  Then The 'Application Additional Info' page should be displayed
  And  An account has been created: "Your account has been created and an email with a link to complete your registration was sent. Once registered, you can continue your application at any time."

  When Clicks "Renter's Insurance" step if is available
  Then Selects one renter insurance option: "Residents will purchase renter's insurance for the unit from eRenterPlan - www.renterslive.com"

  When Clicks "btnIAmDone" button
  Then The 'Application Complete' page should be displayed
  And  It should contain a notification message: "Thank you for filling out your application. We’ll review your information and get back to you shortly. You can use the link from the email to access your application again and make additional changes if needed."
  And  The current tab is closed
  And  Just wait for "1" seconds

  # Review the application
  When    'Leasing' agent selects a quote for promotion for item "1013" from 'Party Details' page
  Then    The screening is reviewed for unit "1013"
  # TODO. Add this flow separate as now the default lease term will just be one (taken from the rent matrix)
  # And     Reviews the application for the quoted item "1013" with lease term "6 months"
  Then    The "approvalSummary" dialog should open

  # Promote the Quote
  When    Clicks "btnRequestApproval" button
  Then    The "Application Pending Approval" section should be displayed

  # Demote the Quote
  When    'Leasing' agent demotes an application promoted for approval from 'Party Details' page:
        |               Application Pending Approval              |
        | $4,396.00/m                                           |
        | 18 month moving in on                                    |
        | Includes: 4 beds, 3.5 baths (swparkme-350AR-1013) |
  And     Cancels an approval request to promote another Quote
  Then    The "Applications and Quotes Section" section should be displayed

  # Request an approval for a specific quote and lease term
  Given   'Leasing' agent opens review screening for item "1013" with lease term '18 months'
  Then    The "approvalSummary" dialog should open
  When    Clicks "btnRequestApproval" button
  Then    The "Application Pending Approval" section should be displayed
  And     User logs out
  And     Just wait for "1" seconds

  # Login as Leasing Application Approver
  Given User logs in as "sally@reva.tech" with password "red&reva#"

  # Review application task
  When    Selects "REVIEW_APPLICATION" task for Party guest "Harold Smith"
  Then    The "approvalSummary" dialog should open

  # Approve the application with conditions
  When    User clicks approve application button
  Then    The "approveApplication" dialog should open
  When    User types in field "internalNotes" : "Approved with Conditions"
  And     Increases the deposit condition to "$8,792.00 (2x deposit)"
  And     User clicks: "#approveApplication [data-action='OK']"
  Then    The "leaseForm" dialog should open
