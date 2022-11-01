@Ignore @ScheduleAppointment_Add @Regression @Integration @Sanity @Smoke
Feature: Add a new Schedule appointment
         CPM-140: As a sales agent, I want to schedule an appointment and view
         it in prospect details page.

@TODO
Scenario: CPM-644: Appointment dialog - open new appointment dialog window
  Given    The user opened a 'party prospect details' page with guest:
   | guest |
   | Foo   |
  When    The user clicks the Schedule appointment under (+) menu
  Then    The 'Add Appointment' dialog should be opened
  And     Guest 'Foo' should be in 'guests' field by default
  And     The logged in sales agent is select by default
  And     The 'calendar' should be displayed in the current day on first 'calendar' column
  And     The 'Notes' field is empty
  And     The 'Units shorthand' or 'address' field is empty

@TODO
Scenario: CPM-644: Appointment dialog - add units
  When    User types three letters in 'Units shorthand or address' field with match in db
  And     Clicks on a unit from 'suggestions' window
  Then    Selected 'unit' chip should be displayed in the 'Units shorthand' or 'address' field

@TODO
Scenario: CPM-644: Appointment dialog - add guest
  Given   The guest 'Foo' should be in 'guests' field by default
  When    User types three letters in 'guests' field with match in db
  And     Clicks on a guest from 'suggestions' window
  Then    Selected guest chip should be displayed in the 'guests' field

@TODO
Scenario: CPM-644: Appointment dialog - add notes
  Given   The 'Notes' field is empty
  When    It adds the text 'New meeting with Foo' in 'Notes' field
  And     Out-focus form 'Notes' field
  Then    The text 'New meeting with Foo' should be in 'Notes' field

@TODO
Scenario: CPM-146: Appointment dialog - add time slot in calendar
  Given   The guest 'Foo' is in 'guests' field by default
  When    The user Selects the time slot: '20 Dec 13 PM to 13:30 PM'
  Then    The 'Done' button should be enabled

@TODO
Scenario: CPM-140: Appointment dialog - save the new appointment
  Given   The guest 'Foo' is in 'guests' field by default
  When    The user adds the text 'New meeting with Foo' in 'Notes' field
  And     The user Selects the time slot: 'today 14 PM to 14:30 PM'
  And     He He clicks on 'Done' button
  Then    The 'prospect details' page with the new 'appointment' card should be displayed
