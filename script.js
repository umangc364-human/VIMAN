import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1";

env.allowLocalModels = false;

let wallSegmenter = null;

const imageInput = document.getElementById("imageInput");
const canvas = document.getElementById("roomCanvas");
const ctx = canvas.getContext("2d");

const canvasMessage = document.getElementById("canvasMessage");
const statusBox = document.getElementById("statusBox");
const statusText = document.getElementById("statusText");

const colorWheel = document.getElementById("colorWheel");
const selectedColor = document.getElementById("selectedColor");
const colorName = document.getElementById("colorName");

const paintButton = document.getElementById("paintButton");
const resetButton = document.getElementById("resetButton");
const downloadButton = document.getElementById("downloadButton");

let originalImage = null;
let originalImageData = null;

let selectedPaint = {
  name: "Red",
  hex: "#D94B45"
};

let wallPoint = null;
let aiMask = null;

let colors = [
  { name: "Red", hex: "#D94B45" },
  { name: "Terracotta", hex: "#C86A4A" },
  { name: "Orange", hex: "#D98A45" },
  { name: "Warm Yellow", hex: "#D6B85A" },
  { name: "Sage Green", hex: "#8FA38C" },
  { name: "Forest Green", hex: "#526B5B" },
  { name: "Sky Blue", hex: "#8FAFC4" },
  { name: "Ocean Blue", hex: "#607F9B" },
  { name: "Lavender", hex: "#A89BBE" },
  { name: "Rose", hex: "#C98E98" },
  { name: "Warm Beige", hex: "#D9C7A7" },
  { name: "Cream", hex: "#F4F1E8" }
];


// ==========================================
// AI MODEL
// ==========================================

async function loadWallAI() {
  try {
    updateStatus("Loading AI wall detector...", "ai");

    paintButton.disabled = true;

    wallSegmenter = await pipeline(
      "image-segmentation",
      "Xenova/segformer-b0-finetuned-ade-512-512"
    );

    updateStatus("AI wall detector ready", "active");

    paintButton.disabled = false;

    console.log("VIMAN AI wall detector loaded successfully.");

  } catch (error) {

    console.error("AI loading error:", error);

    updateStatus("AI could not load", "");

    alert(
      "VIMAN AI could not load. Please check your internet connection and refresh the page."
    );
  }
}


// ==========================================
// STATUS
// ==========================================

function updateStatus(message, type = "") {

  statusText.textContent = message;

  statusBox.classList.remove("active");
  statusBox.classList.remove("ai");

  if (type) {
    statusBox.classList.add(type);
  }
}


// ==========================================
// IMAGE UPLOAD
// ==========================================

imageInput.addEventListener("change", function (event) {

  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {

    const img = new Image();

    img.onload = function () {

      originalImage = img;

      const maxWidth = 1000;
      const maxHeight = 700;

      let width = img.width;
      let height = img.height;

      const scale = Math.min(
        maxWidth / width,
        maxHeight / height,
        1
      );

      width = Math.round(width * scale);
      height = Math.round(height * scale);

      canvas.width = width;
      canvas.height = height;

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      ctx.drawImage(
        img,
        0,
        0,
        width,
        height
      );

      originalImageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

      canvas.style.display = "block";

      canvasMessage.style.display = "none";

      wallPoint = null;

      aiMask = null;

      updateStatus(
        "Image uploaded — click a wall",
        "active"
      );

      paintButton.disabled = false;

    };

    img.src = e.target.result;

  };

  reader.readAsDataURL(file);

});


// ==========================================
// CLICK WALL
// ==========================================

canvas.addEventListener("click", function (event) {

  if (!originalImage) {
    return;
  }

  const rect = canvas.getBoundingClientRect();

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = Math.floor(
    (event.clientX - rect.left) * scaleX
  );

  const y = Math.floor(
    (event.clientY - rect.top) * scaleY
  );

  wallPoint = {
    x,
    y
  };

  updateStatus(
    "Wall selected ✓",
    "active"
  );

  console.log("Wall click:", wallPoint);

});


// ==========================================
// COLOR WHEEL
// ==========================================

colorWheel.addEventListener("click", function (event) {

  const rect = colorWheel.getBoundingClientRect();

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  const x = event.clientX - rect.left - centerX;
  const y = event.clientY - rect.top - centerY;

  let angle = Math.atan2(y, x);

  angle = angle * 180 / Math.PI;

  angle += 90;

  if (angle < 0) {
    angle += 360;
  }

  const index = Math.floor(
    angle / (360 / colors.length)
  );

  const color = colors[
    Math.min(index, colors.length - 1)
  ];

  selectedPaint = color;

  selectedColor.style.background = color.hex;

  colorName.textContent = color.name;

});


// ==========================================
// PAINT WALL
// ==========================================

paintButton.addEventListener("click", async function () {

  if (!originalImage) {

    alert("Please upload a room photo first.");

    return;
  }

  if (!wallPoint) {

    alert("Please click on the wall you want to paint.");

    return;
  }

  if (!wallSegmenter) {

    alert("AI is still loading. Please wait a moment.");

    return;
  }

  try {

    paintButton.disabled = true;

    updateStatus(
      "AI is detecting the wall...",
      "ai"
    );

    console.log("Running AI segmentation...");

    const imageDataURL = canvas.toDataURL("image/png");

    const output = await wallSegmenter(imageDataURL);

    console.log("AI segmentation result:", output);

    const wallResult = output.find(
      item =>
        item.label &&
        item.label.toLowerCase() === "wall"
    );

    if (!wallResult) {

      alert(
        "AI could not find a wall in this image. Please try another room photo."
      );

      updateStatus(
        "No wall detected",
        ""
      );

      paintButton.disabled = false;

      return;
    }

    updateStatus(
      "AI found the wall — applying colour...",
      "ai"
    );

    const maskImage = wallResult.mask;

    aiMask = await createMaskFromAI(
      maskImage
    );

    const selectedRegion = selectClickedWall(
      aiMask,
      wallPoint.x,
      wallPoint.y
    );

    if (!selectedRegion) {

      alert(
        "The clicked area was not detected as a wall. Please click directly on the wall."
      );

      updateStatus(
        "Click directly on the wall",
        ""
      );

      paintButton.disabled = false;

      return;
    }

    applyWallColor(
      selectedRegion,
      selectedPaint.hex
    );

    updateStatus(
      `${selectedPaint.name} applied ✓`,
      "active"
    );

  } catch (error) {

    console.error("Painting error:", error);

    alert(
      "Something went wrong while processing the wall. Check the browser console for details."
    );

    updateStatus(
      "Painting failed",
      ""
    );

  } finally {

    paintButton.disabled = false;

  }

});


// ==========================================
// CONVERT AI MASK
// ==========================================

async function createMaskFromAI(mask) {

  const maskCanvas = document.createElement("canvas");

  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;

  const maskCtx = maskCanvas.getContext("2d");

  const bitmap = await mask.toCanvas();

  maskCtx.drawImage(
    bitmap,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const data = maskCtx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const result = new Uint8Array(
    canvas.width * canvas.height
  );

  for (
    let i = 0;
    i < result.length;
    i++
  ) {

    const pixelIndex = i * 4;

    const value = data.data[pixelIndex];

    result[i] =
      value > 100
        ? 1
        : 0;

  }

  return result;

}


// ==========================================
// SELECT CONNECTED WALL REGION
// ==========================================

function selectClickedWall(
  mask,
  startX,
  startY
) {

  const width = canvas.width;
  const height = canvas.height;

  const startIndex =
    startY * width + startX;

  if (!mask[startIndex]) {
    return null;
  }

  const selected = new Uint8Array(
    width * height
  );

  const queue = [];

  queue.push(startIndex);

  selected[startIndex] = 1;

  let pointer = 0;

  while (pointer < queue.length) {

    const current = queue[pointer++];

    const x = current % width;

    const y = Math.floor(
      current / width
    );


    // LEFT
    if (x > 0) {

      const index = current - 1;

      if (
        mask[index] &&
        !selected[index]
      ) {

        selected[index] = 1;

        queue.push(index);

      }

    }


    // RIGHT
    if (x < width - 1) {

      const index = current + 1;

      if (
        mask[index] &&
        !selected[index]
      ) {

        selected[index] = 1;

        queue.push(index);

      }

    }


    // UP
    if (y > 0) {

      const index = current - width;

      if (
        mask[index] &&
        !selected[index]
      ) {

        selected[index] = 1;

        queue.push(index);

      }

    }


    // DOWN
    if (y < height - 1) {

      const index = current + width;

      if (
        mask[index] &&
        !selected[index]
      ) {

        selected[index] = 1;

        queue.push(index);

      }

    }

  }

  console.log(
    "Selected wall pixels:",
    queue.length
  );

  return selected;

}


// ==========================================
// APPLY REALISTIC WALL COLOR
// ==========================================

function applyWallColor(
  mask,
  hex
) {

  const imageData =
    ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

  const pixels = imageData.data;

  const paintRGB = hexToRGB(hex);

  for (
    let i = 0;
    i < mask.length;
    i++
  ) {

    if (!mask[i]) {
      continue;
    }

    const pixelIndex = i * 4;

    const oldR = pixels[pixelIndex];
    const oldG = pixels[pixelIndex + 1];
    const oldB = pixels[pixelIndex + 2];

    const luminance =
      0.2126 * oldR +
      0.7152 * oldG +
      0.0722 * oldB;

    const normalized =
      luminance / 255;

    const shadowStrength =
      0.55 + normalized * 0.45;

    pixels[pixelIndex] =
      Math.min(
        255,
        paintRGB.r * shadowStrength
      );

    pixels[pixelIndex + 1] =
      Math.min(
        255,
        paintRGB.g * shadowStrength
      );

    pixels[pixelIndex + 2] =
      Math.min(
        255,
        paintRGB.b * shadowStrength
      );

  }

  ctx.putImageData(
    imageData,
    0,
    0
  );

}


// ==========================================
// HEX → RGB
// ==========================================

function hexToRGB(hex) {

  const value =
    hex.replace("#", "");

  return {
    r: parseInt(
      value.substring(0, 2),
      16
    ),

    g: parseInt(
      value.substring(2, 4),
      16
    ),

    b: parseInt(
      value.substring(4, 6),
      16
    )
  };

}


// ==========================================
// RESET
// ==========================================

resetButton.addEventListener(
  "click",
  function () {

    if (!originalImageData) {
      return;
    }

    ctx.putImageData(
      originalImageData,
      0,
      0
    );

    wallPoint = null;

    aiMask = null;

    updateStatus(
      "Image reset — click a wall",
      "active"
    );

  }
);


// ==========================================
// DOWNLOAD
// ==========================================

downloadButton.addEventListener(
  "click",
  function () {

    if (!originalImage) {

      alert(
        "Please upload and edit a room first."
      );

      return;
    }

    const link =
      document.createElement("a");

    link.download =
      "VIMAN-room-design.png";

    link.href =
      canvas.toDataURL("image/png");

    link.click();

  }
);


// ==========================================
// INITIAL STATE
// ==========================================

selectedColor.style.background =
  selectedPaint.hex;

colorName.textContent =
  selectedPaint.name;

paintButton.disabled = true;


// ==========================================
// START AI
// ==========================================

loadWallAI();