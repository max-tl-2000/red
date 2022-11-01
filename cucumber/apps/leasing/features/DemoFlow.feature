@Demo @PR
Feature: Demo Flow
         Cucumber test to check Demo flow

@Demo
Scenario: User logs in
        A person sends a request from web form.
        A new contact is created in the app.
        The user opens the person details page.
        The user sends a SMS from person details page.
        The user creates a new party from person details pages.
        The user sends a SMS from party details page.
        The user adds filters in the Select unit preferences.
        The user is booking a tour from a unit card

  # User logs in
  Given   'Login' page is opened
  When    User types his email "bill@reva.tech"
  And     Types his password "red&reva#"
  And     Clicks on 'SignIn' button
  Then    'Dashboard' page should be displayed
  And     Just wait for "2" seconds
  And     User clicks: "#switchTodayOnly"
  Then    The "contacts" column should contain a card with "James Hill"
  And     The "leads" column should contain a card with "Eli Foster"
  And     The "prospects" column should contain a card with "George Harrison"
  And     The "applicants" column should contain a card with "Dylan Butler"
  And     The user clicks the 'Im Available' button

  # Send a SMS from testing plivo application
  When    The future prospect sends the following SMS message: "I am looking for an apartment"

  # A new contact card is created
  And     The "contacts" column should contain a card with a phone number
  And     The card with the phone number in column "contacts" should display message "I am looking for an apartment"

  # The user goes to person details page
  When    User clicks on the card with the phone number in "contacts" column
  Then    The party details page in phase one should open
  And     Tasks section should contain a system created task with "Bill Smith" as task owner
  And     The nav bar should contain "Update party"
  # Then    The stepper should contain in the first step the phone number and "1 phone"
  Then    User edits contact information
  And     User types "John Doe" in field "#txtLegalName"
  Then    Clicks "btnAddEmail" button
  And     User types preprocessed value "__testEmail(qatest+johndoe@reva.tech)" in field "#txtNewEmail"
  And     Clicks "btnVerifyEmailAddress" button
  And     Clicks "btnCreatePerson" button
  And     Just wait for "1.5" seconds
  And     Select ButtonBar "#bedroomsBar" values to "FOUR_PLUS_BEDS"
  And     Check "Yes" to the combined monthly income question
  And     Select "1 - 2 months" from move in time dropdown
  And     Select "Employee" from lease type dropdown
  And     Clicks "btnSaveAndContinue" button
  And     Just wait for "2" seconds
  And     The Communication section should contain a thread with message "I am looking for an apartment"

  # The user sends a SMS from person details page
  When    User clicks on communication thread
  Then    The SMS flyout should open
  #This will be enabled after we can update members in the ResidentPanel
  #And    The SMS flyout title should display "John Doe, Me"
  And     The SMS flyout should contain "I am looking for an apartment"
  When    User types in field "smsToSend" : "How many beds and bathrooms ?"
  And     Clicks "sendSms" button
  Then    The SMS flyout should contain "How many beds and bathrooms ?"
  And     The Communication section should display only "1" Sms thread
  And     The Communication section should contain a thread with message "How many beds and bathrooms ?"

  #Check the last SMS received by guest
  Then    The guest received the following message "How many beds and bathrooms ?" from tenant phone number
  And     The guest replies with: "3 beds and 3 bathrooms"

  #Check that the reply from guest is received by user
  Then    The SMS flyout should contain "3 beds and 3 bathrooms"
  And     The Communication section should contain a thread with message "3 beds and 3 bathrooms"

  # The user sends an SMS from party details page
  Then    The SMS flyout should open
  When    User types in field "smsToSend" : "I will schedule an appointment"
  And     Clicks "sendSms" button
  Then    The SMS flyout should contain "I will schedule an appointment"
  And     The Communication section should contain a thread with message "I will schedule an appointment"

  #Check the last SMS received by guest
  Then    The guest received the following message "I will schedule an appointment" from tenant phone number

  # Guest sends an SMS reply
  And     The guest replies with: "Thank you!"
  Then    The SMS flyout should contain "Thank you!"
  And     The Communication section should contain a thread with message "Thank you!"
  When    User close the SMS flyout

  # The user is booking a tour from a unit card
  When    Clicks step with id "1"
  When    User clicks 'Tour' on unit card "1013"
  Then    The "scheduleAppointment" dialog should open
  And     The field "guests" should contain "John Doe"
  And     The field "units" should contain "swparkme-350AR-1013"
  When    User types in text-area "apptNotes" : "Tour with Guest"
  And     Selects tour type "Schedule Virtual Tour" from dropdown
  And     Selects the time slot: today 2:30 PM
  And     Clicks "done" button
  Then    Appointments section should contain an appointment with the guest name "John Doe" for unit "swparkme-350AR-1013" and the description as "Tour with Guest"
  And     Tasks section should contain a task with "Bill Smith" as task owner

  # The user publishes a quote for a unit
  When    User clicks 'Quote' on unit card "1013"
  Then    User publishes the quote but doesnt send the quote
  And     User shares quote by email

  # Customer opens a quote to apply
  When    Customer clicks on 'Apply Now' link from quote emailed to "qatest+johndoe@reva.tech"
  Then    The 'Welcome' page should be displayed

  # Customer starts an application
  When    Customer read and accept the terms of service : "I have read and agree to the terms and conditions"
  Then    The 'Applicant Details' page should be displayed

  # Customer completes the application form
  When    Customer fills out all the required fields:
        |    Field     |   Value    |  type       |
        | phone        | 2025550114 | phone       |
        | dateOfBirth  | 11/11/1995 | maskedInput |
        | grossIncome  | 100000     |             |
        | addressLine1 | 1225 Harvey Street |     |
        | city         | Seattle    |             |
        | zipCode      | 98106      | maskedInput |
  And     Selects a State from dropdown "Washington (WA)"
  And     Clicks "nextStep" button
  Then    The applicant stepper should contain in second step:
        |   Charge        | Amount  |
        | Application fee | $50.00  |
        | Hold deposit (3711-101 19th Ave - Valid for 72 hours) | $500.00 |
        | TOTAL           | $50.00  |

  # Customer submits the payment
  When    Clicks "doneStep" button
  Then    The 'Payment' dialog should be displayed
  When    Customer fills out the payment form:
        | Field      | Value |
        | name       | Visa  |
        | cardnumber | 4242424242424242 |
        | cvv        | 123   |
  And     Selects a card expiration date: "11/2025"
  And     Clicks "btnReviewPayment" button

  # Customer finishes the application
  Then    The 'Application Additional Info' page should be displayed
  And     An account has been created: "Your account has been created and an email with a link to complete your registration was sent. Once registered, you can continue your application at any time."
  When    Clicks "Renter's Insurance" step if is available
  Then    Selects one renter insurance option: "Residents will purchase renter's insurance for the unit from eRenterPlan - www.renterslive.com"
  When    Clicks "btnIAmDone" button
  Then    The 'Application Complete' page should be displayed
  And     It should contain a notification message: "Thank you for filling out your application. We’ll review your information and get back to you shortly. You can use the link from the email to access your application again and make additional changes if needed."
  And     The current tab is closed
  And     Just wait for "1" seconds

  # Review the application
  When    'Leasing' agent selects a quote for promotion for item "1013" from 'Party Details' page
  Given   'Leasing' agent opens review screening for item "1013" with lease term '18 months'
  Then    The "approvalSummary" dialog should open

  # Promote the Quote
  When    Clicks "btnRequestApproval" button
  Then    The "Application Pending Approval" section should be displayed

  # Demote the Quote
  When    'Leasing' agent demotes an application promoted for approval from 'Party Details' page:
        |               Application Pending Approval              |
        | $7,596.00/m                                            |
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
  When    User types his email "sally@reva.tech"
  And     Types his password "red&reva#"
  And     Clicks on 'SignIn' button

  # Review application task
  When    Selects "REVIEW_APPLICATION" task for Party guest "John Doe"
  Then    The "approvalSummary" dialog should open

  # Approve the application with conditions
  When    User clicks approve application button
  Then    The "approveApplication" dialog should open
  When    User types in field "internalNotes" : "Approved with Conditions"
  And     Increases the deposit condition to "$15,192.00 (2x deposit)"
  And     User clicks: "#approveApplication [data-action='OK']"
  Then    The "leaseForm" dialog should open

  When    User publishes the lease
  Then    The 'Sign Lease' button should appear for guest

  # The lease is signed by the guest in office
  When    The user clicks 'Sign Lease' button
  Then    The 'Sign Lease' page should open
  When    The user checks 'Identity confirmation' checkbox
  And     User clicks 'Start Signature' button
  Then    The 'Fake-U-Sign' page should open on tab 2
  And     The user clicks the 'Sign Lease' button

  # The lease is counter-signed
  # Then    The lease should appear as signed by the guest
  Then    The user closes the second tab

  And     User logs out
  And     Just wait for "1" seconds

  # Login as Leasing Application Approver
  When    User types his email "danny@reva.tech"
  And     Types his password "red&reva#"
  And     Clicks on 'SignIn' button

  # Open the party awaiting counter-signature
  When    The user navigates right
  And     The "leases" column should contain a card with "John Doe"
  And     User clicks on "John Doe" card in "leases" column
  Then    The party details page in phase two should open
  And     The 'Countersignsign Lease' button should be visible

  # The user countersigns the lease
  When    The user clicks the 'Countersignsign Lease' button
  Then    The 'Fake-U-Sign' page should open on tab 2
  And     The user clicks the 'Sign Lease' button
  Then    The user closes the second tab

  When    The user clicks 'Back' button in AppBar
  Then    'Dashboard' page should be displayed
  When    The user navigates right
  # Then    The "residents" column should contain a card with "John Doe"

  And     User goes back to Dashboard and logs out
