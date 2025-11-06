// ===================================
// SERVICE WORKER - PWA CaMARA
// Estrategia: Cache First
// ===================================

// Nombre de la cache y version
// Cambiar la version forzar la actualizacion de todos los recursos
const CACHE_NAME = 'pwa-camera-v1';

// Recursos que se cachearon durante la instalacion
// Estos son los archivos esenciales para que la PWA funcione sin conexion
const CACHE_RESOURCES = [
    './',              
    './index.html',    
    './app.js',        
    './manifest.json'  
];

// ===================================
// EVENTO: INSTALL
// ===================================

/**
 * Se ejecuta cuando el service worker se instala por primera vez
 * Aqui pre-cacheamos todos los recursos esenciales
 */
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');

    // waitUntil asegura que el SW no se instale hasta que se complete el cacheo
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cacheando recursos esenciales');
                // addAll cachea todos los recursos de una vez
                return cache.addAll(CACHE_RESOURCES);
            })
            .then(() => {
                console.log('[Service Worker] Todos los recursos cacheados correctamente');
                // skipWaiting hace que el nuevo SW se active inmediatamente
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Error al cachear recursos:', error);
            })
    );
});

// ===================================
// EVENTO: ACTIVATE
// ===================================

/**
 * Se ejecuta cuando el service worker se activa
 * Aqui limpiamos caches antiguas
 */
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activando...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                // Eliminar caches antiguas que no coincidan con CACHE_NAME
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Eliminando cache antigua:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activado correctamente');
                // Toma control de todas las paginas inmediatamente
                return self.clients.claim();
            })
    );
});

// ===================================
// EVENTO: FETCH
// ===================================

/**
 * Intercepta todas las peticiones de red
 * Estrategia Cache First:
 * 1. Intenta servir desde cache
 * 2. Si no esta en cache, hace peticion de red
 * 3. Guarda la respuesta de red en cache para futuras peticiones
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Solo interceptamos peticiones GET
    if (request.method !== 'GET') {
        return;
    }

    // Ignorar peticiones a otros dominios y recursos especificos
    if (!request.url.startsWith(self.location.origin)) {
        return;
    }

    console.log('[Service Worker] Fetch:', request.url);

    event.respondWith(
        // Estrategia Cache First
        caches.match(request)
            .then((cachedResponse) => {
                // Si encontramos el recurso en cache, lo devolvemos inmediatamente
                if (cachedResponse) {
                    console.log('[Service Worker] Sirviendo desde cache:', request.url);
                    return cachedResponse;
                }

                // Si no esta en cache, hacemos la peticion de red
                console.log('[Service Worker] No en cache, obteniendo de red:', request.url);

                return fetch(request)
                    .then((networkResponse) => {
                        // Verificar que la respuesta es velida antes de cachearla
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
                            return networkResponse;
                        }

                        // Clonar la respuesta porque solo se puede leer una vez
                        const responseToCache = networkResponse.clone();

                        // Guardar en cache para futuras peticiones
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                console.log('[Service Worker] Guardando en cache:', request.url);
                                cache.put(request, responseToCache);
                            });

                        return networkResponse;
                    })
                    .catch((error) => {
                        // Si falla la peticion de red y no esta en cache
                        console.error('[Service Worker] Error en fetch:', error);

                        // Aqui podraas devolver una pagina de error personalizada
                        // Por ejemplo: return caches.match('./offline.html');
                        throw error;
                    });
            })
    );
});

// ===================================
// EVENTO: MESSAGE
// ===================================

/**
 * Permite comunicacion entre la app y el service worker
 * util para actualizar la cache manualmente o forzar actualizacion
 */
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Mensaje recibido:', event.data);

    // Ejemplo: forzar actualizacion del SW
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }

    // Ejemplo: limpiar todas las caches
    if (event.data.action === 'clearCache') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
});

console.log('[Service Worker] Script cargado');
