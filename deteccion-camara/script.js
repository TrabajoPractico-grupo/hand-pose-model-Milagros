
const video = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');
const statusText = document.getElementById('status');

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
  await tf.setBackend('webgl');
  detector = await handPoseDetection.createDetector(
    handPoseDetection.SupportedModels.MediaPipeHands,
    {
      runtime: 'mediapipe',
      solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
      modelType: 'full',
      maxHands: 2
    }
  );

  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 800, height: 600 } });
  video.srcObject = stream;

  video.onloadedmetadata = () => {
    video.play();
    detectLoop();
  };
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


function drawHands(hands) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-canvas.width, 0);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  statusText.innerHTML = `Manos detectadas: ${hands.length}`;

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
      ctx.font = "22px 'Roboto', sans-serif";
      ctx.fillStyle = color.text;
      ctx.textAlign = 'left';
      ctx.shadowBlur = 6;
      ctx.fillText(`${gesture} (${handedness === 'Left' ? 'Mano izquierda' : 'Mano derecha'})`, 20, 40 + i * 40);
    }
  });
}

async function detectLoop() {
  const hands = await detector.estimateHands(video, { flipHorizontal: true });
  drawHands(hands);
  requestAnimationFrame(detectLoop);
}

init();
