import json
from odoo import http
from odoo.http import request, Response


class PWAController(http.Controller):

    @http.route('/pwa/manifest.json', type='http', auth='public')
    def manifest(self):
        manifest = {
            "name": "POS",
            "short_name": "POS",
            "start_url": "/odoo/point-of-sale",
            "display": "standalone",
            "background_color": "#ffffff",
            "theme_color": "#714B67",
            "orientation": "portrait",
            "icons": [
                {
                    "src": "/pwa_pos_ios/static/src/img/icon-192.png",
                    "sizes": "192x192",
                    "type": "image/png",
                    "purpose": "any maskable"
                },
                {
                    "src": "/pwa_pos_ios/static/src/img/icon-512.png",
                    "sizes": "512x512",
                    "type": "image/png",
                    "purpose": "any maskable"
                }
            ]
        }
        return Response(
            json.dumps(manifest),
            content_type='application/manifest+json',
            headers={'Cache-Control': 'no-cache'}
        )

    @http.route('/pwa/sw.js', type='http', auth='public')
    def service_worker(self):
        sw = """
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
"""
        return Response(
            sw,
            content_type='application/javascript',
            headers={'Cache-Control': 'no-cache'}
        )
