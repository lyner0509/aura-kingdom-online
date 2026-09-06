# Paragon Table

The admin page edits existing reward slots in `FFAccount.public.lottery`.
Category, schedule, tier and slot identities stay fixed. Item IDs, quantities,
percentage rates and reward flags are editable. Each tier must total 100%.
Item names are read from the game server's `Data/db/T_ItemMall.ini` during each
dashboard deploy. The dashboard sends only names for Item IDs currently used in
the table and looks up a replacement name after an Item ID is edited.

`paragon.sql` creates the snapshot history and grants the dashboard role UPDATE
on only the seven editable lottery columns. Deploy runs this migration before
switching releases. All other game tables remain read-only to the dashboard.

Saves lock reward rows, check the revision read by the editor, and commit the
updated rewards and before/after snapshots in one transaction. A stale editor
receives HTTP 409. History is stored in `dashboard.paragon_history` with the
authenticated administrator and timestamp. No game values change on deployment.

Saving updates the database only. No verified hot-reload command was found;
the page does not claim immediate activation or restart game services. Apply
the game's normal table reload/maintenance procedure before relying on edits
in game. Categories and schedules retain their server IDs until their labels
are verified.

Run `npm test` and `npm run check` before deployment.
