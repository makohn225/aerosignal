import Foundation
import Network
import Capacitor

/// Listens for GDL 90 datagrams (UDP, port 4000 by default) from a portable ADS-B receiver on the
/// same Wi-Fi network and passes each datagram to the web app as base64 ("data" events).
/// iOS asks the pilot for Local Network permission the first time (NSLocalNetworkUsageDescription).
@objc(AeroGdl90Plugin)
public class AeroGdl90Plugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AeroGdl90Plugin"
    public let jsName = "AeroGdl90"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "aero.gdl90")

    @objc func start(_ call: CAPPluginCall) {
        let port = call.getInt("port") ?? 4000
        if listener != nil { call.resolve(); return }
        guard let p = NWEndpoint.Port(rawValue: UInt16(port)) else { call.reject("Bad port"); return }
        do {
            let params = NWParameters.udp
            params.allowLocalEndpointReuse = true
            let l = try NWListener(using: params, on: p)
            l.newConnectionHandler = { [weak self] conn in
                conn.start(queue: self?.queue ?? .global())
                self?.receive(conn)
            }
            l.start(queue: queue)
            listener = l
            call.resolve()
        } catch {
            call.reject("Could not open UDP port \(port): \(error.localizedDescription)")
        }
    }

    private func receive(_ conn: NWConnection) {
        conn.receiveMessage { [weak self] data, _, _, error in
            if let d = data, !d.isEmpty {
                self?.notifyListeners("data", data: ["b64": d.base64EncodedString()])
            }
            if error == nil { self?.receive(conn) }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        listener?.cancel()
        listener = nil
        call.resolve()
    }
}
