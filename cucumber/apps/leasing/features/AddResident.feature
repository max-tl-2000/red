@Ignore @AddResident
Feature: AddResident
  Cucumber test to check adding a resident works as expected

Background:
  Given   User logs out if needed
  # after log in the user is taken to dashboard
  And     User logs in as "bill@reva.tech" with password "red&reva#"

Scenario: Prefill preferredName
  Given   User clicks: "#btnCreateParty"
  And     User types "Adele Brown" in field "#fullName"
  # focus does not cause a blur on the previous element which is sad :(
  When    User clicks: "#phones input"
  Then    TextBox "#preferredName" value is "Adele"

@SkipTenantRefresh
Scenario: Add a contact to a party with full name and preferred name
  Given   User clicks: "#btnCreateParty"
  And     The count of "#partyStepper [data-component='common-person-card']" elements is "0"
  When    User types "Bob Brown" in field "#fullName"
  And     User clicks: "#preferredName"
  And     Just wait for "1" second
  And     User types "Bobby" in field "#preferredName"
  And     User clicks: "#btnCreateResident"
  Then    The count of "#partyStepper [data-component='common-person-card']" elements is "1"
  And     Element "#partyStepper [data-component='common-person-card'] [data-id='cardTitle']" text content is "Bobby"
  And     Element "#partyStepper [data-component='common-person-card'] [data-id='cardTitle'] ~ p" text content is "Bob Brown"
  And     Element "#partyStepper [data-component='common-person-card'] [data-component='validator']" contains text "No contact information"

@SkipTenantRefresh
Scenario: Add a contact with full name and 2 phones
  Given   User clicks: "#btnCreateParty"
  And     The count of "#partyStepper [data-component='common-person-card']" elements is "0"
  When    User types "Adele Brown" in field "#fullName"
  And     User types on MultiTextBox "phones"
          | values     |
          | 4084809389 |
          | 5054337776 |
  And     User clicks: "#btnCreateResident"
  Then    The count of "#partyStepper [data-component='common-person-card']" elements is "1"
  And     Element "#partyStepper [data-component='common-person-card'] [data-id='cardTitle']" text content is "Adele"
  And     Element "#partyStepper [data-component='common-person-card'] [data-id='cardTitle'] ~ p" text content is "Adele Brown"
  And     Element "#partyStepper [data-component='common-person-card'] [data-id='cardTitle'] ~ p ~ p" text content is "2 phones"

@SkipTenantRefresh
Scenario: Add a contact with full name and 2 emails
  Given   User clicks: "#btnCreateParty"
  And     The count of "#partyStepper [data-component='common-person-card']" elements is "0"
  When    User types "Adele Brown" in field "#fullName"
  And     User types on MultiTextBox "emails"
          | values            |
          | __randomEmail(test@reva.tech)    |
          | __randomEmail(test1@reva.tech) |
  And     User clicks: "#btnCreateResident"
  Then    The count of "#partyStepper [data-component='common-person-card']" elements is "1"
  And     Element "#partyStepper [data-component='common-person-card'] [data-id='cardTitle']" text content is "Adele"
  And     Element "#partyStepper [data-component='common-person-card'] [data-id='cardTitle'] ~ p" text content is "Adele Brown"
  And     Element "#partyStepper [data-component='common-person-card'] [data-id='cardTitle'] ~ p ~ p" text content is "2 emails"

@SkipTenantRefresh
Scenario: Add a contact with full name and 1 phone and 1 email
  Given   User clicks: "#btnCreateParty"
  And     The count of "#partyStepper [data-component='common-person-card']" elements is "0"
  When    User types "Adele Brown" in field "#fullName"
  And     User types on MultiTextBox "phones"
          | values     |
          | 4084809389 |
  And     User types on MultiTextBox "emails"
          | values            |
          | __randomEmail(test2@reva.tech)    |
  And     User clicks: "#btnCreateResident"
  Then    The count of "#partyStepper [data-component='common-person-card']" elements is "1"
  And     Element "#partyStepper [data-component='common-person-card'] [data-id='cardTitle']" text content is "Adele"
  And     Element "#partyStepper [data-component='common-person-card'] [data-id='cardTitle'] ~ p" text content is "Adele Brown"
  And     Element "#partyStepper [data-component='common-person-card'] [data-id='cardTitle'] ~ p ~ p" text content is "1 phone, 1 email"

@SkipTenantRefresh
Scenario: Phones MultiTextBox should validate an invalid phone
  Given   User clicks: "#btnCreateParty"
  When    User types "Adele Brown" in field "#fullName"
  And     User types on MultiTextBox "phones"
          | values     |
          | invalid    |
  Then    Element "#phones [data-component='validator']" text content is "Enter a valid phone number"

@SkipTenantRefresh
Scenario: Phones MultiTextBox should validate a duplicated phone
  Given   User clicks: "#btnCreateParty"
  When    User types "Adele Brown" in field "#fullName"
  And     User types on MultiTextBox "phones"
          | values     |
          | 4084809988 |
          | 4084809988 |
  And     User clicks: "#btnCreateResident"
  Then    Element "#phones [data-component='validator']" text content is "Duplicated phone found: +14084809988"

@SkipTenantRefresh
Scenario: Add 2 contacts with full name and 1 phone and 1 email
  Given   User clicks: "#btnCreateParty"
  And     The count of "#partyStepper [data-component='common-person-card']" elements is "0"
  When    User types "Adele Brown" in field "#fullName"
  And     User types on MultiTextBox "phones"
          | values     |
          | 4084809389 |
  And     User types on MultiTextBox "emails"
          | values            |
          | __randomEmail(test@reva.tech)    |
  And     User clicks: "#btnCreateResident"
  And     The count of "#partyStepper [data-component='common-person-card']" elements is "1"
  When    User types "Mark Davis" in field "#fullName"
  And     User types on MultiTextBox "phones"
          | values     |
          | 5054331334 |
  And     User types on MultiTextBox "emails"
          | values            |
          | __randomEmail(test@reva.tech)    |
  And     User clicks: "#btnCreateResident"
  Then    The count of "#partyStepper [data-component='common-person-card']" elements is "2"

# this test depends on the data entered on the previous step
@SkipTenantRefresh
Scenario: Add a contact searching from it on the search panel
  Given   User clicks: "#btnCreateParty"
  And     The count of "#partyStepper [data-component='common-person-card']" elements is "0"
  When    User types "Mark Davis" in field "#fullName"
  Then    The count of "[data-c='person-list'] [data-c='person-list-card']" elements is greater than "0"
  # TODO: implement a cucumber like: User clicks on nth element of ${elements} to select
  # the first/second or nth result found by the selector
  And     User clicks: "[data-c='person-list'] [data-c='person-list-card']"
  Then    The count of "#partyStepper [data-component='common-person-card']" elements is "1"
