# ch19-line-totaler

AutoCAD plugin that totals the length of selected curves and copies the result to the clipboard.

## Commands

| Command         | Description                                                                 |
|-----------------|-----------------------------------------------------------------------------|
| `CH19TOTAL`     | Prompt to select curves; report total length of the selection.              |
| `CH19TOTALSIM`  | Pick one curve; select all curves of the same type on the same layer and report total. |

## Supported entity types

`LINE`, `LWPOLYLINE`, `POLYLINE`, `ARC`, `SPLINE`, `ELLIPSE`

## Output format

```
[CH19] Totaled 14 entities
  Total:  1847.32 in  (153.94 ft)  (46.94 m)
  By layer:
    CONDUIT-2IN          1204.50 in  (100.38 ft)
    CONDUIT-1IN           642.82 in  (53.57 ft)
  Copied to clipboard: 153.94
```

The feet value is copied to the clipboard automatically.

## Build requirements

- .NET 8 SDK
- AutoCAD 2022–2026 installed (managed DLLs resolved from the install directory)
- Optional: set `AUTOCAD_INSTALL_DIR` to override the default install path probe

## Build

```powershell
dotnet build -c Release Ch19LineTotaler.csproj
```

The output DLL is placed in `bin\Release\<tfm>\Ch19LineTotaler.dll`.

## Install in AutoCAD

**Per-session (NETLOAD):**

```
Command: NETLOAD
→ browse to Ch19LineTotaler.dll
```

**Permanent (acad.lsp):**

Add to your `acad.lsp` or `acaddoc.lsp`:

```lisp
(command "NETLOAD" "C:\\path\\to\\Ch19LineTotaler.dll")
```

## Version history

| Version | Description      |
|---------|------------------|
| 0.1.0   | Initial release  |
