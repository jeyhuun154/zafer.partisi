// ==================== KONFİGÜRASYON ====================

const CONFIG = {
    ADMIN_HASH: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    ACCESS_CODES_HASH: [
        '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    ],
    ENCRYPTION_KEY: 'zafer-partisi-secure-key-2024',
    ITEMS_PER_PAGE: 10
};

// ==================== STATE ====================

const state = {
    currentUser: null,
    isAdmin: false,
    biometricEnabled: false,
    members: [],
    currentPage: 1,
    editingId: null,
    db: null,
    map: null,
    mapMarkers: [],
    swRegistration: null,
    isOnline: navigator.onLine
};

// ==================== KRYPTOGRAFİ ====================

const Crypto = {
    async sha256(message) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hash = await window.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async encrypt(text, password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const key = await this.getKey(password);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);
        return btoa(String.fromCharCode(...combined));
    },

    async decrypt(encryptedData, password) {
        try {
            const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
            const iv = data.slice(0, 12);
            const encrypted = data.slice(12);
            const key = await this.getKey(password);
            const decrypted = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            return null;
        }
    },

    async getKey(password) {
        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        return window.crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: encoder.encode('zaferpartisi'), iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }
};

// ==================== BİYOMETRİK KİMLİK DOĞRULAMA ====================

const BiometricAuth = {
    async isSupported() {
        return window.PublicKeyCredential !== undefined;
    },

    async register() {
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            
            const publicKeyCredentialCreationOptions = {
                challenge: challenge,
                rp: {
                    name: "Zafer Partisi",
                    id: window.location.hostname
                },
                user: {
                    id: new Uint8Array(16),
                    name: state.currentUser.fullName,
                    displayName: state.currentUser.fullName
                },
                pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "required"
                },
                timeout: 60000,
                attestation: "direct"
            };

            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions
            });

            const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
            await saveToDB('biometric', { 
                id: 'credential', 
                data: credentialId,
                user: state.currentUser.fullName 
            });
            
            return true;
        } catch (err) {
            console.error('Biyometrik kayıt hatası:', err);
            return false;
        }
    },

    async authenticate() {
        try {
            const stored = await getFromDB('biometric', 'credential');
            if (!stored) return false;

            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            const publicKeyCredentialRequestOptions = {
                challenge: challenge,
                allowCredentials: [{
                    id: Uint8Array.from(atob(stored.data), c => c.charCodeAt(0)),
                    type: 'public-key',
                    transports: ['internal']
                }],
                userVerification: 'required',
                timeout: 60000
            };

            const assertion = await navigator.credentials.get({
                publicKey: publicKeyCredentialRequestOptions
            });

            return !!assertion;
        } catch (err) {
            console.error('Biyometrik doğrulama hatası:', err);
            return false;
        }
    }
};

// ==================== VERİTABANI ====================

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ZaferPartisiDB', 2);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            state.db = request.result;
            resolve();
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('members')) {
                db.createObjectStore('members', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('biometric')) {
                db.createObjectStore('biometric', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('mapTiles')) {
                db.createObjectStore('mapTiles', { keyPath: 'url' });
            }
        };
    });
}

async function saveToDB(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = state.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getFromDB(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = state.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = key ? store.get(key) : store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteFromDB(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = state.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ==================== SERVICE WORKER ====================

const SW_CODE = `
const CACHE_NAME = 'zafer-v2';
const TILE_CACHE_NAME = 'map-tiles-v1';

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(['/', '/index.html']);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME && name !== TILE_CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(
            caches.open(TILE_CACHE_NAME).then(cache => {
                return cache.match(request).then(response => {
                    if (response) return response;
                    return fetch(request).then(fetchResponse => {
                        cache.put(request, fetchResponse.clone());
                        return fetchResponse;
                    }).catch(() => new Response('', { status: 503 }));
                });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(response => {
            if (response) return response;
            return fetch(request).catch(() => {
                if (request.destination === 'video') {
                    return new Response('Video offline', { status: 503 });
                }
            });
        })
    );
});

self.addEventListener('push', event => {
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        badge: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        vibrate: [200, 100, 200],
        data: data.data || {},
        actions: [
            { action: 'open', title: 'Aç' },
            { action: 'close', title: 'Kapat' }
        ],
        requireInteraction: true
    };
    
    event.waitUntil(
        self.registration.showNotification('Zafer Partisi', options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url || '/')
        );
    }
});

self.addEventListener('sync', event => {
    if (event.tag === 'sync-members') {
        event.waitUntil(syncMembers());
    }
});

async function syncMembers() {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_COMPLETE' });
    });
}
`;

async function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    try {
        const blob = new Blob([SW_CODE], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(blob);
        
        const registration = await navigator.serviceWorker.register(swUrl);
        state.swRegistration = registration;

        if ('PushManager' in window) {
            const permission = await Notification.requestPermission();
            console.log('Notification permission:', permission);
        }

    } catch (err) {
        console.error('SW kayıt hatası:', err);
    }
}

// ==================== BİLDİRİMLER ====================

async function sendNotification(title, body, data = {}) {
    if (state.swRegistration && Notification.permission === 'granted') {
        state.swRegistration.showNotification(title, {
            body: body,
            icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            badge: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            vibrate: [200, 100, 200],
            data: data
        });
    }
    showNotification('', body);
}

function showNotification(icon, text) {
    const notif = document.getElementById('notification');
    document.getElementById('notif-icon').textContent = icon || '📡';
    document.getElementById('notif-text').textContent = text;
    notif.classList.add('show');
    
    setTimeout(() => {
        notif.classList.remove('show');
    }, 4000);
}

// ==================== AĞ DURUMU ====================

function initNetworkStatus() {
    window.addEventListener('online', async () => {
        state.isOnline = true;
        document.getElementById('offline-indicator').classList.remove('show');
        showNotification('', 'İnternet bağlantısı sağlandı');
        
        if (state.swRegistration && 'sync' in state.swRegistration) {
            await state.swRegistration.sync.register('sync-members');
        }
        
        checkForUpdates();
    });

    window.addEventListener('offline', () => {
        state.isOnline = false;
        document.getElementById('offline-indicator').classList.add('show');
        showNotification('', 'Yeni güncellemeler için internetinizi açık tutun');
    });

    if (!navigator.onLine) {
        document.getElementById('offline-indicator').classList.add('show');
    }
}

async function checkForUpdates() {
    if (Math.random() > 0.5) {
        document.getElementById('update-badge').classList.add('show');
        sendNotification('Yeni Güncelleme', 'Parti üye listesi güncellendi');
    }
}

// ==================== GİRİŞ İŞLEMLERİ ====================

async function handleLogin() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const code = document.getElementById('accessCode').value.trim();

    if (!firstName || !lastName || !code) {
        alert('Lütfen tüm alanları doldurun');
        return;
    }

    document.getElementById('loading').classList.add('show');

    try {
        const codeHash = await Crypto.sha256(code);
        const isValidCode = CONFIG.ACCESS_CODES_HASH.includes(codeHash);

        if (!isValidCode) {
            alert('Geçersiz erişim kodu');
            document.getElementById('loading').classList.remove('show');
            return;
        }

        const fullName = firstName + ' ' + lastName;
        const isAdmin = fullName === 'Ceyhun Karaarslan' && codeHash === CONFIG.ADMIN_HASH;

        if (state.biometricEnabled || isAdmin) {
            const bioAuth = await BiometricAuth.authenticate();
            if (!bioAuth && isAdmin) {
                alert('Admin girişi için biyometrik doğrulama zorunludur');
                document.getElementById('loading').classList.remove('show');
                return;
            }
        }

        state.currentUser = { firstName, lastName, fullName };
        state.isAdmin = isAdmin;

        const sessionData = await Crypto.encrypt(JSON.stringify({
            user: state.currentUser,
            isAdmin: isAdmin,
            timestamp: Date.now()
        }), code);
        
        localStorage.setItem('session', sessionData);

        if (isAdmin && await BiometricAuth.isSupported()) {
            const hasBio = await getFromDB('biometric', 'credential');
            if (!hasBio) {
                await BiometricAuth.register();
            }
        }

        document.getElementById('loading').classList.remove('show');
        showScreen('main-screen');
        
        if (isAdmin) {
            document.getElementById('adminAddBtn').classList.add('visible');
        }

    } catch (err) {
        console.error('Giriş hatası:', err);
        alert('Giriş yapılırken bir hata oluştu');
        document.getElementById('loading').classList.remove('show');
    }
}

async function toggleBiometric() {
    const btn = document.getElementById('bioBtn');
    if (state.biometricEnabled) {
        state.biometricEnabled = false;
        btn.classList.remove('active');
        btn.innerHTML = '<span>👆</span><span>Biyometrik Doğrulama ile Giriş</span>';
    } else {
        if (await BiometricAuth.isSupported()) {
            state.biometricEnabled = true;
            btn.classList.add('active');
            btn.innerHTML = '<span>✓</span><span>Biyometrik Aktif</span>';
            showNotification('', 'Biyometrik doğrulama etkinleştirildi');
        } else {
            alert('Cihazınız biyometrik doğrulamayı desteklemiyor');
        }
    }
}

// ==================== EKRAN YÖNETİMİ ====================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    if (screenId === 'list-screen') {
        loadMembers();
    } else if (screenId === 'map-screen') {
        setTimeout(initMap, 100);
    }
}

function toggleSettings() {
    document.getElementById('themeSelector').classList.toggle('show');
}

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme === 'default' ? '' : theme);
    localStorage.setItem('theme', theme);
    
    document.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    setTimeout(() => {
        document.getElementById('themeSelector').classList.remove('show');
    }, 200);
}

function openList() {
    showScreen('list-screen');
}

function openMap() {
    showScreen('map-screen');
}

// ==================== ÜYE YÖNETİMİ ====================

async function loadMembers() {
    const members = await getFromDB('members') || [];
    state.members = members;
    renderMembers();
}

function renderMembers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filtered = state.members.filter(m => 
        m.name.toLowerCase().includes(searchTerm) || 
        m.description.toLowerCase().includes(searchTerm)
    );
    
    const start = (state.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const end = start + CONFIG.ITEMS_PER_PAGE;
    const pageItems = filtered.slice(start, end);
    
    const container = document.getElementById('memberList');
    container.innerHTML = '';
    
    pageItems.forEach(member => {
        const card = createMemberCard(member);
        container.appendChild(card);
    });
    
    updatePagination(filtered.length);
}

function createMemberCard(member) {
    const div = document.createElement('div');
    div.className = 'member-card';
    
    const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50%" y="50%" font-size="40" text-anchor="middle" dy=".3em">👤</text></svg>';
    
    let socialHtml = '';
    if (member.socialX) socialHtml += '<div class="social-icon" onclick="openLink(\'' + member.socialX + '\')">𝕏</div>';
    if (member.socialIG) socialHtml += '<div class="social-icon" onclick="openLink(\'' + member.socialIG + '\')">📷</div>';
    if (member.socialLinkedIn) socialHtml += '<div class="social-icon" onclick="openLink(\'' + member.socialLinkedIn + '\')">💼</div>';
    if (member.socialWeb) socialHtml += '<div class="social-icon" onclick="openLink(\'' + member.socialWeb + '\')">🌐</div>';
    
    div.innerHTML = 
        '<div class="member-avatar">' +
            '<img src="' + (member.photo || defaultAvatar) + '" onerror="this.src=\'' + defaultAvatar + '\'">' +
        '</div>' +
        '<div class="member-info">' +
            '<div class="member-name">' + escapeHtml(member.name) + '</div>' +
            '<div class="member-desc">' + escapeHtml(member.description) + '</div>' +
            '<div class="social-links">' + socialHtml + '</div>' +
        '</div>' +
        (state.isAdmin ? '<button class="edit-btn" onclick="editMember(' + member.id + ')">✏️</button>' : '');
    
    return div;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function openLink(url) {
    window.open(url, '_blank');
}

function updatePagination(total) {
    const totalPages = Math.ceil(total / CONFIG.ITEMS_PER_PAGE) || 1;
    document.getElementById('pageInfo').textContent = state.currentPage + ' / ' + totalPages;
    document.getElementById('prevBtn').disabled = state.currentPage === 1;
    document.getElementById('nextBtn').disabled = state.currentPage >= totalPages;
}

function changePage(delta) {
    state.currentPage += delta;
    renderMembers();
}

function filterMembers() {
    state.currentPage = 1;
    renderMembers();
}

// ==================== HARİTA ====================

function initMap() {
    if (state.map) {
        state.map.invalidateSize();
        plotMembersOnMap();
        return;
    }

    state.map = L.map('map').setView([39.9334, 32.8597], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
        crossOrigin: true
    }).addTo(state.map);

    plotMembersOnMap();
}

function plotMembersOnMap() {
    state.mapMarkers.forEach(marker => state.map.removeLayer(marker));
    state.mapMarkers = [];

    state.members.forEach(member => {
        if (member.lat && member.lng) {
            const marker = L.marker([member.lat, member.lng])
                .addTo(state.map)
                .bindPopup(
                    '<b>' + member.name + '</b><br>' + 
                    member.description + '<br>' +
                    '<button onclick="window.openLink(\'' + (member.socialWeb || '#') + '\')" style="margin-top:5px;padding:5px 10px;border:none;background:#003366;color:white;border-radius:5px;cursor:pointer;">Profil</button>'
                );
            state.mapMarkers.push(marker);
        }
    });
}

function refreshMap() {
    if (state.map) {
        state.map.invalidateSize();
        plotMembersOnMap();
    }
}

async function getCurrentLocation() {
    try {
        const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        });
        
        document.getElementById('memberLat').value = pos.coords.latitude.toFixed(6);
        document.getElementById('memberLng').value = pos.coords.longitude.toFixed(6);
        
        showNotification('', 'Konum alındı');
    } catch (err) {
        alert('Konum alınamadı: ' + err.message);
    }
}

// ==================== MODAL ====================

function openAdminModal() {
    state.editingId = null;
    document.getElementById('modalTitle').textContent = 'Yeni Üye Ekle';
    document.getElementById('deleteBtn').style.display = 'none';
    clearForm();
    document.getElementById('adminModal').classList.add('show');
}

function closeModal() {
    document.getElementById('adminModal').classList.remove('show');
}

function clearForm() {
    document.getElementById('memberPhoto').value = '';
    document.getElementById('memberName').value = '';
    document.getElementById('memberDesc').value = '';
    document.getElementById('memberLat').value = '';
    document.getElementById('memberLng').value = '';
    document.getElementById('socialX').value = '';
    document.getElementById('socialIG').value = '';
    document.getElementById('socialLinkedIn').value = '';
    document.getElementById('socialWeb').value = '';
}

async function editMember(id) {
    const member = state.members.find(m => m.id === id);
    if (!member) return;

    state.editingId = id;
    document.getElementById('modalTitle').textContent = 'Üye Düzenle';
    document.getElementById('deleteBtn').style.display = 'block';

    document.getElementById('memberPhoto').value = member.photo || '';
    document.getElementById('memberName').value = member.name;
    document.getElementById('memberDesc').value = member.description;
    document.getElementById('memberLat').value = member.lat || '';
    document.getElementById('memberLng').value = member.lng || '';
    document.getElementById('socialX').value = member.socialX || '';
    document.getElementById('socialIG').value = member.socialIG || '';
    document.getElementById('socialLinkedIn').value = member.socialLinkedIn || '';
    document.getElementById('socialWeb').value = member.socialWeb || '';

    document.getElementById('adminModal').classList.add('show');
}

async function saveMember() {
    const photo = document.getElementById('memberPhoto').value.trim();
    const name = document.getElementById('memberName').value.trim();
    const description = document.getElementById('memberDesc').value.trim();

    if (!name) {
        alert('Ad Soyad zorunludur');
        return;
    }

    const memberData = {
        photo: photo || null,
        name: name,
        description: description,
        lat: parseFloat(document.getElementById('memberLat').value) || null,
        lng: parseFloat(document.getElementById('memberLng').value) || null,
        socialX: document.getElementById('socialX').value.trim(),
        socialIG: document.getElementById('socialIG').value.trim(),
        socialLinkedIn: document.getElementById('socialLinkedIn').value.trim(),
        socialWeb: document.getElementById('socialWeb').value.trim(),
        updatedAt: Date.now()
    };

    if (state.editingId) {
        memberData.id = state.editingId;
    }

    await saveToDB('members', memberData);
    
    if (!state.editingId) {
        await sendNotification('', 'Yeni üye: ' + name);
    }

    await loadMembers();
    closeModal();
}

async function deleteMember() {
    if (!state.editingId) return;
    if (!confirm('Bu üyeyi silmek istediğinize emin misiniz?')) return;

    await deleteFromDB('members', state.editingId);
    await loadMembers();
    closeModal();
    showNotification('', 'Üye silindi');
}

// ==================== GÜVENLİK ====================

(function initSecurity() {
    const threshold = 160;
    setInterval(() => {
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        
        if (widthThreshold || heightThreshold) {
            document.getElementById('devtools-block').style.display = 'flex';
            document.body.style.overflow = 'hidden';
        } else {
            document.getElementById('devtools-block').style.display = 'none';
            document.body.style.overflow = '';
        }
    }, 500);

    setInterval(() => {
        const start = new Date();
        debugger;
        const end = new Date();
        if (end - start > 100) {
            window.location.href = 'about:blank';
        }
    }, 100);
})();

// ==================== BAŞLATMA ====================

async function initApp() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && savedTheme !== 'default') {
        document.body.setAttribute('data-theme', savedTheme);
    }

    await initDB();
    await initServiceWorker();
    initNetworkStatus();

    const video = document.getElementById('splash-video');
    video.onended = async () => {
        setTimeout(() => {
            showScreen('login-screen');
        }, 500);
    };

    video.onerror = () => {
        setTimeout(() => showScreen('login-screen'), 2000);
    };
}

initApp();

window.addEventListener('popstate', (e) => {
    if (document.getElementById('list-screen').classList.contains('active')) {
        showScreen('main-screen');
        e.preventDefault();
    } else if (document.getElementById('map-screen').classList.contains('active')) {
        showScreen('main-screen');
        e.preventDefault();
    }
});
