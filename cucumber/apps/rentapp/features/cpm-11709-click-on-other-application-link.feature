@OtherApplicationLink @PR
Feature: Opening another person application link

Scenario: CPM-11709: Applicant2 can see Applicant1 information after complete registration, using Apply Now link

  # Creates a quote with one unit and applies
  Given An agent that creates an application for unit "1018", with Party guest "Ben King" and email "qatest+ben@reva.tech"

  # Customer registers
  When Customer clicks on register link for "qatest+ben@reva.tech"
  Then types "123" as password and clicks on 'Create Account'
  Then 'Application Additional Info' page should be displayed after the account has been created

  # Creates a quote with another unit and applies
  Given An agent that creates an application for unit "1010", with Party guest "Paul Morgan" and email "qatest+paul@reva.tech"

  # Customer opens someone else application link
  When Customer clicks on 'Apply Now' link from another quote, emailed to "qatest+paul@reva.tech"
  Then 'Rentapp Login' page should be displayed
  Then Types "qatest+ben@reva.tech" and "123" as credentials
  Then Clicks on 'SIGN IN' button
  Then 'Application Additional Info' page should be displayed after the account has been created
  And Should contain "Ben K." as applicant name
