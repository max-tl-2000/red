@PersonApplicationStatus
Feature: Transition Applicant status from party detail
In order to validate Applicant status 'Not sent', 'Sent', 'Paid' and 'Completed'
As a Leasing Agent

Scenario: Check person application status "Not Sent" before and "Sent" after publish quote
  Given User logs in as "bill@reva.tech" with password "red&reva#"
  And User creates a "New lease" party with a party member called "Thomas Tom" with email "__testEmail(qatest+thomastom@reva.tech)"
  And     Just wait for "1.5" seconds
  And     Select ButtonBar "#bedroomsBar" values to "FOUR_PLUS_BEDS"
  And     Check "No" to the combined monthly income question
  And     Select "1 - 2 months" from move in time dropdown
  And     Select "Employee" from lease type dropdown
  And     Clicks "btnSaveAndContinue" button
  And The system redirects to party details for the party guest "Thomas Tom"
  Then The user validates if person application has status "Not Sent"
  And Published Quote for unit "1013"
  When Clicks on 'SEND QUOTE' button from dialog
  And The system redirects to party details for the party guest "Thomas Tom"
  Then The user validates if person application has status "Sent"

# Check person application status "Paid" after made pay
  When Customer clicks on 'Apply Now' link from quote emailed to "qatest+thomastom@reva.tech"
  And Customer read and accept the terms of service : "I have read and agree to the terms and conditions"
  And Start his application and Complete field required in 'Your Basic Info' stepper
    |    Field     |   Value    |  type       |
    | phone        | 2025550114 | phone       |
    | dateOfBirth  | 11/11/1995 | maskedInput |
    | grossIncome  | 100000     |             |
    | addressLine1 | 1225 Harvey Street |     |
    | city         | Seattle    |             |
    | zipCode      | 98106      | maskedInput |
  And  Selects a State from dropdown "Washington (WA)"
  When Clicks 'CONTINUE' button from 'Your Basic Info' stepper
  Then The 'Payment' stepper is shown
  When Clicks 'PAY & CONTINUE' button from 'Payment' stepper
  And Customer fills out the payment form:
        | Field      | Value |
        | name       | Visa  |
        | cardnumber | 4242424242424242 |
        | cvv        | 123   |
  And Selects a card expiration date: "12/2025"
  When Clicks 'PAY' button
  Then The 'Application Additional Info' page should be displayed
  And The user goes to party details for party guest "Thomas Tom"
  Then The user validates if person application has status "Paid"

# Check person application status "Completed" when the application is completed
  When Aplicant member "Thomas Tom" is in part 2
  And Clicks "Renter's Insurance" step if is available
  Then Selects one renter insurance option: "Residents will purchase renter's insurance for the unit from eRenterPlan - www.renterslive.com"
  When Clicks 'I AM DONE' button
  Then The 'Application Complete' page should be displayed
  And  The current tab is closed
  And  Just wait for "1" seconds
  And The user goes to party details for party guest "Thomas Tom"
  Then The user validates if person application has status "Completed"
