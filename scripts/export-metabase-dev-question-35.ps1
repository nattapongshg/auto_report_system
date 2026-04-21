param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("xlsx", "csv", "json")]
    [string]$Format = "xlsx",

    [Parameter(Mandatory = $false)]
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. "$PSScriptRoot\..\config\metabase-dev.env.ps1"

& "$PSScriptRoot\metabase-export.ps1" `
    -QuestionUrl $env:METABASE_DEV_QUESTION_35_URL `
    -ApiKey $env:METABASE_API_KEY `
    -Format $Format `
    -OutputPath $OutputPath
