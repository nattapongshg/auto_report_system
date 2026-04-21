param(
    [Parameter(Mandatory = $false)]
    [string]$BaseUrl = $env:METABASE_DEV_BASE_URL,

    [Parameter(Mandatory = $true)]
    [int]$DatabaseId,

    [Parameter(Mandatory = $false)]
    [string]$ApiKey = $env:METABASE_API_KEY,

    [Parameter(Mandatory = $false)]
    [string]$OutputDirectory = ".\schema"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Convert-ToSlug {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $slug = $Value.ToLowerInvariant()
    $slug = [System.Text.RegularExpressions.Regex]::Replace($slug, "[^a-z0-9]+", "-")
    $slug = $slug.Trim("-")
    if ([string]::IsNullOrWhiteSpace($slug)) {
        return "database-$DatabaseId"
    }

    return $slug
}

function Get-FkLabel {
    param(
        [Parameter(Mandatory = $true)]
        $Field,

        [Parameter(Mandatory = $true)]
        [hashtable]$FieldLookup,

        [Parameter(Mandatory = $true)]
        [hashtable]$TableLookup
    )

    if ($null -eq $Field.fk_target_field_id) {
        return ""
    }

    $targetField = $FieldLookup[[string]$Field.fk_target_field_id]
    if ($null -eq $targetField) {
        return "field_id:$($Field.fk_target_field_id)"
    }

    $targetTable = $TableLookup[[string]$targetField.table_id]
    if ($null -eq $targetTable) {
        return $targetField.name
    }

    return "{0}.{1}" -f $targetTable.name, $targetField.name
}

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    throw "BaseUrl is required. Pass -BaseUrl or set METABASE_DEV_BASE_URL."
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    throw "ApiKey is required. Pass -ApiKey or set METABASE_API_KEY."
}

$headers = @{
    "X-API-Key" = $ApiKey
}

$metadataEndpoint = "{0}/api/database/{1}/metadata" -f $BaseUrl.TrimEnd("/"), $DatabaseId
$metadata = Invoke-RestMethod -Uri $metadataEndpoint -Headers $headers -Method GET

$resolvedOutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedOutputDirectory -Force | Out-Null

$databaseSlug = Convert-ToSlug -Value $metadata.name
$rawJsonPath = Join-Path $resolvedOutputDirectory "$databaseSlug-schema-raw.json"
$markdownPath = Join-Path $resolvedOutputDirectory "$databaseSlug-schema.md"
$fieldsCsvPath = Join-Path $resolvedOutputDirectory "$databaseSlug-fields.csv"

$json = $metadata | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($rawJsonPath, $json, [System.Text.UTF8Encoding]::new($false))

$tableLookup = @{}
$fieldLookup = @{}
foreach ($table in $metadata.tables) {
    $tableLookup[[string]$table.id] = $table
    foreach ($field in $table.fields) {
        $fieldLookup[[string]$field.id] = $field
    }
}

$builder = New-Object System.Text.StringBuilder
$null = $builder.AppendLine("# Data Schema: $($metadata.name)")
$null = $builder.AppendLine()
$null = $builder.AppendLine("- Generated at: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")")
$null = $builder.AppendLine("- Base URL: $BaseUrl")
$null = $builder.AppendLine("- Database ID: $DatabaseId")
$null = $builder.AppendLine("- Engine: $($metadata.engine)")
$null = $builder.AppendLine("- DB Name: $($metadata.details.dbname)")
$null = $builder.AppendLine("- Host: $($metadata.details.host)")
$null = $builder.AppendLine("- Schema filter: $($metadata.details.'schema-filters-patterns')")
$null = $builder.AppendLine("- Table count: $($metadata.tables.Count)")
$fieldCount = ($metadata.tables | ForEach-Object { $_.fields.Count } | Measure-Object -Sum).Sum
$null = $builder.AppendLine("- Field count: $fieldCount")
$null = $builder.AppendLine()
$null = $builder.AppendLine("## Tables")
$null = $builder.AppendLine()

foreach ($table in ($metadata.tables | Sort-Object schema, name)) {
    $qualifiedTableName = if ([string]::IsNullOrWhiteSpace($table.schema)) { $table.name } else { "$($table.schema).$($table.name)" }
    $null = $builder.AppendLine("### $qualifiedTableName")
    $null = $builder.AppendLine()
    $null = $builder.AppendLine("- Table ID: $($table.id)")
    $null = $builder.AppendLine("- Display name: $($table.display_name)")
    $null = $builder.AppendLine("- Entity type: $($table.entity_type)")
    $null = $builder.AppendLine("- Field count: $($table.fields.Count)")
    if ($null -ne $table.estimated_row_count) {
        $null = $builder.AppendLine("- Estimated row count: $($table.estimated_row_count)")
    }
    $null = $builder.AppendLine()
    $null = $builder.AppendLine("| Column | DB Type | Base Type | Semantic Type | Required | Indexed | FK |")
    $null = $builder.AppendLine("| --- | --- | --- | --- | --- | --- | --- |")

    foreach ($field in ($table.fields | Sort-Object position, name)) {
        $semanticType = if ([string]::IsNullOrWhiteSpace($field.semantic_type)) { "" } else { $field.semantic_type }
        $required = if ($field.database_required) { "yes" } else { "no" }
        $indexed = if ($field.database_indexed) { "yes" } else { "no" }
        $fkLabel = Get-FkLabel -Field $field -FieldLookup $fieldLookup -TableLookup $tableLookup
        $null = $builder.AppendLine("| $($field.name) | $($field.database_type) | $($field.base_type) | $semanticType | $required | $indexed | $fkLabel |")
    }

    $null = $builder.AppendLine()
}

[System.IO.File]::WriteAllText($markdownPath, $builder.ToString(), [System.Text.UTF8Encoding]::new($false))

$fieldRows = foreach ($table in ($metadata.tables | Sort-Object schema, name)) {
    foreach ($field in ($table.fields | Sort-Object position, name)) {
        [pscustomobject]@{
            schema         = $table.schema
            table_name     = $table.name
            table_id       = $table.id
            column_name    = $field.name
            column_id      = $field.id
            database_type  = $field.database_type
            base_type      = $field.base_type
            semantic_type  = $field.semantic_type
            required       = [bool]$field.database_required
            indexed        = [bool]$field.database_indexed
            fk_reference   = Get-FkLabel -Field $field -FieldLookup $fieldLookup -TableLookup $tableLookup
        }
    }
}

$fieldRows | Export-Csv -Path $fieldsCsvPath -NoTypeInformation -Encoding UTF8

Write-Host "Schema export complete"
Write-Host "Metadata endpoint : $metadataEndpoint"
Write-Host "Raw JSON          : $rawJsonPath"
Write-Host "Markdown schema   : $markdownPath"
Write-Host "Fields CSV        : $fieldsCsvPath"
Write-Host "Table count       : $($metadata.tables.Count)"
Write-Host "Field count       : $fieldCount"
