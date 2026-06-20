Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("d:\New folder\ICS-Guard_Assignment_Guide.docx")
$entry = $zip.GetEntry("word/document.xml")
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$xml = $reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()

$xml = $xml -replace '<w:p[^>]*>', "`n"
$xml = $xml -replace '<[^>]+>', ''
Write-Output $xml
