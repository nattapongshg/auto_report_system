# Metabase Export Script

This script downloads a Metabase question as `xlsx`, `csv`, or `json` using the Metabase API key header.

## File

`scripts/metabase-export.ps1`

## Basic usage

```powershell
$env:METABASE_API_KEY = "YOUR_API_KEY"

.\scripts\metabase-export.ps1 `
  -QuestionUrl "https://metabase-dev.shargethailand.com/question/35-privilege-test-cms-modified" `
  -Format xlsx
```

## Saved dev config

The workspace also includes a saved dev config file:

`config/metabase-dev.env.ps1`

Load it before running:

```powershell
. .\config\metabase-dev.env.ps1
```

Then run the export script:

```powershell
.\scripts\metabase-export.ps1 `
  -QuestionUrl $env:METABASE_DEV_QUESTION_35_URL `
  -Format xlsx
```

Or use the shortcut wrapper for question 35:

```powershell
.\scripts\export-metabase-dev-question-35.ps1 -Format xlsx -OutputPath ".\privilege-test.xlsx"
```

## Save to a custom filename

```powershell
.\scripts\metabase-export.ps1 `
  -QuestionUrl "https://metabase-dev.shargethailand.com/question/35-privilege-test-cms-modified" `
  -ApiKey "YOUR_API_KEY" `
  -Format csv `
  -OutputPath ".\privilege-test.csv"
```

## Pass parameters

Use this only if the Metabase question has filters or template parameters.

```powershell
$json = @'
{
  "parameters": [
    {
      "type": "category",
      "target": ["variable", ["template-tag", "location"]],
      "value": "Bangkok"
    }
  ]
}
'@

.\scripts\metabase-export.ps1 `
  -QuestionUrl "https://metabase-dev.shargethailand.com/question/35-privilege-test-cms-modified" `
  -ApiKey "YOUR_API_KEY" `
  -Format xlsx `
  -ParametersJson $json
```

## Expected requirements

- Your account or API key group can view the question.
- Your key can download results.
- The URL must be a question URL, not a dashboard URL.

## The endpoint this script calls

For the sample URL above, the script turns it into:

```text
POST https://metabase-dev.shargethailand.com/api/card/35/query/xlsx
```
