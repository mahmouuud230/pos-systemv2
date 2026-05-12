/** @odoo-module **/
/**
 * backend_barcode_scanner.js
 *
 * Adds a camera scan button next to every barcode field in the Odoo backend.
 * Works on the product form, product variant form, and any other model
 * that has a field named `barcode`.
 *
 * How it works:
 *   1. A small camera button appears next to the barcode text input
 *   2. Cashier/admin taps it — camera modal opens fullscreen
 *   3. Phone camera scans the barcode
 *   4. Number is automatically inserted into the barcode field
 *   5. Modal closes — user can save the product normally
 *
 * iOS Safari requirements (all met):
 *   - Must be HTTPS (enforced by our stack)
 *   - getUserMedia must be triggered by a user tap (this button IS the tap)
 *   - facingMode: environment = rear camera
 */

import { registry } from "@web/core/registry";
import { useRef, Component, useState, onWillUnmount, onMounted } from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { CharField } from "@web/views/fields/char/char_field";

// ── Load Html5Qrcode from CDN if not already present ──────────────────────────
function loadHtml5QrcodeLibrary() {
    return new Promise((resolve, reject) => {
        if (window.Html5Qrcode) return resolve();
        const script = document.createElement("script");
        script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("Failed to load Html5Qrcode library"));
        document.head.appendChild(script);
    });
}

// ── Scanner Modal Component ───────────────────────────────────────────────────
export class BarcodeScannerModal extends Component {
    static template = "pwa_pos_ios.BarcodeScannerModal";

    setup() {
        this.state = useState({
            loading: true,
            error: "",
            scanning: false,
        });
        this.html5QrCode = null;
        this.scanRegionId = "backend-barcode-scan-region-" + Math.random().toString(36).slice(2);

        onMounted(async () => {
            await this._initScanner();
        });

        onWillUnmount(() => {
            this._stopScanner();
        });
    }

    async _initScanner() {
        try {
            await loadHtml5QrcodeLibrary();
            this.state.loading = false;
            this.state.scanning = true;

            // Small delay to ensure DOM is ready
            await new Promise(r => setTimeout(r, 100));

            this.html5QrCode = new window.Html5Qrcode(this.scanRegionId);

            await this.html5QrCode.start(
                { facingMode: "environment" },
                {
                    fps: 15,
                    qrbox: { width: 280, height: 160 },
                    aspectRatio: 1.7,
                    formatsToSupport: [
                        window.Html5QrcodeSupportedFormats.EAN_13,
                        window.Html5QrcodeSupportedFormats.EAN_8,
                        window.Html5QrcodeSupportedFormats.UPC_A,
                        window.Html5QrcodeSupportedFormats.UPC_E,
                        window.Html5QrcodeSupportedFormats.CODE_128,
                        window.Html5QrcodeSupportedFormats.CODE_39,
                        window.Html5QrcodeSupportedFormats.CODE_93,
                        window.Html5QrcodeSupportedFormats.ITF,
                        window.Html5QrcodeSupportedFormats.QR_CODE,
                        window.Html5QrcodeSupportedFormats.DATA_MATRIX,
                    ],
                    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
                },
                this._onScanSuccess.bind(this),
                () => {} // ignore per-frame errors
            );
        } catch (err) {
            this.state.loading = false;
            this.state.scanning = false;
            const msg = err.message || String(err);
            if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
                this.state.error =
                    "Camera permission denied.\n" +
                    "iPhone: Settings → Safari → Camera → Allow\n" +
                    "Android: tap the lock icon in the address bar → Camera → Allow";
            } else if (msg.includes("NotFoundError")) {
                this.state.error = "No camera found on this device.";
            } else {
                this.state.error = "Camera error: " + msg;
            }
        }
    }

    _onScanSuccess(decodedText) {
        if (navigator.vibrate) navigator.vibrate(60);
        this._stopScanner();
        // Pass the result back to the parent via callback
        this.props.onScan(decodedText);
    }

    async _stopScanner() {
        if (this.html5QrCode) {
            try {
                if (this.html5QrCode.isScanning) {
                    await this.html5QrCode.stop();
                }
                this.html5QrCode.clear();
            } catch (e) {
                // ignore cleanup errors
            }
            this.html5QrCode = null;
        }
    }

    onClose() {
        this._stopScanner();
        this.props.onClose();
    }
}

BarcodeScannerModal.template = /* xml */ `
<div class="o-barcode-scanner-overlay" t-on-click.self="onClose">
    <div class="o-barcode-scanner-modal">

        <!-- Header -->
        <div class="o-barcode-scanner-header">
            <span class="o-barcode-scanner-title">Scan Barcode</span>
            <button class="o-barcode-scanner-close" t-on-click="onClose"
                    aria-label="Close scanner">✕</button>
        </div>

        <!-- Loading state -->
        <div t-if="state.loading" class="o-barcode-scanner-status">
            <div class="o-barcode-scanner-spinner"></div>
            <p>Starting camera...</p>
        </div>

        <!-- Error state -->
        <div t-if="state.error" class="o-barcode-scanner-error">
            <p style="font-size:2rem;margin-bottom:12px;">📷</p>
            <p t-esc="state.error" style="white-space:pre-line;"/>
            <button class="btn btn-secondary mt-3" t-on-click="onClose">Close</button>
        </div>

        <!-- Scanner viewport -->
        <div t-if="!state.loading and !state.error" class="o-barcode-scanner-viewport">
            <div t-att-id="scanRegionId" class="o-barcode-scanner-region"></div>
            <p class="o-barcode-scanner-hint">
                Point camera at barcode — it scans automatically
            </p>
        </div>

    </div>
</div>
`;

// ── Patch CharField to add camera button on barcode fields ────────────────────
patch(CharField.prototype, {
    setup() {
        super.setup();
        this.scannerState = useState({ open: false, justScanned: "" });

        // Only activate on fields named "barcode"
        this._isBarcodeField = this.props.name === "barcode";
    },

    openScanner() {
        this.scannerState.open = true;
    },

    closeScanner() {
        this.scannerState.open = false;
    },

    onScanResult(value) {
        this.scannerState.open = false;
        this.scannerState.justScanned = value;

        // Write the scanned value into the Odoo field
        this.props.record.update({ [this.props.name]: value });

        // Clear the "just scanned" highlight after 2 seconds
        setTimeout(() => {
            this.scannerState.justScanned = "";
        }, 2000);
    },
});

// ── Extended CharField template with camera button ────────────────────────────
// We register a new template that wraps the original CharField output
// and appends a camera button when the field name is "barcode"
registry.category("fields").add("barcode_with_scanner", {
    ...registry.category("fields").get("char"),
    component: class BarcodeCharField extends CharField {
        static template = "pwa_pos_ios.BarcodeCharField";

        setup() {
            super.setup();
            this.scannerState = useState({ open: false, justScanned: "" });
        }

        openScanner() {
            this.scannerState.open = true;
        }

        closeScanner() {
            this.scannerState.open = false;
        }

        onScanResult(value) {
            this.scannerState.open = false;
            this.scannerState.justScanned = value;
            this.props.record.update({ [this.props.name]: value });
            setTimeout(() => { this.scannerState.justScanned = ""; }, 2000);
        }
    },
});

// Register the BarcodeScannerModal as a global component
registry.category("main_components").add("BarcodeScannerModal", {
    Component: BarcodeScannerModal,
});
