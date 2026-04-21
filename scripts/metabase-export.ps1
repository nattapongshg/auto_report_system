param(
    [Parameter(Mandatory = $true)]
    [string]$QuestionUrl,

    [Parameter(Mandatory = $false)]
    [string]$ApiKey = $env:METABASE_API_KEY,

    [Parameter(Mandatory = $false)]
    [ValidateSet("xlsx", "csv", "json")]
    [string]$Format = "xlsx",

    [Parameter(Mandatory = $false)]
    [string]$OutputPath,

    [Parameter(Mandatory = $false)]
    [string]$ParametersJson = "{}",

    [Parameter(Mandatory = $false)]
    [int]$TimeoutSec = 300
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-QuestionInfo {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url
    )

    $uri = [System.Uri]$Url
    $match = [System.Text.RegularExpressions.Regex]::Match(
        $uri.AbsolutePath,
        "^/question/(?<id>\d+)(?:-(?<slug>[^/?#]+))?$"
    )

    if (-not $match.Success) {
        throw "Question URL must look like https://host/question/35-report-name"
    }

    $baseUrl = "{0}://{1}" -f $uri.Scheme, $uri.Authority
    $questionId = $match.Groups["id"].Value
    $slug = $match.Groups["slug"].Value

    if ([string]::IsNullOrWhiteSpace($slug)) {
        $slug = "metabase-question-$questionId"
    }

    return @{
        BaseUrl    = $baseUrl
        QuestionId = $questionId
        Slug       = $slug
    }
}

function Get-OutputFilePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RequestedPath,

        [Parameter(Mandatory = $true)]
        [string]$Slug,

        [Parameter(Mandatory = $true)]
        [string]$Format
    )

    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        return [System.IO.Path]::GetFullPath($RequestedPath)
    }

    $fileName = "{0}-{1}.{2}" -f $Slug, (Get-Date -Format "yyyyMMdd-HHmmss"), $Format
    return [System.IO.Path]::Combine((Get-Location).Path, $fileName)
}

function Read-ErrorResponse {
    param(
        [Parameter(Mandatory = $true)]
        [System.Exception]$Exception
    )

    if (-not ($Exception.PSObject.Properties.Name -contains "Response")) {
        return $Exception.Message
    }

    if (-not $Exception.Response) {
        return $Exception.Message
    }

    try {
        $stream = $Exception.Response.GetResponseStream()
        if ($null -eq $stream) {
            return $Exception.Message
        }

        $reader = New-Object System.IO.StreamReader($stream)
        return $reader.ReadToEnd()
    }
    catch {
        return $Exception.Message
    }
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    throw "API key is required. Pass -ApiKey or set METABASE_API_KEY."
}

$questionInfo = Get-QuestionInfo -Url $QuestionUrl
$outputFile = Get-OutputFilePath -RequestedPath $OutputPath -Slug $questionInfo.Slug -Format $Format
$endpoint = "{0}/api/card/{1}/query/{2}" -f $questionInfo.BaseUrl, $questionInfo.QuestionId, $Format

try {
    $null = $ParametersJson | ConvertFrom-Json
}
catch {
    throw "ParametersJson must be valid JSON. Example: '{}' or '{""parameters"":[]}'"
}

$headers = @{
    "X-API-Key"   = $ApiKey
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-WebRequest `
        -Uri $endpoint `
        -Method POST `
        -Headers $headers `
        -Body $ParametersJson `
        -OutFile $outputFile `
        -TimeoutSec $TimeoutSec

    $file = Get-Item -LiteralPath $outputFile

    Write-Host "Download complete"
    Write-Host "Question ID : $($questionInfo.QuestionId)"
    Write-Host "Endpoint    : $endpoint"
    Write-Host "Saved file  : $($file.FullName)"
    Write-Host "Size (bytes): $($file.Length)"
}
catch {
    $errorText = Read-ErrorResponse -Exception $_.Exception
    Write-Error "Metabase export failed. $errorText"
    exit 1
}
