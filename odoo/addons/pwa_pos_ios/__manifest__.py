{
    'name': 'PWA POS iOS',
    'version': '18.0.2.0.0',
    'category': 'Point of Sale',
    'summary': 'PWA meta tags, iOS standalone mode, backend barcode scanner, and POS QR scanner',
    'author': 'Odoo SaaS',
    'license': 'LGPL-3',
    'depends': ['point_of_sale', 'web', 'product'],
    'data': [
        'views/web_layout_inherit.xml',
        'views/product_barcode_scanner.xml',
    ],
    'assets': {

        # ── Loaded on every backend page ──────────────────────────────────────
        'web.assets_backend': [
            # Html5Qrcode library (loaded from CDN via script tag)
            # Must load BEFORE our widget JS
            ('prepend', 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'),
            'pwa_pos_ios/static/src/js/backend_barcode_scanner.js',
            'pwa_pos_ios/static/src/xml/barcode_scanner.xml',
            'pwa_pos_ios/static/src/css/backend_barcode_scanner.css',
        ],

        # ── Loaded on every page (frontend + backend) ─────────────────────────
        'web.assets_common': [
            'pwa_pos_ios/static/src/js/pwa_service_worker_register.js',
            'pwa_pos_ios/static/src/css/scanner.css',
        ],

        # ── Loaded only inside the POS session ───────────────────────────────
        'point_of_sale.assets': [
            'pwa_pos_ios/static/src/js/qr_scanner_widget.js',
        ],

    },
    'installable': True,
    'auto_install': False,
    'application': False,
}
