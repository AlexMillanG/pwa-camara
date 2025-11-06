// ===================================
// REGISTRO DEL SERVICE WORKER
// ===================================

// Registrar el service worker cuando la pagina carga
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker registrado correctamente:', registration.scope);
            })
            .catch(error => {
                console.error('Error al registrar el Service Worker:', error);
            });
    });
}

// ===================================
// REFERENCIAS A ELEMENTOS DEL DOM
// ===================================

const openCameraBtn = document.getElementById('openCameraBtn');
const captureBtn = document.getElementById('captureBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const videoContainer = document.getElementById('videoContainer');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photosScroll = document.getElementById('photosScroll');

// ===================================
// VARIABLES DE ESTADO
// ===================================

let stream = null; // Almacena el stream de la camara activa
let currentFacingMode = 'environment'; // Modo actual: 'environment' (trasera) o 'user' (frontal)
let hasFrontCamera = false; // Indica si el dispositivo tiene camara frontal
let capturedPhotos = []; // Array para almacenar las fotos capturadas

// ===================================
// DETECCIoN DE CaMARAS DISPONIBLES
// ===================================

/**
 * Verifica si el dispositivo tiene camara frontal
 * Esta funcion enumera todos los dispositivos de entrada de video
 * y determina si hay una camara frontal disponible
 */
async function checkForFrontCamera() {
    try {
        // Obtener lista de dispositivos multimedia
        const devices = await navigator.mediaDevices.enumerateDevices();

        // Filtrar solo dispositivos de video
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        console.log('C�maras disponibles:', videoDevices.length);

        // Si hay mas de una camara, asumimos que hay frontal y trasera
        // Tambien verificamos si alguna tiene 'front' o 'user' en la etiqueta
        hasFrontCamera = videoDevices.length > 1 ||
                         videoDevices.some(device =>
                             device.label.toLowerCase().includes('front') ||
                             device.label.toLowerCase().includes('user')
                         );

        console.log('Tiene camara frontal?', hasFrontCamera);

        return hasFrontCamera;
    } catch (error) {
        console.error('Error al enumerar dispositivos:', error);
        return false;
    }
}

// ===================================
// FUNCIONES DE CONTROL DE CaMARA
// ===================================

/**
 * Detiene el stream anterior si existe
 */
async function openCamera() {
    try {
        // Si ya hay un stream activo, cerrarlo primero
        if (stream) {
            closeCamera();
        }

        const constraints = {
            video: {
                facingMode: currentFacingMode, // 'environment' para trasera, 'user' para frontal
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false // No necesitamos audio
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Asignar el stream al elemento video
        video.srcObject = stream;

        // Mostrar el contenedor del video
        videoContainer.classList.add('active');

        captureBtn.classList.add('visible');

        openCameraBtn.textContent = 'Cerrar Cámara';

        const hasFront = await checkForFrontCamera();
        if (hasFront) {
            switchCameraBtn.classList.add('visible');
        }

        console.log('Cámara abierta exitosamente con modo:', currentFacingMode);
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);

        // Mensajes de error mas descriptivos
        if (error.name === 'NotAllowedError') {
            alert('Permiso denegado. Por favor, permite el acceso a la camara en la configuracian de tu navegador.');
        } else if (error.name === 'NotFoundError') {
            alert('No se encontró ninguna camara en este dispositivo.');
        } else if (error.name === 'NotReadableError') {
            alert('La camara esta siendo utilizada por otra aplicacion.');
        } else {
            alert('Error al acceder a la camara: ' + error.message);
        }
    }
}

/**
 * Es importante detener el stream correctamente para liberar la camara
 */
function closeCamera() {
    if (stream) {
        // Detener todos los tracks (video y audio si los hubiera)
        stream.getTracks().forEach(track => {
            track.stop();
            console.log('Track detenido:', track.kind);
        });

        // Limpiar el srcObject del video
        video.srcObject = null;
        stream = null;

        // Ocultar elementos de UI
        videoContainer.classList.remove('active');
        captureBtn.classList.remove('visible');
        switchCameraBtn.classList.remove('visible');

        openCameraBtn.textContent = 'Abrir C�mara';

        console.log('C�mara cerrada correctamente');
    }
}

/**
 * Reinicia el stream con el nuevo modo
 */
async function switchCamera() {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';

    console.log('Cambiando a modo:', currentFacingMode);

    await openCamera();
}

// ===================================
// ===================================

/**
 * Captura una foto del stream de video actual
 * Utiliza un canvas para procesar la imagen
 */
function capturePhoto() {
    if (!stream) {
        alert('La c�mara no est� abierta');
        return;
    }

    // Configurar el canvas con las dimensiones del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Obtener contexto 2D del canvas
    const context = canvas.getContext('2d');

    // Dibujar el frame actual del video en el canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convertir el canvas a una URL de imagen (base64)
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    // Agregar la foto al array
    capturedPhotos.push({
        id: Date.now(), // ID basado en timestamp
        dataUrl: photoDataUrl,
        timestamp: new Date().toLocaleString()
    });

    displayPhotos();

    console.log('Foto capturada. Total de fotos:', capturedPhotos.length);
}

/**
 * Muestra todas las fotos capturadas en el scroll horizontal
 */
function displayPhotos() {
    // Limpiar el contenedor
    photosScroll.innerHTML = '';

    // Si no hay fotos, mostrar mensaje
    if (capturedPhotos.length === 0) {
        photosScroll.innerHTML = '<div class="no-photos">No hay fotos a�n. Toma una foto para comenzar.</div>';
        return;
    }

    // Crear elementos para cada foto
    capturedPhotos.forEach((photo, index) => {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';

        const img = document.createElement('img');
        img.src = photo.dataUrl;
        img.alt = `Foto ${index + 1}`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'X';
        deleteBtn.onclick = () => deletePhoto(photo.id);

        photoItem.appendChild(img);
        photoItem.appendChild(deleteBtn);
        photosScroll.appendChild(photoItem);
    });

    photosScroll.scrollLeft = photosScroll.scrollWidth;
}

/**
 * @param {number} photoId - ID de la foto a eliminar
 */
function deletePhoto(photoId) {
    capturedPhotos = capturedPhotos.filter(photo => photo.id !== photoId);
    displayPhotos();
    console.log('Foto eliminada. Total de fotos:', capturedPhotos.length);
}

// ===================================
// EVENT LISTENERS
// ===================================

// Bot�n de abrir/cerrar c�mara
openCameraBtn.addEventListener('click', () => {
    if (stream) {
        closeCamera();
    } else {
        openCamera();
    }
});

captureBtn.addEventListener('click', capturePhoto);

switchCameraBtn.addEventListener('click', switchCamera);

window.addEventListener('beforeunload', () => {
    if (stream) {
        closeCamera();
    }
});


console.log('App de camara PWA iniciada');
console.log('Service Worker disponible:', 'serviceWorker' in navigator);
console.log('getUserMedia disponible:', 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices);
