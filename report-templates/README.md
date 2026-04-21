# Report Templates

Sample template definitions for report automation.

## Available

- [monthly-gp-sharing.template.json](/c:/auto_report_system/report-templates/monthly-gp-sharing.template.json)

## How to use

1. Replace `source.questionUrl` with the actual Metabase question URL.
2. Adjust `manualInputs` if the report needs extra values.
3. Adjust `calculations` if revenue or GP rules differ from the sample.
4. Use the template as the payload model for a future backend save API or job runner.
