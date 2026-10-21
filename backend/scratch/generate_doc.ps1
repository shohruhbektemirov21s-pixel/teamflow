$ErrorActionPreference = "Stop"

$desktopPath = [Environment]::GetFolderPath('Desktop')
[string]$targetFile = Join-Path $desktopPath "TeamFlow_Profillar_Login_Parollar.docx"

if (Test-Path $targetFile) {
    Remove-Item $targetFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Word application initializing..."
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Add()

try {
    # Page setup: A4 Landscape, 0.5 in margins (36 pt)
    $doc.PageSetup.Orientation = 1
    $doc.PageSetup.TopMargin = 36
    $doc.PageSetup.BottomMargin = 36
    $doc.PageSetup.LeftMargin = 36
    $doc.PageSetup.RightMargin = 36

    # Colors (BGR hex)
    $cNavy     = 0x7A2E14 # Deep Slate Navy
    $cLightBg  = 0xF8FAFC
    $cZebra    = 0xF1F5F9
    $cBorder   = 0xD8E0E8
    $cWhite    = 0xFFFFFF
    $cTextDark = 0x1E293B
    $cGray     = 0x64748B
    $cPurple   = 0x9333EA

    # Title
    $pTitle = $doc.Paragraphs.Add()
    $pTitle.Range.Text = "TeamFlow - Foydalanuvchilar, login va parollar royxati"
    $pTitle.Range.Font.Name = "Calibri"
    $pTitle.Range.Font.Size = 18
    $pTitle.Range.Font.Bold = $true
    $pTitle.Range.Font.Color = $cNavy
    $pTitle.Range.ParagraphFormat.SpaceAfter = 3
    $pTitle.Range.ParagraphFormat.Alignment = 0
    $pTitle.Range.InsertParagraphAfter()

    # Subtitle / Metadata
    $today = Get-Date -Format "dd.MM.yyyy"
    $pSub = $doc.Paragraphs.Add()
    $pSub.Range.Text = "Tizim manzili: http://127.0.0.1:8020/  |  Django Admin: http://127.0.0.1:8020/admin/  |  Hujjat sanasi: $today"
    $pSub.Range.Font.Name = "Calibri"
    $pSub.Range.Font.Size = 10
    $pSub.Range.Font.Italic = $true
    $pSub.Range.Font.Color = $cGray
    $pSub.Range.ParagraphFormat.SpaceAfter = 12
    $pSub.Range.InsertParagraphAfter()

    # Table columns: No, Rol, FISH, Login, Parol, Bolim/Soha, Imkoniyatlari
    $headers = @("No", "Rol / Lavozim", "F.I.SH.", "Login", "Parol", "Mutaxassislik / Bolim", "Tizimdagi asosiy imkoniyatlari va vazifasi")

    $rows = @(
        @{
            No = "1";
            Role = "Administrator`n(Superuser)";
            Name = "Administrator";
            Login = "admin";
            Password = "admin";
            Dept = "Tizim ma'muriyati";
            Desc = "Django Admin (/admin) orqali tizimni to'liq boshqarish: yangi xodimlarni tasdiqlash/faollashtirish, rollarni belgilash, Boshliq hisobini yaratish, ma'lumotlar bazasini nazorat qilish.";
        },
        @{
            No = "2";
            Role = "Boshliq`n(Boss)";
            Name = "Akmal Karimov";
            Login = "boshliq";
            Password = "Demo-parol-2026";
            Dept = "Boshqaruv";
            Desc = "Tashkilot rahbari. Barcha bo'limlar buyurtmalari, loyihalar va vazifalar holatini kuzatish, haftalik/oylik hisobotlar, xodimlar ish yuki tahlili va boshqaruv qarorlarini qabul qilish.";
        },
        @{
            No = "3";
            Role = "Loyiha menejeri`n(PM)";
            Name = "Sardor Rustamov";
            Login = "pm";
            Password = "Demo-parol-2026";
            Dept = "Loyiha menejeri";
            Desc = "Boshqarmalardan tushgan buyurtmalarni (TZ) qabul qilish, yangi loyihalar ochish, dasturchilar jamoasini shakllantirish, vazifalar va topshiriqlarni taqsimlash, bajarilgan ishlarni tekshirish.";
        },
        @{
            No = "4";
            Role = "Dasturchi`n(Backend)";
            Name = "Jasur Alimov";
            Login = "jasur";
            Password = "Demo-parol-2026";
            Dept = "Backend dasturchi";
            Desc = "O'ziga biriktirilgan vazifalar va topshiriqlar (sub-task) ustida ishlash, statuslarni o'zgartirish (Bajarilmoqda -> Tekshiruvga yuborish), hisobot yozish, ish jurnali yuritish.";
        },
        @{
            No = "5";
            Role = "Dasturchi`n(Frontend)";
            Name = "Malika Karimova";
            Login = "malika";
            Password = "Demo-parol-2026";
            Dept = "Frontend dasturchi";
            Desc = "Foydalanuvchi interfeysi (UI/UX) va frontend qismi vazifalarini bajarish, topshiriqlarni yakunlash, tekshiruvga hisobot topshirish, portfolioga ishlar kiritish.";
        },
        @{
            No = "6";
            Role = "Dasturchi`n(Mobil)";
            Name = "Bobur Rahimov";
            Login = "bobur";
            Password = "Demo-parol-2026";
            Dept = "Mobil dasturchi";
            Desc = "Mobil ilovalar bo'yicha ishlab chiqish vazifalarini bajarish, loyiha jamoasida ishtirok etish, topshiriqlar bajarilishi bo'yicha hisobot berish.";
        },
        @{
            No = "7";
            Role = "Boshqarma`n(Buyurtmachi)";
            Name = "Shoxrux Hamidov";
            Login = "it_boshqarma";
            Password = "Demo-parol-2026";
            Dept = "Axborot texnologiyalari`nboshqarmasi";
            Desc = "Tizimga yangi buyurtma (TZ hujjati bilan) yuborish, buyurtma holatini kuzatish, loyiha yakunlanganda PM yuborgan hisobot va fayllarni tekshirib tasdiqlash yoki rad etish.";
        },
        @{
            No = "8";
            Role = "Oddiy foydalanuvchi`n(User)";
            Name = "Oddiy Foydalanuvchi";
            Login = "oddiy";
            Password = "Demo-parol-2026";
            Dept = "Boshqaruv";
            Desc = "Ro'yxatdan yangi o'tgan foydalanuvchi namunasi. Tizimga kira oladi, biroq vazifalar yoki buyurtmalar doirasi uning rolini admin tasdiqlamaguncha cheklangan bo'ladi.";
        }
    )

    $numRows = $rows.Count + 1
    $numCols = $headers.Count

    $range = $doc.Paragraphs.Add().Range
    $table = $doc.Tables.Add($range, $numRows, $numCols)

    # Borders
    $table.Borders.Enable = $true
    $table.Borders.InsideColor = $cBorder
    $table.Borders.OutsideColor = $cBorder
    $table.Borders.InsideLineStyle = 1
    $table.Borders.OutsideLineStyle = 1
    $table.Borders.InsideLineWidth = 4
    $table.Borders.OutsideLineWidth = 8

    # Column widths (Points, total ~760 pt for A4 landscape)
    $colWidths = @(28, 92, 105, 80, 115, 110, 230)
    for ($c = 1; $c -le $numCols; $c++) {
        $table.Columns.Item($c).SetWidth($colWidths[$c - 1], 2)
    }

    # Header row
    for ($c = 1; $c -le $numCols; $c++) {
        $cell = $table.Cell(1, $c)
        $cell.Range.Text = $headers[$c - 1]
        $cell.Range.Font.Name = "Calibri"
        $cell.Range.Font.Size = 10.5
        $cell.Range.Font.Bold = $true
        $cell.Range.Font.Color = $cWhite
        $cell.Shading.BackgroundPatternColor = $cNavy
        $cell.VerticalAlignment = 1
        if ($c -eq 1 -or $c -eq 4 -or $c -eq 5) {
            $cell.Range.ParagraphFormat.Alignment = 1
        } else {
            $cell.Range.ParagraphFormat.Alignment = 0
        }
    }
    $table.Rows.Item(1).Height = 24
    $table.Rows.Item(1).HeadingFormat = $true

    # Data rows
    for ($r = 0; $r -lt $rows.Count; $r++) {
        $item = $rows[$r]
        $rowIdx = $r + 2
        $row = $table.Rows.Item($rowIdx)
        $row.Height = 30

        $bg = if ($r % 2 -eq 1) { $cZebra } else { $cWhite }

        for ($c = 1; $c -le $numCols; $c++) {
            $cell = $table.Cell($rowIdx, $c)
            $cell.Shading.BackgroundPatternColor = $bg
            $cell.VerticalAlignment = 1

            $font = $cell.Range.Font
            $font.Name = "Calibri"
            $font.Size = 9.5
            $font.Color = $cTextDark

            switch ($c) {
                1 {
                    $cell.Range.Text = $item.No
                    $cell.Range.ParagraphFormat.Alignment = 1
                    $font.Bold = $true
                }
                2 {
                    $cell.Range.Text = $item.Role
                    $cell.Range.ParagraphFormat.Alignment = 0
                    $font.Bold = $true
                }
                3 {
                    $cell.Range.Text = $item.Name
                    $cell.Range.ParagraphFormat.Alignment = 0
                    $font.Bold = $true
                }
                4 {
                    $cell.Range.Text = $item.Login
                    $cell.Range.ParagraphFormat.Alignment = 1
                    $font.Name = "Consolas"
                    $font.Bold = $true
                    $font.Color = 0x0F172A
                }
                5 {
                    $cell.Range.Text = $item.Password
                    $cell.Range.ParagraphFormat.Alignment = 1
                    $font.Name = "Consolas"
                    $font.Bold = $true
                    $font.Color = $cPurple
                }
                6 {
                    $cell.Range.Text = $item.Dept
                    $cell.Range.ParagraphFormat.Alignment = 0
                }
                7 {
                    $cell.Range.Text = $item.Desc
                    $cell.Range.ParagraphFormat.Alignment = 0
                    $font.Size = 9
                    $font.Color = 0x334155
                }
            }
        }
    }

    # Notes below table
    $pNotes = $doc.Paragraphs.Add()
    $pNotes.Range.ParagraphFormat.SpaceBefore = 14
    $pNotes.Range.Text = "Muhim eslatmalar va yo'riqnoma:"
    $pNotes.Range.Font.Name = "Calibri"
    $pNotes.Range.Font.Size = 10.5
    $pNotes.Range.Font.Bold = $true
    $pNotes.Range.Font.Color = $cNavy
    $pNotes.Range.InsertParagraphAfter()

    $bullets = @(
        "Standart demo parol: Barcha sinov foydalanuvchilari (admin'dan tashqari) uchun yagona parol: Demo-parol-2026",
        "Administrator hisobi: Login: admin, Parol: admin (Django admin paneliga kirish manzili: http://127.0.0.1:8020/admin/)",
        "Serverni ishga tushirish: Windows yoqilganda tizim avtomatik ishga tushadi, yoki backend papkasida 'start_server.bat' faylini ishga tushiring.",
        "Telegram bildirishnomalar: Tizim @taskbildirishnomasi_bot Telegram boti bilan integratsiya qilingan. Profil sahifasida Telegram chat ulanadi."
    )

    foreach ($b in $bullets) {
        $p = $doc.Paragraphs.Add()
        $p.Range.Text = "- " + $b
        $p.Range.Font.Name = "Calibri"
        $p.Range.Font.Size = 9.5
        $p.Range.Font.Color = 0x475569
        $p.Range.ParagraphFormat.SpaceAfter = 2
        $p.Range.ParagraphFormat.LeftIndent = 12
        $p.Range.InsertParagraphAfter()
    }

    # Save document
    Write-Host "Saving file to: $targetFile"
    [object]$saveObj = [string]$targetFile
    $doc.SaveAs([ref]$saveObj)
    Write-Host "Successfully saved: $targetFile"

} finally {
    [object]$saveChanges = [bool]$false
    $doc.Close([ref]$saveChanges)
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
}

if (Test-Path $targetFile) {
    Write-Host "VERIFIED: File exists on Desktop! Size: $((Get-Item $targetFile).Length) bytes"
} else {
    Write-Error "File could not be found on Desktop!"
}
