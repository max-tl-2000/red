@Ignore @ScheduleAppointment_Update @Regression @Integration @Sanity @Smoke
Feature: Update a Schedule appointment
         CPM-140: As a sales agent, I want to schedule an appointment and view
         it in prospect details page.

Background:
  Given   A 'party prospect details' page is opened with one appointment in it
  And     User clicked on 'Edit' button in the 'appointment' card
  And     The "Add Appointment" dialog should be opened

@TODO
Scenario: CPM-645: Appointment dialog - update the calendar view on changing agent
  When    There is a second sales agent that has an appointment set for "today 13 PM to 13:30 PM"
  Then    The user selects the second sales agent in the "Appointment" dialog calendar
  And     The time slot "13 PM to 13:30 PM" should display as filled

@TODO
Scenario: CPM-645: Appointment dialog - update the calendar view with slot selected
  When    There is a second sales agent that has an appointment set for "today 13 PM to 13:30 PM"
  And     The user Selects the time slot: "today 14 PM to 14:30 PM"
  And     The user selects the second sales agent in the "Appointment" dialog calendar
  Then    The time slot "13 PM to 13:30 PM" and "14 PM to 14:30 PM" should be filled

@TODO
Scenario: CPM-140: Appointment dialog - display agents in sorted list
  When    There are four more agents registered in the app
  And     The user clicks on the "agents" drop down menu
  Then    The "agents" drop down should diplay all agents in "a-z" order

@TODO
Scenario: CPM-140: Appointment dialog - navigate to next week in calendar
  When    The user clicks on "calendar" next week arrow button
  Then    The calendar should display the next seven days
  When    Clicks on "done" button in "appointment" dialog
  Then    The "prospect details" page with the new "appointment" card should be displayed
