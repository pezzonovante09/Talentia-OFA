# Deleting your Talentia data

> DRAFT FOR LEGAL REVIEW. Do not publish. The stores require this page (link in Google Play and App
> Store) and it must open without signing in. Publication URL: [[OWNER: page URL]].

## In short

In version 1 **Talentia has no accounts and no cloud**: we do not hold your data and cannot delete it
for you - it exists only on your device. You delete it yourself, quickly and irreversibly.

## How to delete your child's data

1. Open the app and enter the For adults section (PIN).
2. Open "Data". [[OWNER: match the menu names to the finished screens.]]
3. Choose an action:
   - **Export** - save a copy of the data as a file (do this first if you want a copy);
     [[OWNER: there is no export screen yet (question 83, No. 184): by release, either a screen or remove this item.]]
   - **Clear progress** - the child's profile stays, learning progress is erased;
   - **Delete child profile** - erases the profile, the name (if any), lesson runs, skill mastery,
     ABA mode data, cache and the export file;
   - **Delete all data** - the same for all profiles, plus the PIN and consent log
     (in the code `wipeDevice` also erases the consent log; afterwards nothing is left on the device).
4. Confirm. There is no undo and no trash.

You can also delete the data by **uninstalling the app** from the device.

## What remains

- After **"Delete child profile"** the device keeps the consent log with no link to the child (the
  identifier is replaced with a random one) as evidence that consent was given and withdrawn;
  retention: [[LAWYER: period; three years in the spec]].
- After **"Delete all data"** nothing remains, including the consent log and PIN.
- Off the device: nothing, because version 1 sends no data anywhere.

[[OWNER/LAWYER: the text above follows the code (`purge.ts`: `purgeChild` keeps the log under a
pseudonym, `wipeDevice` erases it). `PARENT.md` ("Deletion and export") says the log survives deletion,
but that was written for the cloud version, where the server holds it. Decide: (a) keep as is - "Delete
everything" also erases the log, so no consent evidence stays on the device; (b) change the code so that
"Delete everything" keeps the log under a pseudonym, and then say here and in the privacy policy
(section 7) that it remains.]]

## Cloud and AI (future versions)

Version 1 has no such features. When they appear, this page will describe deleting the account and
cloud data: confirmation by emailed code, a choice for each child (hand over to the second parent or
delete), what remains (the consent log under a pseudonym, sign-in logs held by the authentication
provider under its own retention) and the timelines. [[OWNER: timelines for physical deletion from the
cloud and from the provider's backups.]]

## Cannot delete?

Write to [[OWNER: contact email]]. We cannot access data on your device, but we will help with
instructions. Response time: [[OWNER/LAWYER: deadline]].
