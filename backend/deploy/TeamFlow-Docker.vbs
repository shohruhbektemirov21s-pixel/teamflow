' TeamFlow: Startup papkasiga nusxalanadi; autostart.ps1 ni yashirin oynada ishga tushiradi.
Set shell = CreateObject("WScript.Shell")
script = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\TeamFlow\autostart.ps1")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & script & """", 0, False
