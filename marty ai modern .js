// Marty Task Commander - Enhanced Service Worker for PWA

const CACHE_NAME = 'marty-task-commander-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/css/style.css',
  '/css/calendar-view.css',
  '/css/task-manager.css',
  '/js/app.js',
  '/js/db.js',
  '/js/firebaseConfig.js',
  '/js/ical.js',
  '/js/reservations.js',
  '/js/calendar-view.js',
  '/js/reservation-detail.js',
  '/js/task-manager.js',
  '/js/telegram.js',
  '/js/telegram-integration.js',
  '/js/telegram-ui.js',
  '/js/ai.js',
  '/js/ui.js',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png',
  '/images/icon-512x512.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-brands-400.woff2'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker...');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell and content...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch((error) => {
        console.error('[Service Worker] Error caching app shell and content:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker...');
  
  // Claim clients to control all open tabs
  self.clients.claim();
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Removing old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.startsWith('https://cdnjs.cloudflare.com')) {
    return;
  }
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Handle API requests differently
  if (event.request.url.includes('/api/')) {
    handleApiRequest(event);
    return;
  }
  
  // For page navigations, use network-first strategy
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }
  
  // For all other requests, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        // Clone the request because it's a one-time use stream
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest)
          .then((response) => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response because it's a one-time use stream
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // If fetch fails and it's an image, return a placeholder
            if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
              return caches.match('/images/placeholder.png');
            }
            
            // For other resources, just fail
            return new Response('Network error', {
              status: 408,
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Handle API requests with network-first strategy and background sync
function handleApiRequest(event) {
  // For API requests, try network first, then cache
  event.respondWith(
    fetch(event.request.clone())
      .then((response) => {
        // Cache successful responses
        const responseToCache = response.clone();
        caches.open(CACHE_NAME + '-api')
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
        
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // If no cache, return error response
            return new Response(JSON.stringify({
              error: 'Network error',
              offline: true
            }), {
              status: 503,
              headers: new Headers({
                'Content-Type': 'application/json'
              })
            });
          });
      })
  );
  
  // If it's a POST/PUT/DELETE request, add to background sync queue
  if (event.request.method !== 'GET' && 'sync' in self.registration) {
    event.waitUntil(
      event.request.clone().text()
        .then((payload) => {
          return saveRequestToIndexedDB({
            url: event.request.url,
            method: event.request.method,
            headers: Array.from(event.request.headers.entries()),
            payload
          });
        })
        .then(() => {
          return self.registration.sync.register('sync-pending-requests');
        })
    );
  }
}

// Save request to IndexedDB for background sync
function saveRequestToIndexedDB(request) {
  return new Promise((resolve, reject) => {
    const dbPromise = indexedDB.open('marty-task-commander-sync', 1);
    
    dbPromise.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-requests')) {
        db.createObjectStore('pending-requests', { autoIncrement: true });
      }
    };
    
    dbPromise.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction('pending-requests', 'readwrite');
      const store = tx.objectStore('pending-requests');
      
      store.add(request);
      
      tx.oncomplete = () => {
        resolve();
      };
      
      tx.onerror = (error) => {
        reject(error);
      };
    };
    
    dbPromise.onerror = (error) => {
      reject(error);
    };
  });
}

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-requests') {
    event.waitUntil(syncPendingRequests());
  }
});

// Process pending requests during background sync
function syncPendingRequests() {
  return new Promise((resolve, reject) => {
    const dbPromise = indexedDB.open('marty-task-commander-sync', 1);
    
    dbPromise.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction('pending-requests', 'readwrite');
      const store = tx.objectStore('pending-requests');
      
      const requestsPromise = new Promise((resolve, reject) => {
        const requests = [];
        const cursorRequest = store.openCursor();
        
        cursorRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            requests.push({
              id: cursor.key,
              data: cursor.value
            });
            cursor.continue();
          } else {
            resolve(requests);
          }
        };
        
        cursorRequest.onerror = (error) => {
          reject(error);
        };
      });
      
      requestsPromise.then((requests) => {
        const syncPromises = requests.map((request) => {
          return fetch(request.data.url, {
            method: request.data.method,
            headers: new Headers(request.data.headers),
            body: request.data.payload
          })
            .then((response) => {
              if (response.ok) {
                // If successful, remove from store
                return store.delete(request.id);
              }
              // If not successful, keep in store for next sync
              return Promise.resolve();
            })
            .catch(() => {
              // If fetch fails, keep in store for next sync
              return Promise.resolve();
            });
        });
        
        return Promise.all(syncPromises);
      })
        .then(() => {
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    };
    
    dbPromise.onerror = (error) => {
      reject(error);
    };
  });
}

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }
  
  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Nová notifikace',
      icon: '/images/icon-192x192.png',
      badge: '/images/icon-192x192.png',
      data: data.data || {},
      actions: data.actions || []
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Marty Task Commander', options)
    );
  } catch (error) {
    console.error('[Service Worker] Error handling push notification:', error);
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data;
  let url = '/';
  
  if (data && data.url) {
    url = data.url;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Periodic sync for data updates (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-reservations') {
    event.waitUntil(syncReservations());
  } else if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

// Sync reservations data
function syncReservations() {
  return fetch('/api/sync-reservations')
    .then((response) => {
      if (!response.ok) {
        throw new Error('Failed to sync reservations');
      }
      return response.json();
    })
    .then((data) => {
      // Notify clients about updated data
      return self.clients.matchAll()
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'reservations-updated',
              count: data.count
            });
          });
        });
    })
    .catch((error) => {
      console.error('[Service Worker] Error syncing reservations:', error);
    });
}

// Sync tasks data
function syncTasks() {
  return fetch('/api/sync-tasks')
    .then((response) => {
      if (!response.ok) {
        throw new Error('Failed to sync tasks');
      }
      return response.json();
    })
    .then((data) => {
      // Notify clients about updated data
      return self.clients.matchAll()
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'tasks-updated',
              count: data.count
            });
          });
        });
    })
    .catch((error) => {
      console.error('[Service Worker] Error syncing tasks:', error);
    });
}

// Log service worker lifecycle events
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage(CACHE_NAME);
  }
});

console.log('[Service Worker] Service Worker registered');
