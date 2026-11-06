param(
  [switch]$Rebuild
)

if ($Rebuild) {
  python backend/pipeline.py
}

python backend/server.py
