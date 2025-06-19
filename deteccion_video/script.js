
  import * as handPoseDetection from 'https://cdn.skypack.dev/@tensorflow-models/hand-pose-detection';
  import * as tf from 'https://cdn.skypack.dev/@tensorflow/tfjs-core';
  import 'https://cdn.skypack.dev/@tensorflow/tfjs-backend-webgl';

  const video = document.getElementById('video');
  const canvas = document.getElementById('output-canvas');
  const ctx = canvas.getContext('2d');
  const statusText = document.getElementById('status');
  const fileInput = document.getElementById('video-upload');

  const HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],
    [0,17]
  ];

  const colors = [
    { line: '#00c6ff', point: '#0080ff', text: '#ffffff' },
    { line: '#ff5e62', point: '#ff9966', text: '#ffffff' }
  ];

  let detector;

  async function init() {
    statusText.innerText = 'Cargando modelo...';
    await tf.setBackend('webgl');
    await tf.ready();
    detector = await handPoseDetection.createDetector(
      handPoseDetection.SupportedModels.MediaPipeHands,
      {
        runtime: 'tfjs',
        modelType: 'full',
        maxHands: 1
      }
    );
    statusText.innerText = 'Modelo cargado. Carga un video para comenzar.';
  }

  

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!detector) {
      await init();
    }

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadeddata = async () => {
      await video.play();
      detectLoop();
    };
  });

  async function detectLoop() {
    if (video.paused || video.ended) return;
    const hands = await detector.estimateHands(video, { flipHorizontal: false });
    drawHands(hands);
    requestAnimationFrame(detectLoop);
  }

  function drawHands(hands) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    statusText.innerText = `Manos detectadas: ${hands.length}`;

    hands.forEach((hand, i) => {
      const keypoints = hand.keypoints;
      const handedness = hand.handedness;
      const color = colors[i % colors.length];

      HAND_CONNECTIONS.forEach(([a, b]) => {
        const pa = keypoints[a];
        const pb = keypoints[b];
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = color.line;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      keypoints.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = color.point;
        ctx.fill();
      });

      const gesture = detectGesture(keypoints);
      if (gesture) {
        ctx.font = "20px Arial";
        ctx.fillStyle = color.text;
        ctx.fillText(`${gesture} (${handedness})`, 20, 40 + i * 40);
      }
    });
  }

  

  function detectGesture(keypoints) {
    const thumbTip = keypoints[4];
    const thumbIP = keypoints[3];
    const wrist = keypoints[0];
    const indexMCP = keypoints[5];
    const indexTip = keypoints[8];
    const middleMCP = keypoints[9];
    const middleTip = keypoints[12];
    const ringMCP = keypoints[13];
    const ringTip = keypoints[16];
    const pinkyMCP = keypoints[17];
    const pinkyTip = keypoints[20];

    const isExtended = (tip, mcp) => tip.y < mcp.y - 10;
    const indexExtended = isExtended(indexTip, indexMCP);
    const middleExtended = isExtended(middleTip, middleMCP);
    const ringExtended = isExtended(ringTip, ringMCP);
    const pinkyExtended = isExtended(pinkyTip, pinkyMCP);

    const otherFingersCurled = !indexExtended && !middleExtended && !ringExtended && !pinkyExtended;
    const thumbDirection = thumbTip.y - wrist.y;

    if (otherFingersCurled && thumbDirection < -30 && thumbTip.y < thumbIP.y) {
      return "Pulgar arriba 👍";
    }
    if (otherFingersCurled && thumbDirection > 30 && thumbTip.y > thumbIP.y) {
      return "Pulgar abajo 👎";
    }
    if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return "Puño cerrado ✊";
    }
    if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
      return "Mano abierta ✋";
    }

    return "";
  }
