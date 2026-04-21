# Report Template UI

Standalone UI prototype for:

- selecting a Metabase question as report source
- defining Excel workbook structure
- configuring daily, weekly, or monthly export loops
- setting recipients and email subject
- previewing workbook output and upcoming runs

## Run

Open [index.html](/c:/auto_report_system/report-template-ui/index.html) directly in a browser, or serve the folder as static files.

Example:

```powershell
Set-Location c:\auto_report_system\report-template-ui
python -m http.server 8080
```

Then open `http://localhost:8080`

## Notes

- This is frontend only.
- It does not call Metabase or backend APIs yet.
- Source questions are mocked from the current reporting context:
  - Question `45` Operator Sessions With Invoices
  - Question `44` Operator Station List
  - Question `928` Noble Utilization
