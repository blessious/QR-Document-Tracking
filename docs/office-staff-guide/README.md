# LGU DocTrack office staff guide

This folder contains the print-ready quick guide and the reproducible builder.

## Deliverables

- `lgu-doctrack-office-staff-quick-guide.pdf` - two-page A4 portrait quick guide.
- `build_guide.py` - ReportLab builder for regenerating the PDF.
- `../../public/help/office-staff/` - reusable illustration panels.

## Source-of-truth screens

The guide follows the current application routes and labels:

- `/` - sign in.
- `/documents` - Document registry.
- `/documents/new` - Create Tracking Slip.
- `/office` - office worklist and custody tabs.
- `/incoming` - Expected incoming.
- `/scanner` - camera or manual QR scan.
- `/documents/:docId` - current state, custody timeline, attachments, and actions.
- `/filing` - completed documents and archive locations.
- `/track` - public tracking without sign-in.

The instructions reflect the custody rules in `MANUAL_TESTING.md`: correct-office receipt, explicit destination selection, remarks for holds and returns, completion by the current custody office, filing, wrong-office exceptions, and retry after connection recovery.

## Regenerate

From the repository root:

```powershell
python docs/office-staff-guide/build_guide.py
Copy-Item output/pdf/lgu-doctrack-office-staff-quick-guide.pdf docs/office-staff-guide/lgu-doctrack-office-staff-quick-guide.pdf -Force
```
