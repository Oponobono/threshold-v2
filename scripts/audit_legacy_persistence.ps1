<#
.SYNOPSIS
    Audits the codebase for legacy flashcard persistence patterns outside of FlashcardDomainService.

.DESCRIPTION
    Searches for direct calls to persistence primitives (repository.create, addLocalCard, uuidv4, etc.)
    that should only exist inside FlashcardDomainService.

    Run this periodically to catch any new violations of the AI Domain v2.0 invariant:
    "Toda persistencia de mazos generados por IA debe pasar por FlashcardDomainService."

.USAGE
    pwsh scripts/audit_legacy_persistence.ps1

.OUTPUT
    Lists files and line numbers where violations were found.
    Exits with code 0 if clean, 1 if violations found.
#>

param(
    [string]$Root = "$PSScriptRoot\..\mobile\src"
)

$patterns = @(
    @{ Label = "addLocalCard(";             Pattern = "addLocalCard\(" },
    @{ Label = "flashcardDeckRepository.create("; Pattern = "flashcardDeckRepository\.create\(" },
    @{ Label = "flashcardRepository.create(";     Pattern = "flashcardRepository\.create\(" },
    @{ Label = "INSERT INTO flashcard";      Pattern = "INSERT INTO flashcard" },
    @{ Label = "v4 as uuidv4 (in components)"; Pattern = "v4 as uuidv4" }
)

# Paths that are ALLOWED to contain these patterns (domain service and its test)
$allowList = @(
    "FlashcardDomainService.ts",
    "FlashcardDomainService.test.ts",
    "AIProtocolIntegration.test.ts",  # mocks
    "localFlashcardService.ts",       # legacy service (definition, not callers)
    "flashcards.ts",                  # API layer (createFlashcardDeck uses create legitimately)
    "FlashcardDeckRepository.ts",
    "FlashcardRepository.ts",
    "migrateFlashcardsFromMMKV.ts",   # one-time migration
    "BootstrapManager.ts",            # initial sync upsert path
    "createFlashcardDeck"             # API-level function, not UI
)

$violations = @()

foreach ($p in $patterns) {
    $matches = Get-ChildItem -Path $Root -Recurse -Include "*.ts","*.tsx" |
        Select-String -Pattern $p.Pattern |
        Where-Object {
            $file = $_.Filename
            -not ($allowList | Where-Object { $file -like "*$_*" })
        }

    foreach ($m in $matches) {
        $violations += [PSCustomObject]@{
            Pattern = $p.Label
            File    = $m.Path.Replace($Root, "mobile/src")
            Line    = $m.LineNumber
            Content = $m.Line.Trim()
        }
    }
}

if ($violations.Count -eq 0) {
    Write-Host "`n✅ CLEAN — No legacy persistence patterns found outside FlashcardDomainService.`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ VIOLATIONS FOUND — The following patterns must be moved to FlashcardDomainService:`n" -ForegroundColor Red
    $violations | Format-Table -AutoSize Pattern, File, Line, Content
    Write-Host "Total violations: $($violations.Count)`n" -ForegroundColor Red
    exit 1
}
