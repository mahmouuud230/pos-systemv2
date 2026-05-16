# ZXing Browser UMD — Vendor File

This file (`zxing-browser.umd.min.js`) is committed directly to this repository.
No download step is required after `git clone`.

## Details
- Package: @zxing/browser@0.1.6
- License: Apache 2.0 (redistribution permitted — this is why it is committed)
- File size: ~180 KB
- Source: https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.6/umd/index.min.js

## If you need to re-download it (e.g. to upgrade the version)
    curl -L "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.6/umd/index.min.js" \
      -o /opt/odoo-saas/addons/pos_barcode_product_form/static/src/lib/zxing-browser.umd.min.js
    git add addons/pos_barcode_product_form/static/src/lib/zxing-browser.umd.min.js
    git commit -m "vendor: upgrade ZXing browser UMD to x.x.x"
