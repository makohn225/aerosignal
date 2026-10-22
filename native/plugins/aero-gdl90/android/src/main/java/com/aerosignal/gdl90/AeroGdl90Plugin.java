package com.aerosignal.gdl90;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetSocketAddress;

/**
 * Listens for GDL 90 datagrams (UDP, port 4000 by default) from a portable ADS-B receiver on the
 * same Wi-Fi network and passes each datagram to the web app as base64 ("data" events).
 * Many receivers broadcast, so a Wi-Fi multicast lock is held while listening.
 */
@CapacitorPlugin(name = "AeroGdl90")
public class AeroGdl90Plugin extends Plugin {
    private DatagramSocket socket;
    private Thread worker;
    private volatile boolean running = false;
    private WifiManager.MulticastLock lock;

    @PluginMethod
    public void start(PluginCall call) {
        int port = call.getInt("port", 4000);
        if (running) { call.resolve(); return; }
        try {
            WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) { lock = wm.createMulticastLock("aero-gdl90"); lock.setReferenceCounted(false); lock.acquire(); }
            socket = new DatagramSocket(null);
            socket.setReuseAddress(true);
            socket.setBroadcast(true);
            socket.bind(new InetSocketAddress(port));
        } catch (Exception e) {
            release();
            call.reject("Could not open UDP port " + port, e);
            return;
        }
        running = true;
        worker = new Thread(() -> {
            byte[] buf = new byte[8192];
            while (running) {
                try {
                    DatagramPacket p = new DatagramPacket(buf, buf.length);
                    socket.receive(p);
                    JSObject o = new JSObject();
                    o.put("b64", Base64.encodeToString(buf, 0, p.getLength(), Base64.NO_WRAP));
                    notifyListeners("data", o);
                } catch (Exception e) {
                    if (!running) break;
                }
            }
        }, "aero-gdl90");
        worker.start();
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        release();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() { release(); }

    private void release() {
        running = false;
        if (socket != null) { socket.close(); socket = null; }
        if (lock != null && lock.isHeld()) lock.release();
        lock = null;
    }
}
