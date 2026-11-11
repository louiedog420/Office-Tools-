# Office Tools

Free pages for a small office: payroll, the weekly schedule, time off, bills, hiring, and truck and trailer dates. They open in a web browser. There is nothing to install, no account, and no monthly fee.

The pages are plain HTML. After a page has loaded once, it still works if the internet drops. Nothing you type is uploaded.

## Turn the website on

The address is:

**https://louiedog420.github.io/Office-Tools-/**

The dash at the end of `Office-Tools-` is part of the name. Leave it in.

GitHub does not always switch the website on by itself. A person who can change this repo's settings needs to do this **once**:

1. Open https://github.com/louiedog420/Office-Tools-
2. Click **Settings** (the tab along the top of the repo, not your personal account settings).
3. In the left sidebar, click **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Open the **Actions** tab. If GitHub asks you to allow the workflow, approve **Deploy GitHub Pages**.
6. Wait a minute or two, then open https://louiedog420.github.io/Office-Tools-/

The file `.github/workflows/pages.yml` publishes the site when Source is GitHub Actions. It runs after changes are merged into the **main** branch. A pull request by itself does not update the live site.

If **GitHub Actions** is not in the Source list, use the other choice instead:

1. On the same Pages screen, set **Source** to **Deploy from a branch**.
2. Set the branch to **main** and the folder to **/ (root)**.
3. Click **Save**.
4. Wait a minute, then open the same address.

This only works on a **public** repo, which is the free plan. A private repo may ask you to pay for Pages.

## How your data is stored

Everything you type stays on **this device, in this browser**. Nothing is uploaded. There is no login.

- Use the **same browser** and the **same computer** next time. A different browser, or a different computer, starts empty.
- Click **Backup / Restore all data** every week. That downloads one file with every tool in it. Keep the file somewhere you can find it (a USB drive or a folder you already use).
- Restore puts that file back on the computer you are sitting at.
- If other people use this computer, back up first, then clear the tool before they sit down.
- Do not type Social Security numbers or bank account numbers in any box. Hiring only checks off that the paper form is in the file.

Opening the HTML files one by one from a folder can keep each tool's saved data separate in some browsers. Use the website address above so they all share one saved copy.

## What each tool does

- **Payroll** — Regular pay, snow pay, and overtime. Gross pay only, before taxes. Overtime is hours over 40 in one workweek, at time and a half. A two-week paycheck is figured week by week, not against 80 hours. Snow time (4:00 PM to 7:00 PM unless you change it) adds $5 an hour, still counts toward 40, and is folded into the overtime rate when that week has overtime.
- **Schedule** — The people, the week, and how many people you need each day. It warns you if someone is over 40 hours, if two shifts overlap, if a day is short, or if someone is scheduled on approved time off.
- **Time off** — Requests (pending, approved, or denied), call-outs, tardies, a calendar, and totals for each person.
- **Invoices** — Bills you have to pay and invoices you sent. Overdue items are marked. There is also a simple invoice you can print for a customer.
- **Hiring** — Where each applicant stands, and a checklist for a new hire: offer letter, Form I-9, W-4, Maryland MW 507, direct deposit form, handbook acknowledgment, and emergency contact.
- **Fleet** — Trucks and trailers: unit number, year, make, model, VIN, plate, and the registration, insurance, and inspection dates. Red is expired, orange is within 30 days, gold is within 60 days. The soonest date is at the top.
- **Reports** — One printable page that reads the other tools on this computer: last payroll (including overtime), upcoming and overdue bills, overdue invoices, fleet dates that need attention, pending time off, and open hires.

Each tool has **Load sample** (made-up names only), **Download CSV**, **Import CSV**, **Print**, and **Backup / Restore all data**.

## Day to day

1. Open the website and pick a tool.
2. The first time, click **Load sample** if you want to see how it looks. Those people and trucks are fake.
3. Type your own info. It saves by itself. You will see "Saved on this computer."
4. On payday, use Payroll, then **Print pay summary** or **Download pay report (CSV)**. Click **Start a new pay period** when you are done. Names and pay rates stay. Hours clear. Reports keeps the last payroll that had hours.
5. On Friday, or before anyone else uses the computer, click **Download backup (JSON)**.

Payroll can also read a spreadsheet of names and rates. The first line can be:

```text
Name,Rate
Maria Garcia,20
James Lee,18.50
```

An optional third column sets the overtime multiplier (leave it off to use 1.5). You can also download **Payroll-Helper.xlsx** from the Payroll page if you would rather type in Excel. The longer spreadsheet notes are in `Payroll-Helper-README.txt`. The spreadsheet does not read clock-in times. The web page does (`8:30a / 5p`).

Payroll does **not** take out taxes, Social Security, Medicare, insurance, or child support. Keep using your payroll company or accountant for paychecks and tax deposits. Maryland generally follows the federal rule (hours over 40 in a workweek). If your handbook says something else, follow the handbook.

## For someone changing the pages

The site is the files in this folder. There is no build step. `css/suite.css` is the shared look. `js/payroll-calc.js` is the payroll math (the same rules as the original calculator). `js/schedule-logic.js` is the over-40 and overlap checks. `js/due-dates.js` is the expiration colors.

To run the tests on a computer that has Node installed:

```bash
node tests/run.js
```

That checks payroll math, the over-40 warning, expiration colors (expired, 30 days, 60 days), and that the home page links to every tool.
