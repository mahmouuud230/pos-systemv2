/** @odoo-module **/
// addons/pos_barcode_product_form/static/src/js/barcode_scanner_widget.js

import { registry } from "@web/core/registry";
import { CharField } from "@web/views/fields/char/char_field";
import { useRef, useState, onWillUnmount } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

function getZXing() {
    return window.ZXingBrowser;
}

export class BarcodeScannerWidget extends CharField {
    static template = "pos_barcode_product_form.BarcodeScannerWidget";

    setup() {
        super.setup();

        if (!window.ZXingBrowser) {
            console.error(
                '[pos_barcode_product_form] ZXing library not found. ' +
                'Ensure zxing-browser.umd.min.js is committed to the repo and restart Odoo.'
            );
        }

        this.videoRef     = useRef("scannerVideo");
        this.fileInputRef = useRef("fileInput");

        this.scanState = useState({
            active: false,
            error:  null,
        });

        this._stream = null;
        this._reader = null;

        onWillUnmount(() => this._cleanup());
    }

    onInputChange(ev) {
        this.props.record.update({ [this.props.name]: ev.target.value });
    }

    async onClickScan() {
        this.scanState.error = null;

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            await this._startLiveScanner();
        } else {
            this.fileInputRef.el && this.fileInputRef.el.click();
        }
    }

    onClickClose() {
        this._cleanup();
        this.scanState.active = false;
    }

    async onFileCapture(ev) {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;

        const ZXing = getZXing();
        if (!ZXing) {
            this.scanState.error = _t("Barcode library not loaded. Please reload the page.");
            return;
        }

        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;
        await new Promise((resolve) => { img.onload = resolve; });
        URL.revokeObjectURL(url);

        try {
            const reader = new ZXing.BrowserMultiFormatReader();
            const result = await reader.decodeFromImageElement(img);
            this._applyValue(result.getText());
        } catch (_e) {
            this.scanState.error = _t(
                "No barcode found in the photo. Try again with better lighting, or type the code manually."
            );
        } finally {
            ev.target.value = "";
        }
    }

    async _startLiveScanner() {
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: "environment" } },
                audio: false,
            });
        } catch (err) {
            if (err.name === "NotAllowedError") {
                this.scanState.error = _t(
                    "Camera access denied. Allow camera permission in your browser settings and try again."
                );
            } else {
                this.fileInputRef.el && this.fileInputRef.el.click();
            }
            return;
        }

        this._stream = stream;
        this.scanState.active = true;

        await new Promise((r) => setTimeout(r, 50));

        const video = this.videoRef.el;
        if (!video) {
            this._cleanup();
            return;
        }

        const ZXing = getZXing();
        if (!ZXing) {
            this.scanState.error = _t("Barcode library not loaded. Please reload the page.");
            this._cleanup();
            this.scanState.active = false;
            return;
        }

        this._reader = new ZXing.BrowserMultiFormatReader();

        video.srcObject = stream;
        try {
            await video.play();
        } catch (playErr) {
            this.scanState.error = _t("Camera error: could not start video playback.");
            this._cleanup();
            this.scanState.active = false;
            return;
        }

        try {
            await this._reader.decodeFromVideoElement(video, (result, err) => {
                if (result) {
                    this._applyValue(result.getText());
                    this._cleanup();
                    this.scanState.active = false;
                }
            });
        } catch (startErr) {
            this.scanState.error = _t("Camera error. Please try again.");
            this._cleanup();
            this.scanState.active = false;
        }
    }

    _cleanup() {
        if (this._reader) {
            try { this._reader.reset(); } catch (_e) {}
            this._reader = null;
        }
        if (this._stream) {
            this._stream.getTracks().forEach((t) => t.stop());
            this._stream = null;
        }
    }

    _applyValue(value) {
        this.props.record.update({ [this.props.name]: value });
    }
}

registry.category("fields").add("barcode_scanner", BarcodeScannerWidget, { force: true });
