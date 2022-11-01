@HoldScreening @PR
Feature: Hold Screening Feature
         Different ways to hold the screening

Scenario: Hold the screening using Application Hold Screening option
  Given Published Quote with unit "1013" has been shared for Party guest "Harold Smith" and email "qatest+harold@reva.tech"
  When  User clicks: "[data-id='holdApplicationScreeningMenu']"
  Then  User clicks: "[data-id='holdScreeningByManualOption']"
  And   Validate if the hold screening banner was shown
  And   Check if "Manual" hold type shows in the banner
  And   User goes back to Dashboard and logs out

# TODO: implement the next scenarios
# Scenario: Hold the screening after create a guarantor with no linking to resident
#   Given Published Quote with unit "1013" has been shared for Party guest "Harold Smith" and email "qatest+harold@reva.tech"
#
# Scenario: Hold the screening after the resident apply using an international address
#   Given Published Quote with unit "1013" has been shared for Party guest "Harold Smith" and email "qatest+harold@reva.tech"
