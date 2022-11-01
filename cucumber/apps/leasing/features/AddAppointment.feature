@AddAppointment
Feature: Add Appointment
  Cucumber test to test adding an appointment works as expected

Background:
  Given User logs in as "bill@reva.tech" with password "red&reva#"
  And User creates a "New lease" party with a party member called "Jason Doe" with email "__randomEmail(qatest+jason_doe@reva.tech)"

Scenario: Schedule appointment
  When The user clicks the Schedule appointment option from the burger menu
  And  Selects tomorrow in the appointments calendar
  And  Selects the slot "16:00:00" in agent calendar
  And  Clicks on done button
  Then Appointments section should contain an appointment with the guest name "Jason Doe" and with "Bill Smith" as task owner

#Check that appointment is saved properly
  Given User clicks the edit appointment option
  And  Navigates one week in the future
  And  Navigates one week in the past
  When Selects team "Parkmerced Leasing" from the employee drop down

# Disabling these steps as they don't work as expected
# the main problem is that the team calendar does not use a div for the slot but uses mouse coordinates to calculate it
# which makes the automation really hard as we will have to do the click on a specific region inside a div

#  And  Selects the tomorrow "16:00:00" slot in team calendar
#  Then The agent "Bill Smith" should not be displayed in the available agent list
#  When Selects the tomorrow "14:00:00" slot in team calendar
#  Then The agent "Bill Smith" should be displayed in the available agent list
