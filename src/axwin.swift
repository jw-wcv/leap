// src/axwin.swift
// Build: swiftc -O src/axwin.swift -o axwin
// Requires: macOS Accessibility permission for the terminal/Electron host.

import Cocoa
import ApplicationServices

enum AXWError: Error { case noFrontApp, noWindow, notTrusted, invalidArgs }

func frontmostApp() throws -> AXUIElement {
    guard AXIsProcessTrusted() else { throw AXWError.notTrusted }
    guard let app = NSWorkspace.shared.frontmostApplication else { throw AXWError.noFrontApp }
    return AXUIElementCreateApplication(app.processIdentifier)
}

func firstWindow(_ app: AXUIElement) throws -> AXUIElement {
    var value: CFTypeRef?
    let err = AXUIElementCopyAttributeValue(app, kAXFocusedWindowAttribute as CFString, &value)
    if err == .success, let w = value {
        return (w as! AXUIElement)
    }
    var arr: CFTypeRef?
    if AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &arr) == .success,
       let ws = arr as? [AXUIElement], let w = ws.first {
        return w
    }
    throw AXWError.noWindow
}

func getRect(_ win: AXUIElement) throws -> CGRect {
    var posRef: CFTypeRef?
    var sizeRef: CFTypeRef?
    guard AXUIElementCopyAttributeValue(win, kAXPositionAttribute as CFString, &posRef) == .success,
          AXUIElementCopyAttributeValue(win, kAXSizeAttribute as CFString, &sizeRef) == .success,
          let pos = posRef as? AXValue, let size = sizeRef as? AXValue else { throw AXWError.noWindow }
    var p = CGPoint.zero; var s = CGSize.zero
    AXValueGetValue(pos, .cgPoint, &p)
    AXValueGetValue(size, .cgSize, &s)
    return CGRect(origin: p, size: s)
}

func setRect(_ win: AXUIElement, _ r: CGRect) throws {
    var p = r.origin; var s = r.size
    let pVal = AXValueCreate(.cgPoint, &p)!; let sVal = AXValueCreate(.cgSize, &s)!
    AXUIElementSetAttributeValue(win, kAXPositionAttribute as CFString, pVal)
    AXUIElementSetAttributeValue(win, kAXSizeAttribute as CFString, sVal)
}

func activeScreenBounds() -> CGRect {
    guard let scr = NSScreen.main else { return NSScreen.screens.first?.frame ?? .zero }
    return scr.visibleFrame   // excludes menu bar & dock
}

func snapRect(_ which: String, screen: CGRect) -> CGRect {
    let s = screen
    switch which {
    case "left":   return CGRect(x: s.minX, y: s.minY, width: s.width/2, height: s.height)
    case "right":  return CGRect(x: s.minX + s.width/2, y: s.minY, width: s.width/2, height: s.height)
    case "top":    return CGRect(x: s.minX, y: s.minY + s.height/2, width: s.width, height: s.height/2)
    case "bottom": return CGRect(x: s.minX, y: s.minY, width: s.width, height: s.height/2)
    case "tl":     return CGRect(x: s.minX, y: s.minY + s.height/2, width: s.width/2, height: s.height/2)
    case "tr":     return CGRect(x: s.minX + s.width/2, y: s.minY + s.height/2, width: s.width/2, height: s.height/2)
    case "bl":     return CGRect(x: s.minX, y: s.minY, width: s.width/2, height: s.height/2)
    case "br":     return CGRect(x: s.minX + s.width/2, y: s.minY, width: s.width/2, height: s.height/2)
    case "third-left":
        return CGRect(x: s.minX, y: s.minY, width: s.width/3, height: s.height)
    case "third-center":
        return CGRect(x: s.minX + s.width/3, y: s.minY, width: s.width/3, height: s.height)
    case "third-right":
        return CGRect(x: s.minX + 2*s.width/3, y: s.minY, width: s.width/3, height: s.height)
    case "center":
        return CGRect(x: s.minX + (s.width*0.1), y: s.minY + (s.height*0.1),
                      width: s.width*0.8, height: s.height*0.8)
    case "max":
        return s
    default:
        return s
    }
}

func main() throws {
    let args = CommandLine.arguments.dropFirst()
    guard let cmd = args.first else { throw AXWError.invalidArgs }

    let app = try frontmostApp()
    let win = try firstWindow(app)

    switch cmd {
    case "getBounds":
        let r = try getRect(win)
        print("\(Int(r.origin.x)) \(Int(r.origin.y)) \(Int(r.size.width)) \(Int(r.size.height))")
    case "setBounds":
        guard args.count == 5,
              let x = Double(args[1]), let y = Double(args[2]),
              let w = Double(args[3]), let h = Double(args[4]) else { throw AXWError.invalidArgs }
        try setRect(win, CGRect(x: x, y: y, width: w, height: h))
    case "moveBy":
        guard args.count == 3,
              let dx = Double(args[1]), let dy = Double(args[2]) else { throw AXWError.invalidArgs }
        var r = try getRect(win); r.origin.x += dx; r.origin.y += dy
        try setRect(win, r)
    case "resizeBy":
        guard args.count == 3,
              let dw = Double(args[1]), let dh = Double(args[2]) else { throw AXWError.invalidArgs }
        var r = try getRect(win); r.size.width = max(200, r.size.width + dw); r.size.height = max(150, r.size.height + dh)
        try setRect(win, r)
    case "snap":
        guard args.count == 2 else { throw AXWError.invalidArgs }
        let screen = activeScreenBounds()
        let r = snapRect(String(args[1]), screen: screen)
        try setRect(win, r)
    default:
        throw AXWError.invalidArgs
    }
}

do { try main() }
catch AXWError.notTrusted {
    fputs("ERR not_trusted\n", stderr); exit(2)
}
catch {
    fputs("ERR \(error)\n", stderr); exit(1)
}
