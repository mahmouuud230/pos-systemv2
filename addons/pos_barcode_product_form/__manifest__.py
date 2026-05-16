# addons/pos_barcode_product_form/__manifest__.py
{
    'name': 'Product Form Barcode Scanner (Camera)',
    'version': '18.0.1.0.0',
    'summary': 'Camera barcode scanner button on the product.template barcode field.',
    'category': 'Point of Sale',
    'author': 'Custom',
    'license': 'LGPL-3',

    'depends': ['product', 'barcodes', 'point_of_sale'],

    'data': [
        'views/product_template_views.xml',
    ],

    'assets': {
        'web.assets_backend': [
            # zxing-browser.umd.min.js is committed to the repo (Apache 2.0 license permits redistribution).
            # Do NOT add it to .gitignore. No manual download step is required after git clone.
            'pos_barcode_product_form/static/src/lib/zxing-browser.umd.min.js',
            'pos_barcode_product_form/static/src/js/barcode_scanner_widget.js',
            'pos_barcode_product_form/static/src/xml/barcode_scanner_widget.xml',
            'pos_barcode_product_form/static/src/css/barcode_scanner_widget.css',
        ],
    },

    'installable': True,
    'application': False,
    'auto_install': False,
}
