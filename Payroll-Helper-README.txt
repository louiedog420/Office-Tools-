Payroll Helper
==============

A simple way to figure regular pay and overtime for hourly employees.

This folder is meant to be copied, emailed, or put on a USB drive. Nothing
has to be installed. There is no account to create and it does not need
the internet.


What this does
--------------

It takes each person's hours and hourly rate and figures:

  * Regular hours (the first 40 hours in a workweek)
  * Overtime hours (hours over 40 in that same workweek)
  * Snow hours (time worked between 4:00 PM and 7:00 PM, unless you change that window)
  * Regular pay, snow extra, overtime pay, and gross pay

Every hour is first paid at the regular hourly rate (straight-time). Overtime
then adds an extra half of the blended hourly rate for hours over 40.

Snow time: hours between 4:00 PM and 7:00 PM get an extra $5.00 an hour on
top of the regular rate (you can change the $5 and the time window). Those
hours still count toward the 40-hour overtime week.

When someone has overtime AND snow pay, federal rules say the extra $5 has
to be folded into the overtime rate.

Example: 45 hours at $20 an hour, with 5 snow hours
  Straight-time pay: 45 x $20.00 = $900.00
  Snow extra:         5 x $5.00  = $25.00
  Blended rate: ($900.00 + $25.00) / 45 = about $20.56
  Overtime extra: 5 x half of that blended rate = $51.39
  Gross pay = $900.00 + $25.00 + $51.39 = $976.39

Example without snow: 45 hours at $20 an hour
  Straight-time 45 x $20.00 = $900.00
  Overtime extra 5 x half of $20.00 = $50.00
  Gross pay = $950.00

A biweekly paycheck is two separate weeks. Someone who works 50 hours one
week and 30 the next has 10 overtime hours, not zero. The two weeks are
not added together and compared to 80.


What this does NOT do
---------------------

This tool calculates GROSS PAY ONLY. That is the amount before taxes.

It does not take out:
  * Federal or Maryland income tax
  * Social Security or Medicare
  * Unemployment tax
  * Health insurance, retirement, child support, or other deductions

Please keep using your payroll company or accountant to run paychecks,
file taxes, and make tax deposits.

Also check your own workplace rules. Maryland generally follows the
federal overtime rule (hours over 40 in a workweek). Some employers use
other policies, such as daily overtime after 8 hours or double-time on a
holiday. If your company handbook or accountant says something different,
follow that.


Two ways to use it
------------------

1) Payroll-Helper.html  (easiest for most people)
   Double-click this file. It opens in any web browser (Chrome, Edge,
   Safari, Firefox). You do not need to be online.

   This version can read daily hours (8 or 8.5) AND clock times such as
   8:30a / 5p or 8:30a-5p. When you type clock times, it figures snow
   hours (time between 4:00 PM and 7:00 PM) automatically. It saves your
   employee list on that computer, can explain the math for one person
   in plain English, and can print or download a report.

2) Payroll-Helper.xlsx  (if you prefer a spreadsheet)
   Open this in Microsoft Excel or upload it to Google Sheets.

   Type only in the yellow cells. Gray cells have formulas and fill in
   by themselves. This version uses numbers for daily hours (8 or 8.5).
   It does not read clock-in / clock-out times — use the HTML file if
   you want to type times of day.


How to use the HTML file
------------------------

1. Double-click Payroll-Helper.html.
2. At the top, choose Weekly (one week) or Biweekly (two weeks).
3. If you type clock times, set "Unpaid lunch" to the lunch minutes you
   take out (30 is the starting value). Lunch is taken out only when a
   box contains clock times, not when you type a number like 8.
4. Click "Add a person" and type a name, hourly rate, and overtime rate
   (leave 1.5 unless you pay something else).
   Or click "Import employee list" and choose a CSV file with columns:
        Name,Rate
        Maria Garcia,20
        James Lee,18.50
   An optional third column can set the overtime multiplier.
5. Type hours for each day, or type times like 8:30a / 5p.
   Under each day is a small Snow box for hours between 4:00 PM and
   7:00 PM. Clock times fill that in for you. If you typed a number
   like 8, type the snow hours yourself (or put the whole week's snow
   total under one day).
   Optional columns:
        Double-time hours — hours from that week that also get an extra
                            1 x the rate, so they are paid at double time
        Bonus and Tips    — extra amounts added to gross pay
   You can change the snow extra ($5) and the 4:00 PM–7:00 PM window
   in Pay period settings.
6. The pay summary at the bottom shows regular pay, snow pay, overtime,
   and gross pay for each person, plus team totals.
7. Click "Explain" next to anyone to see the math written out in plain
   English.
8. Click "Download pay report (CSV)" to save a spreadsheet-friendly
   file, or "Print pay summary" for a clean page to keep or share.
9. When the next payday comes, click "Start a new pay period." That
   clears hours, bonus, and tips but keeps every name and pay rate.

Your list is saved automatically on that computer (in the browser). If
you open the file on a different computer, import your employee list or
copy the HTML file plus a downloaded CSV.

"Try sample numbers" loads a short demo list so you can see how the
math looks, including the 45-hour overtime example with snow pay
($976.39) and a two-week 50 + 30 hour example (switch to Biweekly
to see both weeks).


How to use the Excel file
-------------------------

Sheet order: Start Here, Settings, Employees, Week 1, Week 2, Summary.

1. Read "Start Here." On Settings you can change the $5 snow extra.
2. On Employees, type each name, hourly rate, and overtime multiplier
   (1.5 is already filled in). There are 35 rows.
3. On Week 1, type hours for Monday through Sunday. Weekend columns can
   stay blank. In Snow Hours, type how many hours that person worked
   between 4:00 PM and 7:00 PM that week (add the days together).
   If needed, type double-time hours in that column.
4. If the paycheck covers two weeks, fill in Week 2 the same way. If
   you only pay weekly, leave Week 2 blank.
5. On Summary, type any bonus or tips in the yellow cells. Check the
   Team totals row.

The sheets are locked so a formula is not easy to overwrite. There is
no password. In Excel you can use Review → Unprotect Sheet if you need
to add more than 35 rows (copy a whole row down on every sheet). In
Google Sheets, protection may not carry over — just remember to type
only in the yellow cells.


Rounding
--------

Hours are rounded to two decimal places (hundredths of an hour).
Money is rounded to the nearest cent.


A note about double-time hours
------------------------------

Federal and Maryland law do not require double-time for most hourly
jobs. If your workplace pays some hours at 2 x the rate (for example a
holiday), type those hours in the double-time box.

Those hours are taken out of the overtime split first. Every hour still
gets straight-time pay; double-time then adds one extra times the hourly
rate so those hours are paid at 2 x the rate. This keeps the same hours
from being paid twice.


A note about snow time
----------------------

Snow hours are not extra hours on the clock. They are hours already
worked that happened to fall between 4:00 PM and 7:00 PM (or the window
you set). They count toward the 40-hour overtime week.

The extra $5 (or whatever amount you set) is added on top of regular
pay. If the person also has overtime that week, that extra is included
when the overtime rate is figured, as the law requires.


Files in this package
---------------------

  Payroll-Helper.html   The easy browser calculator
  Payroll-Helper.xlsx   The spreadsheet version
  README.txt            This how-to page

That is all you need to share.
