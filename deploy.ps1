# Publish to https://xiaomofang.github.io
$ErrorActionPreference = "Stop"

$gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) {
    $gh = "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe"
}
if (-not (Test-Path $gh)) {
    Write-Host "GitHub CLI not found. Install from https://cli.github.com/" -ForegroundColor Red
    exit 1
}

& $gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Please login first:" -ForegroundColor Yellow
    Write-Host "  & `"$gh`" auth login" -ForegroundColor Cyan
    exit 1
}

Set-Location $PSScriptRoot

if (-not (Test-Path ".git")) {
    git init
    git config user.name "xiaomofang"
    git config user.email "2206635207@qq.com"
}

git add .
$status = git status --porcelain
if ($status) {
    $msg = $args[0]
    if (-not $msg) { $msg = "chore: update site content" }
    git commit -m $msg
}

git branch -M main

$repo = "xiaomofang.github.io"
$remote = git remote get-url origin 2>$null
if (-not $remote) {
    & $gh repo create $repo --public --source=. --remote=origin --push
} else {
    git push -u origin main
}

Write-Host ""
Write-Host "Published → https://xiaomofang.github.io" -ForegroundColor Green
