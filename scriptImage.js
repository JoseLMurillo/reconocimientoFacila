const video = document.getElementById("video");
const registros = [];

document.getElementById("registrar").addEventListener("click", registrarRostro);

async function cargarModelos() {
  await faceapi.nets.tinyFaceDetector.loadFromUri('models');
  await faceapi.nets.faceLandmark68Net.loadFromUri('models');
  await faceapi.nets.faceRecognitionNet.loadFromUri('models');
  iniciarVideo();
}

function iniciarVideo() {
  navigator.mediaDevices.getUserMedia({ video: {} })
    .then(stream => {
      video.srcObject = stream;
    })
    .catch(err => console.error("No se pudo acceder a la cámara", err));
}

video.addEventListener("play", () => {
  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);

  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();

    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    if (registros.length > 0) {
      const labeledDescriptors = registros.map(
        r => new faceapi.LabeledFaceDescriptors(r.nombre, [r.descriptor])
      );
      const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);

      resizedDetections.forEach(d => {
        const match = faceMatcher.findBestMatch(d.descriptor);
        const box = d.detection.box;
        const drawBox = new faceapi.draw.DrawBox(box, { label: match.toString() });
        drawBox.draw(canvas);

        if (match.label !== "unknown") {
          console.log(`[✔️] Reconocido: ${match.label}`);
        }
      });
    }
  }, 1000);
});

async function registrarRostro() {
  const nombre = document.getElementById("nombre").value.trim();
  if (!nombre) return alert("Por favor escribe un nombre");

  const deteccion = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!deteccion) return alert("No se detectó un rostro");

  registros.push({ nombre, descriptor: deteccion.descriptor });
  console.log(`[📌] Rostro registrado: ${nombre}`);
  alert("Rostro registrado exitosamente.");
}

window.addEventListener("load", cargarModelos);
