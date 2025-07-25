const video = document.getElementById("video");
    const registros = [];
    let canvas;
    let isDetectionActive = true;
    let detectionInterval;
    let faceMatcher = null;
    let lastDetectionTime = 0;
    let frameCount = 0;
    let startTime = Date.now();
    
    // Configuración optimizada
    const DETECTION_INTERVAL = 200; // ms entre detecciones
    const DETECTION_OPTIONS = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224, // Reducido para mayor velocidad
      scoreThreshold: 0.5 // Aumentado para mejor precisión
    });
    
    document.getElementById("registrar").addEventListener("click", registrarRostro);
    document.getElementById("toggle-detection").addEventListener("click", toggleDetection);
    
    async function cargarModelos() {
      try {
        // Cargar solo los modelos necesarios de forma paralela
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('models')
        ]);
        
        document.getElementById("loading").style.display = "none";
        document.getElementById("recognition-status").style.display = "block";
        
        iniciarVideo();
      } catch (error) {
        console.error("Error cargando modelos:", error);
        document.getElementById("loading").innerHTML = "Error: No se pudieron cargar los modelos. Asegúrate de que la carpeta 'models' esté disponible.";
      }
    }
    
    function iniciarVideo() {
      navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 480, 
          height: 360,
          facingMode: 'user'
        } 
      })
        .then(stream => {
          video.srcObject = stream;
        })
        .catch(err => {
          console.error("No se pudo acceder a la cámara", err);
          document.getElementById("status-text").textContent = "Error: No se pudo acceder a la cámara";
        });
    }
    
    video.addEventListener("play", () => {
      canvas = faceapi.createCanvasFromMedia(video);
      canvas.id = "canvas";
      
      const videoContainer = document.querySelector('.video-container');
      videoContainer.appendChild(canvas);
      
      const displaySize = { width: video.width, height: video.height };
      faceapi.matchDimensions(canvas, displaySize);
      
      // Inicializar FaceMatcher si hay registros
      updateFaceMatcher();
      
      startDetection();
    });
    
    function startDetection() {
      if (detectionInterval) clearInterval(detectionInterval);
      
      detectionInterval = setInterval(async () => {
        if (!isDetectionActive) return;
        
        const startProcessTime = performance.now();
        
        try {
          const detections = await faceapi
            .detectAllFaces(video, DETECTION_OPTIONS)
            .withFaceLandmarks()
            .withFaceDescriptors();
          
          const displaySize = { width: video.width, height: video.height };
          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          
          // Limpiar canvas
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Procesar reconocimiento solo si hay registros
          if (faceMatcher && detections.length > 0) {
            resizedDetections.forEach(d => {
              const match = faceMatcher.findBestMatch(d.descriptor);
              const box = d.detection.box;
              
              // Dibujar caja con color según reconocimiento
              const color = match.label !== "unknown" ? "#00ff00" : "#ff0000";
              const drawBox = new faceapi.draw.DrawBox(box, { 
                label: match.toString(),
                boxColor: color
              });
              drawBox.draw(canvas);
              
              if (match.label !== "unknown") {
                console.log(`[✔️] Reconocido: ${match.label} (${match.distance.toFixed(3)})`);
              }
            });
          } else if (detections.length > 0) {
            // Solo dibujar detección
            resizedDetections.forEach(d => {
              const box = d.detection.box;
              const drawBox = new faceapi.draw.DrawBox(box, { 
                label: "Rostro detectado",
                boxColor: "#0099ff"
              });
              drawBox.draw(canvas);
            });
          }
          
          // Actualizar estadísticas
          const processTime = Math.round(performance.now() - startProcessTime);
          updateStats(detections.length, processTime);
          
        } catch (error) {
          console.error("Error en detección:", error);
        }
      }, DETECTION_INTERVAL);
    }
    
    function updateStats(detectionCount, processTime) {
      frameCount++;
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      const fps = Math.round(frameCount / elapsed);
      
      document.getElementById("fps").textContent = fps;
      document.getElementById("process-time").textContent = processTime;
      document.getElementById("status-text").textContent = 
        `Rostros detectados: ${detectionCount} | Registrados: ${registros.length}`;
      
      // Reset estadísticas cada 10 segundos
      if (elapsed > 10) {
        frameCount = 0;
        startTime = now;
      }
    }
    
    function updateFaceMatcher() {
      if (registros.length > 0) {
        const labeledDescriptors = registros.map(
          r => new faceapi.LabeledFaceDescriptors(r.nombre, [r.descriptor])
        );
        faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5); // Umbral más estricto
      } else {
        faceMatcher = null;
      }
    }
    
    function toggleDetection() {
      const btn = document.getElementById("toggle-detection");
      isDetectionActive = !isDetectionActive;
      
      if (isDetectionActive) {
        btn.textContent = "Pausar Detección";
        btn.classList.remove("paused");
      } else {
        btn.textContent = "Reanudar Detección";
        btn.classList.add("paused");
        // Limpiar canvas cuando se pausa
        if (canvas) {
          canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
    
    async function registrarRostro() {
      const nombre = document.getElementById("nombre").value.trim();
      if (!nombre) return alert("Por favor escribe un nombre");
      
      // Pausar detección temporalmente
      const wasActive = isDetectionActive;
      isDetectionActive = false;
      
      try {
        document.getElementById("status-text").textContent = "Capturando rostro...";
        
        const deteccion = await faceapi
          .detectSingleFace(video, DETECTION_OPTIONS)
          .withFaceLandmarks()
          .withFaceDescriptor();
        
        if (!deteccion) {
          document.getElementById("status-text").textContent = "Error: No se detectó un rostro";
          return alert("No se detectó un rostro. Asegúrate de estar bien posicionado frente a la cámara.");
        }
        
        registros.push({ nombre, descriptor: deteccion.descriptor });
        updateFaceMatcher(); // Actualizar matcher con el nuevo registro
        
        console.log(`[📌] Rostro registrado: ${nombre}`);
        
        document.getElementById("status-text").textContent = 
          `¡Rostro de ${nombre} registrado! | Total registrados: ${registros.length}`;
        
        document.getElementById("nombre").value = "";
        alert(`Rostro de ${nombre} registrado exitosamente.`);
        
      } catch (error) {
        console.error("Error registrando rostro:", error);
        alert("Error al registrar el rostro. Inténtalo de nuevo.");
      } finally {
        // Reanudar detección
        isDetectionActive = wasActive;
      }
    }
    
    window.addEventListener("load", cargarModelos);